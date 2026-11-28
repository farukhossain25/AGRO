import type { NextResponse } from "next/server";
import { db } from "./db";
import { fail } from "./api";
import { deviceFingerprint, STREAM_TOKEN_TTL } from "./stream-auth";
import { resolvePremiumState } from "./premium";
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
      /**
       * The viewer slot that was reserved atomically inside the database.
       * Routes MUST sign their token with this jti — it is the row the cap is
       * counted from, so a token minted with any other jti is an un-capped
       * session and /api/stream/auth will not honour it.
       *
       * `null` only for a FREE public source (see `freePublic` below): there is
       * no viewer cap to enforce, so there is no row to reserve.
       */
      slot: { jti: string; expiresAt: string } | null;
    };

type CameraGate = {
  id: string;
  farm_id: string;
  is_active: boolean | null;
  status: string | null;
  is_premium: boolean | null;
  max_viewers: number | null;
  /** 'tv' is always free; the other providers follow `is_premium`. */
  cloud_provider?: string | null;
};

/**
 * A source with nothing to sell: a free TV channel, or a camera the owner has
 * opened to everyone.
 *
 * Premium state, device limits, the basic-tier rule and the viewer cap all
 * exist to protect something that costs money — a vendor's media quota, a paid
 * plan. A free public playlist has none of that, and running the whole gate on
 * it made a login-free TV channel impossible: an anonymous visitor has no
 * `stream_tokens` row to reserve a slot in.
 *
 * So a free public source skips entitlement entirely and gets NO reserved slot.
 * What it keeps is everything that is about safety rather than entitlement —
 * the token is still signed, still bound to this one camera id, still expires
 * in 5 minutes, and the playlist is still rewritten so segments can only be
 * fetched from the host the playlist itself named.
 *
 * A guest has no identity at all, and a shared "public:" fingerprint would let
 * one viewer's revocation log out every other; both are fine here because
 * there is no per-user limit to enforce.
 */
/*
 * `freePublic` is DERIVED, never passed in.
 *
 * It used to be a route-supplied option, which meant a future route could
 * forget it and quietly send a free channel through the paid gate — the exact
 * kind of drift this module exists to prevent (it already happened once, when
 * /api/cam/token was a copy of /api/stream/token). Reading it off the camera
 * row makes every caller correct by construction: a `tv` source is free, and
 * nothing else is.
 */
export async function checkWatchRights(
  req: Request,
  camera: CameraGate,
  user: SessionUser | null
): Promise<WatchCheck> {
  const fingerprint = deviceFingerprint(req);
  const client = db();

  if (camera.cloud_provider === "tv") {
    return { denied: null, user, mode: "public", fingerprint, subscribed: false, slot: null };
  }

  /* `cameras.is_premium = false` → the farm opened this one to everyone. Same
     rule in both routes; the token still expires in 5 minutes and is still
     revocable, so switching the flag back stops playback within one TTL. */
  const isPublic = camera.is_premium === false;

  /* A free TV channel is public regardless of the stored flag. `is_premium`
     defaults to true on every camera row, so relying on the owner clearing it
     would have every new channel answered with a login wall the first time it
     was added — and the admin form's own hint says the tick means "premium".
     The provider is the stronger statement: a `tv` source is a free channel. */
  const isFreeChannel = (camera as CameraGate & { cloud_provider?: string | null }).cloud_provider === "tv";
  const isOpen = isPublic || isFreeChannel;

  const state = isOpen
    ? null
    : await resolvePremiumState(user?.id ?? null, user?.role ?? null, fingerprint);

  if (!isOpen && !state?.canWatch) {
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
     has `device_limit` slots.

     This used to be a SELECT then an UPSERT: two phones opening the app at the
     same moment both read "known = 1" and both inserted, so a 2-device plan
     admitted 3, 4, whatever. premium_device_register() does the count and the
     insert in ONE transaction under an advisory lock on the user, so exactly
     `device_limit` devices get in no matter how simultaneous the requests are.

     Fails CLOSED: if the RPC errors we refuse rather than quietly letting an
     extra phone watch. A paying customer seeing "try again" for a second is a
     far smaller cost than an unbounded device list. */
  if (subscribed && user && state?.subscription) {
    /* `as never` because two of these arguments are nullable in SQL while the
       generated Args type is not (the introspection drops default nullability).
       Same convention as app/api/foisal/chats/route.ts. */
    const { data, error } = await client.rpc("premium_device_register" as never, {
      p_user: user.id,
      p_sub: state.subscription.id,
      p_fp: fingerprint,
      p_limit: state.deviceLimit,
      p_label: req.headers.get("user-agent")?.slice(0, 120) ?? null,
      p_ua: req.headers.get("user-agent")?.slice(0, 240) ?? null,
    } as never);

    if (error) {
      console.error("[watch-rights] device registration failed:", error.message);
      return { denied: fail("ডিভাইস যাচাই করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503) };
    }

    const result = data as { ok: boolean; reason?: string } | null;
    if (!result?.ok) {
      if (result?.reason === "limit") {
        return {
          denied: fail(
            `আপনার প্ল্যানে সর্বোচ্চ ${state.deviceLimit}টি ডিভাইস চলবে। পুরোনো ডিভাইস সরাতে অ্যাকাউন্ট সেটিংসে যান।`,
            403
          ),
        };
      }
      return { denied: fail("ডিভাইস যাচাই করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503) };
    }
  }

  const mode: "public" | "trial" | "premium" = isOpen
    ? "public"
    : state?.reason === "trial"
      ? "trial"
      : "premium";

  /* ---- viewer slot, reserved atomically --------------------------------
     The routes used to call viewerCapReached() (a COUNT) and then INSERT in a
     separate round-trip. N parallel requests all saw the same count and all
     inserted, so `max_viewers` was decorative: one camera, one link, 100 tabs.

     stream_reserve_slot() purges expired rows, counts and inserts inside a
     single transaction holding an advisory lock per camera. Either we get a
     jti back or we are over the cap — there is no window in between.

     Fails CLOSED for the same reason as the device check: an over-cap stream
     costs the owner real money (vendor media quota), an occasional "busy, try
     again" costs the viewer a few seconds. */
  /* p_user is null for a public camera or an anonymous trial — nullable in SQL,
     non-nullable in the generated type, hence the same `as never` convention. */
  const { data: slot, error: slotError } = await client.rpc("stream_reserve_slot" as never, {
    p_camera: camera.id,
    p_user: user?.id ?? null,
    p_fingerprint: fingerprint,
    p_ttl_seconds: STREAM_TOKEN_TTL,
  } as never);

  if (slotError) {
    console.error("[watch-rights] viewer slot reservation failed:", slotError.message);
    return { denied: fail("স্ট্রিম চালু করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503) };
  }

  const reserved = slot as
    | { ok: true; jti: string; expires_at: string }
    | { ok: false; reason: string; cap?: number; live?: number }
    | null;

  if (!reserved?.ok) {
    if (reserved?.reason === "cap") {
      return {
        denied: fail("এই ক্যামেরায় এখন দর্শকের সংখ্যা সর্বোচ্চ — কিছুক্ষণ পর আবার চেষ্টা করুন", 429),
      };
    }
    /* `camera` means the camera vanished between the route's own SELECT and
       this call — that is a 404 for the caller, not a server error. */
    if (reserved?.reason === "camera") {
      return { denied: fail("ক্যামেরা পাওয়া যায়নি", 404) };
    }
    return { denied: fail("স্ট্রিম চালু করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503) };
  }

  return {
    denied: null,
    user,
    mode,
    fingerprint,
    subscribed,
    slot: { jti: reserved.jti, expiresAt: reserved.expires_at },
  };
}
