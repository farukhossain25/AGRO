import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStreamToken } from "@/lib/stream-auth";
import { resolveOrigin, STREAM_PROXY_TARGET, STREAM_ORIGIN_SECRET } from "@/lib/streams";

export const dynamic = "force-dynamic";
// HLS segments must never be cached by the platform — every request is auth'd.
export const revalidate = 0;

/**
 * GET /api/stream/hls/<streamKey>/<segment…>?t=<token>
 * GET /api/stream/whep/<streamKey>?t=<token>          (POST also proxied)
 * --------------------------------------------------------------------------
 * Security boundary:
 *   • a valid, unexpired, unrevoked token for THIS camera is required
 *   • the streamKey in the URL must belong to that camera
 *   • the RTSP/IP source never appears in the response
 *   • if STREAM_PROXY_TARGET is unset we return 503 with a clear Bangla hint
 */
async function handle(req: Request, segments: string[]) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  const payload = await verifyStreamToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, message: "স্ট্রিম টোকেন সঠিক নয় বা মেয়াদ শেষ" }, { status: 401 });
  }

  // Revocable sessions: the row must still exist and be unexpired.
  const { data: session } = await db()
    .from("stream_sessions")
    .select("jti, camera_id, expires_at")
    .eq("jti", payload.jti)
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date() || session.camera_id !== payload.cam) {
    return NextResponse.json({ ok: false, message: "সেশন শেষ — পেজ রিফ্রেশ করুন" }, { status: 401 });
  }

  const { data: camera } = await db()
    .from("cameras")
    .select("id, stream_key, protocol, status, is_active")
    .eq("id", payload.cam)
    .maybeSingle();

  if (!camera) {
    return NextResponse.json({ ok: false, message: "ক্যামেরা পাওয়া যায়নি" }, { status: 404 });
  }

  // The URL's streamKey must match the camera the token was issued for.
  const requestedKey = segments[1];
  if (requestedKey !== camera.stream_key) {
    return NextResponse.json({ ok: false, message: "টোকেন এই ক্যামেরার জন্য নয়" }, { status: 403 });
  }

  if (!STREAM_PROXY_TARGET) {
    return NextResponse.json(
      {
        ok: false,
        message: "স্ট্রিমিং সার্ভার এখনো কনফিগার করা হয়নি (STREAM_PROXY_TARGET)",
        hint: "docker compose -f docker-compose.mediamtx.yml up -d",
      },
      { status: 503 }
    );
  }

  const origin = resolveOrigin({ protocol: camera.protocol as "hls" | "webrtc" }, camera.stream_key);
  if (!origin) {
    return NextResponse.json({ ok: false, message: "স্ট্রিম সার্ভার রুট পাওয়া যায়নি" }, { status: 502 });
  }

  // Forward the sub-path (index.m3u8, segment-3.ts, …) but never the ?t= token.
  const tail = segments.slice(2).join("/");
  let target = origin;

  if (tail) {
    if (camera.protocol === "webrtc") {
      const u = new URL(origin);
      u.searchParams.set("src", camera.stream_key);
      target = u.toString();
    } else {
      const base = origin.replace(/\/index\.m3u8.*$/, "");
      target = `${base}/${tail}`;
    }
  }

  const headers: Record<string, string> = {
    "user-agent": "BiswasAgro-StreamProxy/1.0",
  };
  if (STREAM_ORIGIN_SECRET) headers["x-proxy-secret"] = STREAM_ORIGIN_SECRET;

  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    redirect: "follow",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init).catch(() => null);

  if (!upstream) {
    return NextResponse.json({ ok: false, message: "স্ট্রিম সার্ভারে পৌঁছানো যাচ্ছে না" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, message: upstream.status === 404 ? "ক্যামেরা অফলাইন" : "স্ট্রিম লোড হয়নি" },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  // Rewrite playlist URIs so segment requests carry the token too.
  const isPlaylist = upstream.headers.get("content-type")?.includes("mpegurl");
  if (isPlaylist) {
    const text = await upstream.text();
    const base = `/api/stream/hls/${camera.stream_key}/`;
    const rewritten = text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        // absolute URLs → route back through the proxy
        const absolute = /^https?:\/\//.test(trimmed);
        const file = absolute ? new URL(trimmed).pathname.split("/").pop() ?? "" : trimmed;
        return `${base}${file}?t=${token}`;
      })
      .join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store, no-cache, must-revalidate",
        "access-control-allow-origin": "*",
      },
    });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  try {
    return await handle(req, path);
  } catch {
    return NextResponse.json({ ok: false, message: "স্ট্রিম ত্রুটি" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  try {
    return await handle(req, path);
  } catch {
    return NextResponse.json({ ok: false, message: "স্ট্রিম ত্রুটি" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
