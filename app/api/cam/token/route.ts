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
      }
    | null = null;

  try {
    const { data, error } = await db()
      .from("cameras")
      .select("id, status, is_active, cloud_provider, farm_id")
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

  // A real signed, expiring token — the same signer the RTSP player uses, so a
  // hand-written /api/cam/live/<other camera> URL cannot be assembled by hand.
  const token = await signStreamToken({
    sub: user?.id ?? "anon",
    cam: camera.id,
    jti: randomUUID(),
    mode: state?.reason === "premium" ? "premium" : "trial",
  });

  return ok({
    url: `/api/cam/live/${camera.id}/index.m3u8?t=${token}`,
    protocol: "hls" as const,
    expiresIn: STREAM_TOKEN_TTL,
    mode: state?.reason ?? "trial",
  });
}
