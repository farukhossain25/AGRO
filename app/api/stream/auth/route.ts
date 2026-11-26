import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStreamToken } from "@/lib/stream-auth";
/* The path/token parsers live in scripts/lib/stream-paths.mjs so their contract
   is testable without booting Next — see scripts/test-stream-auth.mjs. They are
   small, pure, and security-relevant: both Caddyfile shapes pass through them. */
import { requestedKey, requestedToken } from "@/scripts/lib/stream-paths.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==========================================================================
   GET /api/stream/auth — the stream edge's forward_auth target
   --------------------------------------------------------------------------
   Caddy runs this BEFORE every /live-<secret>/hls/… request:

       forward_auth 127.0.0.1:3000 {
           uri /api/stream/auth?path={http.request.uri}
           copy_headers X-Stream-Key
       }

   That is the whole point: the edge no longer trusts "a ?t= is present", it
   asks this endpoint. Three things are checked here against the database:

     1. the signature + expiry of the JWT (verifyStreamToken)
     2. the session row (jti) — still exists, not expired, same camera.
        That is what makes a token revocable before its 5 minutes are up
     3. the requested stream key belongs to the camera in the token

   So a leaked playlist URL cannot be pasted into another browser, and pointing
   it at another camera's key fails the third check.

   SEGMENTS AND LL-HLS PARTS — ALSO GATED
   --------------------------------------------------------------------------
   The edge forwards EVERY path that can return video bytes: playlists,
   .ts segments, init segments, LL-HLS parts, keys and WebRTC signalling.
   There is no bypass.

   The old design left segments ungated on the argument that their names were
   only learnable from an authorised playlist. That is obscurity, and it fails
   as soon as a playlist is saved or shared: the segment URLs inside stay valid
   against MediaMTX for as long as the path is live, long after this token
   expires. The result was a shareable, unauthenticated video feed.

   Cost control is deliberate rather than accidental: this handler does exactly
   two primary-key reads (the session row and the camera row) and nothing else,
   so a segment gate is one indexed lookup. See Caddyfile for the arithmetic.

   AUTH IS THE TOKEN, NOT A COOKIE
   --------------------------------------------------------------------------
   The player is on the storefront (bishwasagro.com), the video on
   stream.bishwasagro.com — different origins, so a Supabase session cookie is
   not sent. `?t=` is the credential. Never add a cookie check here.

   FAIL-CLOSED: any error → 401/503, never a pass.
   ========================================================================== */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = requestedToken(url);
  const key = requestedKey(url.searchParams.get("path"));

  const payload = await verifyStreamToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, reason: "token" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const client = db();

    // Revocable: the row must exist, be unexpired, and name the same camera.
    const { data: session } = await client
      .from("stream_tokens")
      .select("jti, camera_id, expires_at")
      .eq("jti", payload.jti)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date() || session.camera_id !== payload.cam) {
      return NextResponse.json(
        { ok: false, reason: "session" },
        { status: 401, headers: { "cache-control": "no-store" } }
      );
    }

    const { data: camera } = await client
      .from("cameras")
      .select("id, stream_key, is_active, status")
      .eq("id", payload.cam)
      .maybeSingle();

    if (!camera) {
      return NextResponse.json({ ok: false, reason: "camera" }, { status: 401 });
    }
    if (!camera.is_active || camera.status === "offline" || camera.status === "maintenance") {
      return NextResponse.json({ ok: false, reason: "offline" }, { status: 403 });
    }
    if (key && camera.stream_key && key !== camera.stream_key) {
      return NextResponse.json({ ok: false, reason: "key" }, { status: 403 });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        // Caddy's copy_headers forwards these to MediaMTX.
        "X-Stream-Key": camera.stream_key ?? "",
        "X-Stream-Camera": camera.id,
      },
    });
  } catch {
    // Database unreachable → refuse. Never let an outage open the edge.
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
  }
}
