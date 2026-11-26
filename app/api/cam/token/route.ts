import { z } from "zod";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { currentUser, fail, ok } from "@/lib/api";
import { signStreamToken, STREAM_TOKEN_TTL } from "@/lib/stream-auth";
import { resolvePremiumState } from "@/lib/premium";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({ cameraId: z.string().uuid() });

/**
 * POST /api/cam/token
 * --------------------------------------------------------------------------
 * The cloud-bridge sibling of /api/stream/token.
 *
 *  1. resolve premium state (active sub → trial → locked), server-side
 *  2. make sure the camera is a cloud camera and is switched on
 *  3. hand back `/api/cam/live/<id>/index.m3u8` — a SAME-ORIGIN path
 *
 * The vendor's HLS URL, the device serial and the API credentials never leave
 * the server. `/api/cam/live/*` re-checks entitlement on every segment request,
 * so revoking a subscription stops the picture within seconds.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("ক্যামেরা আইডি সঠিক নয়");

  const user = await currentUser();
  const state = await resolvePremiumState(user?.id ?? null, user?.role ?? null, "cloud-bridge").catch(
    () => null
  );

  if (!state?.canWatch) {
    return fail(
      state?.reason === "anonymous"
        ? "লাইভ দেখতে লগইন করুন বা ফ্রি ট্রায়াল শুরু করুন"
        : "আপনার ফ্রি ট্রায়াল শেষ হয়েছে — প্রিমিয়াম কিনুন",
      402
    );
  }

  let camera:
    | {
        id: string;
        status: string;
        is_active: boolean;
        cloud_provider: string;
        farm_id: string;
        max_viewers: number | null;
      }
    | null = null;

  try {
    const { data, error } = await db()
      .from("cameras")
      .select("id, status, is_active, cloud_provider, farm_id, max_viewers")
      .eq("id", parsed.data.cameraId)
      .maybeSingle();
    if (error) throw error;
    camera = data;
  } catch {
    return fail("ক্যামেরার তথ্য পাওয়া যাচ্ছে না", 503);
  }

  if (!camera) return fail("ক্যামেরা পাওয়া যায়নি", 404);
  if (camera.cloud_provider === "none") return fail("এই ক্যামেরাটি এখনো লাইভের জন্য সেট করা হয়নি", 409);
  if (!camera.is_active) return fail("এই ক্যামেরাটি বন্ধ আছে", 409);
  if (camera.status === "maintenance") return fail("ক্যামেরাটি রক্ষণাবেক্ষণে আছে", 409);
  if (camera.status === "offline") return fail("ক্যামেরাটি এখন অফলাইন", 409);

  const token_jti = randomUUID();

  /* ---- concurrent viewer cap ------------------------------------------
     This route used to be the ONLY way to watch a camera with no viewer cap:
     /api/stream/token (MediaMTX) counts live tokens and refuses over the cap,
     but the cloud bridge minted a token for anyone with a subscription, so one
     camera could be opened by an unlimited number of phones at once. Every one
     of them bills the vendor's media quota (Imou: 2 GB/month free, then
     $0.25/GB), which is exactly how a "5000 users" launch turns into a bill.

     The count is the number of unexpired tokens minted for this camera in the
     last TTL — the same approximation the RTSP path already uses. */
  try {
    const { getPremiumSettings } = await import("@/lib/premium");
    const settings = await getPremiumSettings();
    const cap = camera.max_viewers || settings.max_viewers_per_camera;

    const { count } = await db()
      .from("stream_tokens")
      .select("jti", { count: "exact", head: true })
      .eq("camera_id", camera.id)
      .gt("expires_at", new Date().toISOString());

    if ((count ?? 0) >= cap) {
      return fail(
        "এই ক্যামেরায় এখন দর্শকের সংখ্যা সর্বোচ্চ — কিছুক্ষণ পর আবার চেষ্টা করুন",
        429
      );
    }

    // Record the mint so the next viewer is counted — same table and shape as
    // /api/stream/token. A failure here must not break a paying viewer's
    // stream, so it is deliberately best-effort.
    const { error: sessionError } = await db()
      .from("stream_tokens")
      .insert({
        jti: token_jti,
        camera_id: camera.id,
        user_id: user?.id ?? null,
        fingerprint: null,
        expires_at: new Date(Date.now() + STREAM_TOKEN_TTL * 1000).toISOString(),
      })
      .select("jti")
      .single();

    if (sessionError) console.warn("[cam/token] viewer count not recorded:", sessionError.message);
  } catch {
    // counting is a cost guard, never a reason to refuse a stream
  }

  // A real signed, expiring token — the same signer the RTSP player uses, so a
  // hand-written /api/cam/live/<other camera> URL cannot be assembled by hand.
  const token = await signStreamToken({
    sub: user?.id ?? "anon",
    cam: camera.id,
    jti: token_jti,
    mode: state?.reason === "premium" ? "premium" : "trial",
  });

  return ok({
    url: `/api/cam/live/${camera.id}/index.m3u8?t=${token}`,
    protocol: "hls" as const,
    expiresIn: STREAM_TOKEN_TTL,
    mode: state?.reason ?? "trial",
  });
}
