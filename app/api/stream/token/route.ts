import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, rateLimit, currentUser } from "@/lib/api";
import { deviceFingerprint, signStreamToken, STREAM_TOKEN_TTL } from "@/lib/stream-auth";
import { resolvePremiumState, getPremiumSettings } from "@/lib/premium";
import { hlsPath, webrtcPath } from "@/lib/streams";

export const dynamic = "force-dynamic";

const schema = z.object({
  cameraId: z.string().uuid(),
  /** client-side device hint (screen + tz), hashed with IP + UA server-side */
  hint: z.string().max(120).optional(),
});

/**
 * POST /api/stream/token
 * --------------------------------------------------------------------------
 * The ONLY way a browser learns how to play a camera.
 *
 *  1. rate limit per IP
 *  2. resolve premium state (active sub → trial → locked) server-side
 *  3. enforce the per-camera concurrent viewer cap
 *  4. create a stream_sessions row (revocable) and sign a 5-minute JWT
 *  5. return { url, protocol, expiresIn } — never the RTSP source
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

    const { cameraId, hint } = schema.parse(await req.json());
    const fingerprint = deviceFingerprint(req, hint);

    const user = await currentUser();
    const state = await resolvePremiumState(user?.id ?? null, user?.role ?? null, fingerprint);

    if (!state.canWatch) {
      return fail(
        state.reason === "anonymous"
          ? "লাইভ দেখতে ফ্রি ট্রায়াল শুরু করুন বা প্রিমিয়াম কিনুন"
          : "আপনার ফ্রি ট্রায়াল শেষ হয়েছে — প্রিমিয়াম কিনুন",
        402,
        undefined
      );
    }

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

    // ---- basic tier only sees the first camera of each farm ----
    if (state.subscription?.tier === "basic") {
      const { data: first } = await client
        .from("cameras")
        .select("id")
        .eq("farm_id", camera.farm_id)
        .eq("is_active", true)
        .order("sort_order")
        .limit(1);
      if (first?.[0]?.id !== camera.id) {
        return fail("বেসিক প্ল্যানে শুধু প্রথম ক্যামেরা দেখা যায় — ফুল অ্যাক্সেস নিন", 403);
      }
    }

    // ---- concurrent viewer cap ----
    const settings = await getPremiumSettings();
    const cap = camera.max_viewers || settings.max_viewers_per_camera;

    const { count: liveViewers } = await client
      .from("stream_tokens")
      .select("jti", { count: "exact", head: true })
      .eq("camera_id", camera.id)
      .gt("expires_at", new Date().toISOString());

    if ((liveViewers ?? 0) >= cap) {
      return fail("এই ক্যামেরায় এখন দর্শকের সংখ্যা সর্বোচ্চ — কিছুক্ষণ পর আবার চেষ্টা করুন", 429);
    }

    // ---- device limit for real subscriptions ----
    if (state.subscription && user) {
      const { data: devices } = await client
        .from("premium_devices")
        .select("id, fingerprint")
        .eq("user_id", user.id);

      const known = devices ?? [];
      const seen = known.find((d) => d.fingerprint === fingerprint);

      if (!seen && known.length >= state.deviceLimit) {
        return fail(
          `আপনার প্ল্যানে সর্বোচ্চ ${state.deviceLimit}টি ডিভাইস চলবে। পুরোনো ডিভাইস সরাতে অ্যাকাউন্ট সেটিংসে যান।`,
          403
        );
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

    // ---- mint a revocable session + short token ----
    const expiresAt = new Date(Date.now() + STREAM_TOKEN_TTL * 1000).toISOString();

    const { data: session, error: sessionError } = await client
      .from("stream_tokens")
      .insert({
        camera_id: camera.id,
        user_id: user?.id ?? null,
        fingerprint,
        expires_at: expiresAt,
      })
      .select("jti")
      .single();

    if (sessionError) throw sessionError;

    const token = await signStreamToken({
      sub: user?.id ?? `trial:${fingerprint.slice(0, 12)}`,
      cam: camera.id,
      jti: session.jti,
      mode: state.reason === "trial" ? "trial" : "premium",
      fp: fingerprint.slice(0, 16),
    });

    if (!camera.stream_key) {
      return fail("এই ক্যামেরার স্ট্রিম কনফিগার করা হয়নি", 503);
    }

    const path =
      camera.protocol === "webrtc" ? webrtcPath(camera.stream_key) : hlsPath(camera.stream_key);

    return ok({
      url: `${path}?t=${token}`,
      protocol: camera.protocol,
      expiresIn: STREAM_TOKEN_TTL,
      mode: state.reason,
      camera: { id: camera.id, name: camera.name_bn },
    });
  } catch (error) {
    return handleError(error);
  }
}
