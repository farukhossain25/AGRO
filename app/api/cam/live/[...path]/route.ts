import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/cam/live/<cameraId>/index.m3u8?t=<token>
 * GET /api/cam/live/<cameraId>/seg/<b64url url>?s=<sig>&t=<token>
 * --------------------------------------------------------------------------
 * Streaming proxy for cloud cameras (Imou / EZVIZ / direct HLS).
 *
 * Three independent gates, cheapest first:
 *   1. `t`  — a signed 5-minute JWT minted by /api/cam/token, bound to ONE
 *             camera. Minting requires an active subscription or live trial,
 *             so a lapsed customer is cut off within one token lifetime.
 *   2. path — the camera must exist, be active and not be offline.
 *   3. `s`  — an HMAC over (cameraId, exact upstream URL), only produced when we
 *             rewrite a playlist we fetched ourselves. Without it `?u=` would be
 *             an open relay into the internal network.
 */
export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const [cameraId, ...rest] = path ?? [];
  if (!cameraId) return fail("ক্যামেরা আইডি নেই", 400);

  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  // Signed by /api/cam/token for THIS camera and this camera only.
  const { verifyStreamToken } = await import("@/lib/stream-auth");
  const payload = await verifyStreamToken(token).catch(() => null);
  if (!payload || payload.cam !== cameraId) {
    return fail("লাইভ লিংক সঠিক নয় বা মেয়াদ শেষ — পেজ রিফ্রেশ করুন", 401);
  }

  /* The signed token is this route's entitlement gate: it was minted by
     /api/cam/token, which refuses anyone without an active subscription or a
     live trial, and it names exactly one camera. Re-running the premium query
     here would cost a DB round-trip on every segment for no extra safety — and
     a lapsed subscription still stops within one 5-minute TTL, because the
     player re-mints and the mint refuses.

     REVOCATION, though, is a different question. /api/cam/token reserves a
     `stream_tokens` row (jti) through checkWatchRights() — the same row the
     proxy path checks on every request. Without checking it here, "log them
     out of every device" or "the viewer cap dropped them" had no effect on
     cloud cameras for up to 5 minutes, while the same action cut a MediaMTX
     viewer off immediately. One indexed primary-key read closes that gap and
     keeps both paths honest. */
  const { data: session } = await db()
    .from("stream_tokens")
    .select("jti, camera_id, expires_at")
    .eq("jti", payload.jti)
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date() || session.camera_id !== cameraId) {
    return fail("লাইভ সেশন শেষ — পেজ রিফ্রেশ করুন", 401);
  }

  const { data: camera, error } = await db()
    .from("cameras")
    .select("id, cloud_provider, cloud_serial, cloud_channel, stream_url, is_active, status")
    .eq("id", cameraId)
    .maybeSingle();

  if (error) return fail("ক্যামেরার তথ্য পাওয়া যাচ্ছে না", 503);
  if (!camera) return fail("ক্যামেরা পাওয়া যায়নি", 404);
  if (!camera.is_active || camera.status === "offline") return fail("ক্যামেরাটি এখন অফলাইন", 409);

  const upstreamPath = rest.join("/");

  // ---- playlist: resolve the vendor URL, rewrite every URI through this proxy
  if (upstreamPath.endsWith(".m3u8") || upstreamPath === "") {
    let resolved: { url: string };
    try {
      /* Cached briefly: a player re-fetches this playlist every few seconds and
         the vendor bills per call (Imou: 30k calls + 2 GB/month free, then
         paid). See resolveCloudHlsCached for the arithmetic. */
      const { resolveCloudHlsCached } = await import("@/lib/camera-cloud");
      resolved = await resolveCloudHlsCached(camera);
    } catch (err) {
      const message = err instanceof Error ? err.message : "স্ট্রিম শুরু করা যাচ্ছে না";
      return NextResponse.json({ ok: false, message }, { status: 502 });
    }

    const upstream = await fetch(resolved.url, {
      headers: { "user-agent": "BiswasAgro-CamProxy/1.0" },
      cache: "no-store",
      redirect: "follow",
    }).catch(() => null);

    if (!upstream?.ok) return fail("ক্যামেরাটি এখন লাইভ দিচ্ছে না", 404);

    const text = await upstream.text();
    const base = resolved.url.replace(/[^/]*$/, "");
    /** Every segment URL carries its own origin, pinned in the path. That is
     *  the allowlist: a segment is only fetched from the same host the playlist
     *  itself came from. Vendors rotate CDN hosts between playlists, so a
     *  hardcoded host list would break real streams; this cannot be spoofed
     *  because the value is produced here, not by the browser. */
    const { signSegment } = await import("@/lib/camera-cloud");
    const pin = (absolute: string) => {
      const sig = signSegment(cameraId, absolute);
      const carried = Buffer.from(absolute).toString("base64url");
      return `/api/cam/live/${cameraId}/seg/${carried}?s=${sig}&t=${token}`;
    };

    /* Fail CLOSED. A raw vendor URL in this playlist would let the browser talk
       straight to the CDN, skipping the premium check on every segment — so a
       line we cannot rewrite aborts the whole playlist instead of being passed
       through. (This is also what happens when STREAM_TOKEN_SECRET and the
       Supabase credentials are both missing: 502, not a free stream.) */
    let rewritten: string;
    try {
      rewritten = text
        .split("\n")
        .map((line) => {
          const value = line.trim();
          if (!value) return line;
          if (value.startsWith("#")) {
            // key / map URIs live inside tags — route those too
            return value.replace(/URI="([^"]+)"/g, (_all, uri: string) => {
              const absolute = /^https?:/i.test(uri) ? uri : new URL(uri, base).toString();
              return `URI="${pin(absolute)}"`;
            });
          }
          const absolute = /^https?:/i.test(value) ? value : new URL(value, base).toString();
          return pin(absolute);
        })
        .join("\n");
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          message:
            err instanceof Error && /স্ট্রিম কী/.test(err.message)
              ? "স্ট্রিম কী কনফিগার করা নেই (STREAM_TOKEN_SECRET)"
              : "প্লেলিস্ট পড়া যাচ্ছে না",
        },
        { status: 502 }
      );
    }

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // ---- segments: /seg/<base64url vendor URL>?s=<signature>
  // The URL travels in the PATH, not the query: Next normalises hostnames like
  // 127.0.0.1 → localhost inside search params, which broke the signature on
  // every segment. Path segments come through byte-for-byte.
  const carried = rest[1] ?? "";
  let absolute = "";
  try {
    absolute = Buffer.from(carried, "base64url").toString("utf8");
  } catch {
    absolute = "";
  }
  if (!absolute) return fail("সেগমেন্টের ঠিকানা নেই", 400);

  let target: URL;
  try {
    target = new URL(absolute);
  } catch {
    return fail("সেগমেন্টের ঠিকানা ভুল", 400);
  }

  // `s` is an HMAC over this exact camera + this exact URL, minted only when we
  // rewrote a playlist we fetched ourselves. Without it this endpoint would be an
  // open relay: a caller could hand us 169.254.169.254 or a 10.x host and read
  // whatever came back. The origin in the path is a readability aid only — the
  // signature is the gate.
  const { verifySegment } = await import("@/lib/camera-cloud");
  if (!verifySegment(cameraId, absolute, url.searchParams.get("s"))) {
    return fail("অনুমোদিত নয় এমন স্ট্রিম সার্ভার", 403);
  }

  // Direct-HLS cameras are opt-in: an admin-typed URL would otherwise let the
  // proxy reach anything that admin's row names.
  if (camera.cloud_provider === "hls" && !process.env.CAM_ALLOW_DIRECT_HLS) {
    return fail("সরাসরি HLS লিংক চালু নেই (CAM_ALLOW_DIRECT_HLS)", 403);
  }

  const upstream = await fetch(target, {
    headers: { "user-agent": "BiswasAgro-CamProxy/1.0" },
    cache: "no-store",
  }).catch(() => null);

  if (!upstream?.ok) return fail("সেগমেন্ট লোড হয়নি", 502);

  const headers = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) headers.set("content-type", type);
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  headers.set("cache-control", "no-store");

  return new NextResponse(upstream.body, { status: 200, headers });
}
