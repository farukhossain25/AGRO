import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, rateLimit, currentUser } from "@/lib/api";
import { signStreamToken, STREAM_TOKEN_TTL } from "@/lib/stream-auth";
import { checkWatchRights, viewerCapReached } from "@/lib/watch-rights";
import { directHlsUrl, hlsPath, webrtcPath } from "@/lib/streams";

export const dynamic = "force-dynamic";

/* `hint` used to be accepted here and mixed into the device fingerprint. It is
   ignored now (see lib/stream-auth.ts): a browser-supplied value in an identity
   hash is a reset button. Old callers keep working; the field is just dropped. */
const schema = z.object({
  cameraId: z.string().uuid(),
});

/**
 * POST /api/stream/token
 * --------------------------------------------------------------------------
 * The ONLY way a browser learns how to play a camera.
 *
 *  1. rate limit per IP
 *  2. load the camera — `is_premium = false` means the farm opened it to the
 *     public, so guests watch without a subscription or a trial (mode: public)
 *  3. otherwise resolve premium state (active sub → trial → locked) server-side
 *  4. enforce the per-camera concurrent viewer cap
 *  5. create a stream_sessions row (revocable) and sign a 5-minute JWT
 *  6. return { url, protocol, expiresIn } — never the RTSP source
 */
export async function POST(req: Request) {
  try {
    const key = req.headers.get("x-forwarded-for") ?? "local";
    const limited = rateLimit(`stream-token:${key}`, 30, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, message: "অনেকবার চেষ্টা হয়েছে, এক মিনিট পর আবার দিন" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const { cameraId } = schema.parse(await req.json());

    const client = db();
    const { data: camera, error } = await client
      .from("cameras")
      .select("id, farm_id, name_bn, protocol, stream_key, status, is_active, is_premium, max_viewers")
      .eq("id", cameraId)
      .maybeSingle();

    if (error) throw error;
    if (!camera) return fail("ক্যামেরা পাওয়া যায়নি", 404);
    if (!camera.is_active) return fail("এই ক্যামেরাটি বন্ধ আছে", 409);
    if (camera.status === "maintenance") return fail("ক্যামেরাটি রক্ষণাবেক্ষণে আছে", 409);
    if (camera.status === "offline") return fail("ক্যামেরাটি এখন অফলাইন", 409);

    const user = await currentUser();

    /* Entitlement, basic-tier restriction and device limit — all in one place,
       shared with /api/cam/token (lib/watch-rights.ts). Public cameras skip the
       premium check inside it; everything else is identical. */
    const gate = await checkWatchRights(req, camera, user);
    if (gate.denied) return gate.denied;

    if (await viewerCapReached(camera)) {
      return fail("এই ক্যামেরায় এখন দর্শকের সংখ্যা সর্বোচ্চ — কিছুক্ষণ পর আবার চেষ্টা করুন", 429);
    }

    // ---- mint a revocable session + short token ----
    const expiresAt = new Date(Date.now() + STREAM_TOKEN_TTL * 1000).toISOString();

    const { data: session, error: sessionError } = await client
      .from("stream_tokens")
      .insert({
        camera_id: camera.id,
        user_id: user?.id ?? null,
        fingerprint: gate.fingerprint,
        expires_at: expiresAt,
      })
      .select("jti")
      .single();

    if (sessionError) throw sessionError;

    const token = await signStreamToken({
      sub: user?.id ?? `${gate.mode === "public" ? "public" : "trial"}:${gate.fingerprint.slice(0, 12)}`,
      cam: camera.id,
      jti: session.jti,
      mode: gate.mode,
      fp: gate.fingerprint.slice(0, 16),
    });

    if (!camera.stream_key) {
      return fail("এই ক্যামেরার স্ট্রিম কনফিগার করা হয়নি", 503);
    }

    /* Direct-video mode: HLS bytes go to the stream edge, not through Vercel.
       WebRTC keeps proxying (it is a live signalling exchange, not bulk media).
       If STREAM_PUBLIC_BASE is unset this is "" and nothing changes. */
    const direct = camera.protocol === "webrtc" ? "" : directHlsUrl(camera.stream_key, token);
    const path =
      camera.protocol === "webrtc" ? webrtcPath(camera.stream_key) : hlsPath(camera.stream_key);

    return ok({
      url: direct || `${path}?t=${token}`,
      proxied: !direct,
      protocol: camera.protocol,
      expiresIn: STREAM_TOKEN_TTL,
      mode: gate.mode,
      camera: { id: camera.id, name: camera.name_bn },
    });
  } catch (error) {
    return handleError(error);
  }
}
