import type { NextResponse } from "next/server";
import { db } from "./db";
import { fail } from "./api";
import { deviceFingerprint } from "./stream-auth";
import { getPremiumSettings, resolvePremiumState } from "./premium";
import type { SessionUser } from "./session";

/* ==========================================================================
   Shared watch-rights check for every "give me a stream" route
   --------------------------------------------------------------------------
   There are two siblings that mint player tokens:

     POST /api/stream/token   MediaMTX + go2rtc (RTSP cameras)
     POST /api/cam/token      vendor cloud bridge (Imou / EZVIZ / direct HLS)

   They started as copies and drifted: the cloud route never got the basic-tier
   restriction and never registered a device, so a Basic subscriber could open
   camera #4 and an unlimited number of phones could watch on one plan. Doing
   the checks in one function is the only way they cannot drift again.

   Returns either { denied } (a ready-made response) or the entitlement data
   the caller needs to mint a token and record the session.
   ========================================================================== */

export type WatchCheck =
  | { denied: NextResponse }
  | {
      denied: null;
      user: SessionUser | null;
      /** public | trial | premium — what the minted token should say. */
      mode: "public" | "trial" | "premium";
      fingerprint: string;
      /** True when a real subscription is behind the right to watch. */
      subscribed: boolean;
    };

type CameraGate = {
  id: string;
  farm_id: string;
  is_active: boolean | null;
  status: string | null;
  is_premium: boolean | null;
  max_viewers: number | null;
};

export async function checkWatchRights(
  req: Request,
  camera: CameraGate,
  user: SessionUser | null
): Promise<WatchCheck> {
  const fingerprint = deviceFingerprint(req);
  const client = db();

  /* `cameras.is_premium = false` → the farm opened this one to everyone. Same
     rule in both routes; the token still expires in 5 minutes and is still
     revocable, so switching the flag back stops playback within one TTL. */
  const isPublic = camera.is_premium === false;

  const state = isPublic
    ? null
    : await resolvePremiumState(user?.id ?? null, user?.role ?? null, fingerprint);

  if (!isPublic && !state?.canWatch) {
    return {
      denied: fail(
        state?.reason === "anonymous"
          ? "লাইভ দেখতে লগইন করুন বা ফ্রি ট্রায়াল শুরু করুন"
          : "আপনার ফ্রি ট্রায়াল শেষ হয়েছে — প্রিমিয়াম কিনুন",
        402
      ),
    };
  }

  /* ---- basic tier: first camera of the farm only -------------------------
     This is a plan promise, not a nicety: Basic is priced as "one camera".
     The cloud route never had it, so Basic subscribers watched every camera. */
  if (state?.subscription?.tier === "basic") {
    const { data: first } = await client
      .from("cameras")
      .select("id")
      .eq("farm_id", camera.farm_id)
      .eq("is_active", true)
      .order("sort_order")
      .limit(1);

    if (first?.[0]?.id !== camera.id) {
      return { denied: fail("বেসিক প্ল্যানে শুধু প্রথম ক্যামেরা দেখা যায় — ফুল অ্যাক্সেস নিন", 403) };
    }
  }

  const subscribed = Boolean(state?.subscription);

  /* ---- device limit for real subscriptions -------------------------------
     A trial is anonymous-ish and has its own one-per-device rule; a paid plan
     has `device_limit` slots. Registering the device here is also what makes
     the limit enforceable — the old cloud route recorded nothing, so every
     phone looked like "a new device" forever. */
  if (subscribed && user && state?.subscription) {
    const { data: devices } = await client
      .from("premium_devices")
      .select("id, fingerprint")
      .eq("user_id", user.id);

    const known = devices ?? [];
    const seen = known.find((d) => d.fingerprint === fingerprint);

    if (!seen && known.length >= state.deviceLimit) {
      return {
        denied: fail(
          `আপনার প্ল্যানে সর্বোচ্চ ${state.deviceLimit}টি ডিভাইস চলবে। পুরোনো ডিভাইস সরাতে অ্যাকাউন্ট সেটিংসে যান।`,
          403
        ),
      };
    }

    await client.from("premium_devices").upsert(
      {
        user_id: user.id,
        subscription_id: state.subscription.id,
        fingerprint,
        label: req.headers.get("user-agent")?.slice(0, 120) ?? null,
        user_agent: req.headers.get("user-agent")?.slice(0, 240) ?? null,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,fingerprint" }
    );
  }

  const mode: "public" | "trial" | "premium" = isPublic
    ? "public"
    : state?.reason === "trial"
      ? "trial"
      : "premium";

  return { denied: null, user, mode, fingerprint, subscribed };
}

/* --------------------------------------------------------------------------
   Concurrent viewer cap — the cost guard.
   Every minted token is a row; the count of unexpired rows is "how many people
   are watching right now". Shared so both routes enforce the same limit.
   -------------------------------------------------------------------------- */
export async function viewerCapReached(camera: CameraGate): Promise<boolean> {
  const settings = await getPremiumSettings();
  const cap = camera.max_viewers || settings.max_viewers_per_camera;

  const { count } = await db()
    .from("stream_tokens")
    .select("jti", { count: "exact", head: true })
    .eq("camera_id", camera.id)
    .gt("expires_at", new Date().toISOString());

  return (count ?? 0) >= cap;
}
