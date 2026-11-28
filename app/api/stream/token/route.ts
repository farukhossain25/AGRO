import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, rateLimit, currentUser } from "@/lib/api";
import { signStreamToken, STREAM_TOKEN_TTL } from "@/lib/stream-auth";
import { checkWatchRights } from "@/lib/watch-rights";
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
 *  4. register the device (paid plans only) — one locked transaction
 *  5. reserve a viewer slot — one locked transaction that purges expired
 *     sessions, counts live ones and inserts the new stream_tokens row
 *  6. sign a 5-minute JWT bound to that row's jti
 *  7. return { url, protocol, expiresIn } — never the RTSP source
 *
 * Steps 4 and 5 live in lib/watch-rights.ts because /api/cam/token needs the
 * identical rules. Nothing in this route inserts into stream_tokens itself —
 * a second row would count twice against the cap and the token would point at
 * a session that is not the reserved one.
 */
/**
 * Give a reserved viewer slot back.
 *
 * Idempotent by construction: it deletes the row by jti, and deleting a row
 * that is already gone is a successful no-op. Never throws — a failure here is
 * logged and swallowed, because the caller is already returning an error and
 * must not turn it into a 500.
 *
 * If this call fails the slot simply expires on its own TTL (5 minutes), which
 * is the same bound every viewer slot already has.
 */
async function releaseSlot(jti: string): Promise<void> {
  try {
    const { error } = await db().from("stream_tokens").delete().eq("jti", jti);
    if (error) console.error("[stream/token] could not release viewer slot:", error.message);
  } catch (problem) {
    console.error("[stream/token] could not release viewer slot:", (problem as Error).message);
  }
}

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
    /* `cloud_provider` rides along for one reason: to answer a mis-routed call
       with the truth. This route plays a MediaMTX stream_key and nothing else,
       so a vendor camera or a TV channel reaching it used to fall through to
       "স্ট্রিম কনফিগার করা হয়নি" — a message that blames the admin for a row
       that is configured perfectly, just not here. The product page had this
       exact bug (see components/live/product-live-block.tsx). Asking for the
       column is safe on a pre-migration-24 database only because the whole
       select is retried without it below. */
    let { data: camera, error } = await client
      .from("cameras")
      .select("id, farm_id, name_bn, protocol, stream_key, status, is_active, is_premium, max_viewers, cloud_provider")
      .eq("id", cameraId)
      .maybeSingle();

    if (error && (error.code === "42703" || /cloud_provider/.test(String(error.message ?? "")))) {
      ({ data: camera, error } = await client
        .from("cameras")
        .select("id, farm_id, name_bn, protocol, stream_key, status, is_active, is_premium, max_viewers")
        .eq("id", cameraId)
        .maybeSingle());
    }

    if (error) throw error;
    if (!camera) return fail("ক্যামেরা পাওয়া যায়নি", 404);
    if (!camera.is_active) return fail("এই ক্যামেরাটি বন্ধ আছে", 409);
    if (camera.status === "maintenance") return fail("ক্যামেরাটি রক্ষণাবেক্ষণে আছে", 409);
    if (camera.status === "offline") return fail("ক্যামেরাটি এখন অফলাইন", 409);

    /* ---- configuration check BEFORE any slot is reserved -------------------
       checkWatchRights() below reserves a viewer slot — a row in
       stream_tokens that counts against max_viewers until it expires. The
       stream-key check used to run AFTER that, so every attempt against a
       camera with no stream key took a slot, returned 503, and never gave it
       back. Five such attempts against a camera capped at five viewers locked
       out every real viewer for the full TTL — and a customer refreshing a
       broken camera reaches five in seconds.

       Nothing below can succeed without a stream key, so there is no reason to
       reserve first. This is the "validate before reserving" half.
    */
    if (!camera.stream_key || !camera.stream_key.trim()) {
      /* Point the caller at the route that CAN play this row, instead of
         claiming the row has no stream. The player that hit this is told which
         one to use, and the owner reading the same message learns that the
         source needs no stream key at all. */
      const provider = (camera as { cloud_provider?: string | null }).cloud_provider ?? "none";
      if (provider === "tv") {
        return fail("এটি একটি লাইভ টিভি চ্যানেল — ক্লাউড প্লেয়ার দিয়ে চলবে, স্ট্রিম কী লাগবে না", 409);
      }
      if (provider !== "none") {
        return fail(
          `এই ক্যামেরার সোর্স ${provider.toUpperCase()} — ক্লাউড প্লেয়ার দিয়ে চলবে, স্ট্রিম কী লাগবে না`,
          409
        );
      }
      return fail("এই ক্যামেরার স্ট্রিম কনফিগার করা হয়নি", 503);
    }

    const user = await currentUser();

    /* Entitlement, basic-tier restriction and device limit — all in one place,
       shared with /api/cam/token (lib/watch-rights.ts). Public cameras skip the
       premium check inside it; everything else is identical. */
    const gate = await checkWatchRights(req, camera, user);
    if (gate.denied) return gate.denied;
    /* This route never asks for `freePublic`, so a slot is always reserved; the
       guard keeps the invariant explicit instead of asserting it away. */
    if (!gate.slot) return fail("স্ট্রিম সেশন তৈরি করা যাচ্ছে না — আবার চেষ্টা করুন", 503);

    /* ---- from here on a slot EXISTS; every exit must give it back ---------
       The slot was reserved atomically inside checkWatchRights(). Everything
       after this point either returns a usable token (slot keeps counting, as
       it should) or releases the slot and returns an error. This is the
       "release on every subsequent failure" half. */
    const streamKey = camera.stream_key;

    let token: string;
    try {
      /* The slot — and therefore the revocable session row this token is bound
         to — was already created inside checkWatchRights(). Do NOT insert
         another stream_tokens row here: a second row would count twice against
         the cap and, worse, a token signed with a jti that has no row is
         rejected by /api/stream/auth, so the player would 401 in a loop. */
      token = await signStreamToken({
        sub: user?.id ?? `${gate.mode === "public" ? "public" : "trial"}:${gate.fingerprint.slice(0, 12)}`,
        cam: camera.id,
        jti: gate.slot.jti,
        mode: gate.mode,
        fp: gate.fingerprint.slice(0, 16),
      });
    } catch (signError) {
      console.error("[stream/token] signing failed, releasing slot:", (signError as Error).message);
      await releaseSlot(gate.slot.jti);
      return fail("স্ট্রিম চালু করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503);
    }

    /* Direct-video mode: HLS bytes go to the stream edge, not through Vercel.
       WebRTC keeps proxying (it is a live signalling exchange, not bulk media).
       If STREAM_PUBLIC_BASE is unset this is "" and nothing changes. */
    const direct = camera.protocol === "webrtc" ? "" : directHlsUrl(streamKey, token);
    const path = camera.protocol === "webrtc" ? webrtcPath(streamKey) : hlsPath(streamKey);

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
