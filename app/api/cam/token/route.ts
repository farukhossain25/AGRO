import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, fail, ok } from "@/lib/api";
import { signStreamToken, STREAM_TOKEN_TTL } from "@/lib/stream-auth";
import { checkWatchRights } from "@/lib/watch-rights";

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
 *
 * ⚠️ THIS ROUTE USED TO BE A COPY OF /api/stream/token THAT DRIFTED
 * --------------------------------------------------------------------------
 * It passed the literal string "cloud-bridge" as the device fingerprint:
 *
 *     resolvePremiumState(user?.id, user?.role, "cloud-bridge")
 *
 * which meant every trial user in the world shared one trial identity — the
 * first person to start a trial made `canWatch` true for everybody, and the
 * trial could never belong to the person actually watching. Worse, the
 * basic-tier restriction and the device limit were never copied over, so a
 * Basic plan saw every camera and one plan could be watched from fifty phones.
 *
 * All three checks now come from lib/watch-rights.ts, the same function the
 * RTSP route uses, so the two cannot diverge again.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("ক্যামেরা আইডি সঠিক নয়");

  let camera:
    | {
        id: string;
        status: string;
        is_active: boolean;
        cloud_provider: string;
        farm_id: string;
        max_viewers: number | null;
        is_premium: boolean | null;
      }
    | null = null;

  try {
    const { data, error } = await db()
      .from("cameras")
      .select("id, status, is_active, cloud_provider, farm_id, max_viewers, is_premium")
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

  const user = await currentUser();

  /* Entitlement + basic tier + device limit, identical to the RTSP route.
     `is_premium = false` (a camera the farm opened to everyone) is handled
     inside — the token is still short-lived and revocable. */
  /* A free TV channel is not a paid camera: there is no vendor quota to
     protect and nothing to sell, so entitlement is skipped rather than turned
     into a login wall. `checkWatchRights` decides that from the camera row, so
     this route cannot pass the wrong flag. Every premium camera keeps the full
     gate. */
  const freePublic = camera.cloud_provider === "tv";
  const gate = await checkWatchRights(req, camera, user);
  if (gate.denied) return gate.denied;
  if (!gate.slot && !freePublic) return fail("স্ট্রিম সেশন তৈরি করা যাচ্ছে না — আবার চেষ্টা করুন", 503);

  /* Viewer cap. Every concurrent viewer bills the vendor's media quota (Imou:
     2 GB/month free, then $0.25/GB), so this is the cost guard, not a nicety.

     It used to be a COUNT followed by a best-effort INSERT — the count could
     be passed by any number of simultaneous requests, and a failed insert was
     swallowed, so the session existed but nothing counted it. The reservation
     now happens inside checkWatchRights() as one locked transaction, and it
     fails closed: no slot, no token.

     The jti must be the reserved one. A token signed with a fresh uuid would
     have no stream_tokens row and /api/cam/auth rejects it. */
  /* With no price and no cap there is no row to reserve, so the token is
     stamped with a fresh id purely to keep the payload shape identical — it is
     never looked up on this path (see the freePublic arm in lib/watch-rights). */
  const token_jti = gate.slot?.jti ?? randomUUID();

  // A real signed, expiring token — the same signer the RTSP player uses, so a
  // hand-written /api/cam/live/<other camera> URL cannot be assembled by hand.
  const token = await signStreamToken({
    sub: user?.id ?? `${gate.mode === "public" ? "public" : "trial"}:${gate.fingerprint.slice(0, 12)}`,
    cam: camera.id,
    jti: token_jti,
    mode: gate.mode,
    fp: gate.fingerprint.slice(0, 16),
  });

  return ok({
    url: `/api/cam/live/${camera.id}/index.m3u8?t=${token}`,
    protocol: "hls" as const,
    expiresIn: STREAM_TOKEN_TTL,
    mode: gate.mode,
  });
}
