import type { Camera } from "./types";

/* ==========================================================================
   Camera → playback URL mapping
   --------------------------------------------------------------------------
   The RTSP/IP source is stored in cameras.stream_key (and optionally
   cameras.stream_url) and is read ONLY here, on the server.

   Browser-visible paths (relative — works through the Vercel/CDN proxy):

     HLS      /api/stream/hls/<stream_key>/index.m3u8
     WebRTC   /api/stream/whep/<stream_key>            (go2rtc WHEP endpoint)

   The proxy (app/api/stream/[...path]/route.ts) validates a signed token and
   forwards to MediaMTX (HLS) or go2rtc (WebRTC). If STREAM_PROXY_TARGET is
   unset the proxy returns 503 with a helpful Bangla message, so the UI can
   show "ক্যামেরা অফলাইন" without crashing.
   ========================================================================== */

export const STREAM_PROXY_TARGET = process.env.STREAM_PROXY_TARGET ?? "";

/**
 * Optional PUBLIC base of the stream edge, e.g. https://stream.bishwasagro.com
 *
 * When set, the player is handed a direct URL to the stream edge and the video
 * bytes never pass through Vercel. That matters on an e-commerce site: Vercel
 * bills Fast Data Transfer ($0.15/GB past 1 TB on Pro) and a handful of
 * all-day premium viewers is enough to cross it — 10 viewers × 24 h ≈ 1.5 TB
 * ≈ $73/month, none of which is product-page traffic.
 *
 * Entitlement is still enforced: the URL carries the same 5-minute signed
 * token, and the edge (Caddy/nginx in front of MediaMTX) can be asked to
 * verify it. Leave this unset and everything keeps flowing through the
 * same-origin proxy exactly as before.
 */
export const STREAM_PUBLIC_BASE = (process.env.STREAM_PUBLIC_BASE ?? "").replace(/\/$/, "");

/**
 * Set STREAM_EDGE_AUTHORIZES_ALL=0 to force every viewer back through the
 * authenticated Vercel proxy.
 *
 * Direct-video mode is only safe when the edge gates EVERY resource — the
 * playlist, the segments, the LL-HLS parts and the keys. Caddyfile and
 * Caddyfile.proxy in this repo now do that (one forward_auth per path), but an
 * operator may be running an older edge, or an nginx config, or something they
 * cannot verify. In that case the honest answer is "do not stream direct":
 * a misconfigured edge serves unauthenticated video to anyone who saves a
 * playlist, which is worse than the bandwidth bill.
 *
 * The default is the safe direction of the *new* behaviour (direct video stays
 * on, because the shipped Caddyfiles are correct and it is the recommended
 * setup), and this switch exists so the decision is one env var, not a code
 * change:
 *
 *   STREAM_EDGE_AUTHORIZES_ALL=0   → everything proxied, always authorised
 */
export function directVideoEnabled(): boolean {
  if (process.env.STREAM_EDGE_AUTHORIZES_ALL === "0") return false;
  return Boolean(STREAM_PUBLIC_BASE);
}

/**
 * Direct-to-edge playback URL for a camera, token included. Empty when direct
 * video is off — the caller then falls back to the same-origin proxy, which
 * authorises every segment (app/api/stream/[...path]).
 */
export function directHlsUrl(streamKey: string, token: string): string {
  if (!directVideoEnabled()) return "";
  return `${STREAM_PUBLIC_BASE}/hls/${encodeURIComponent(streamKey)}/index.m3u8?t=${token}`;
}

/** go2rtc WHEP endpoint used for low-latency WebRTC playback. */
export const GO2RTC_WHEP = process.env.GO2RTC_WHEP_URL ?? "";

/** Optional shared secret for the proxy → MediaMTX hop. */
export const STREAM_ORIGIN_SECRET = process.env.STREAM_PROXY_SECRET ?? "";

export function hlsPath(streamKey: string): string {
  return `/api/stream/hls/${streamKey}/index.m3u8`;
}

export function webrtcPath(streamKey: string): string {
  return `/api/stream/whep/${streamKey}`;
}

/**
 * Where the proxy should forward a camera's request.
 * MediaMTX serves HLS at  /<path>/index.m3u8  (or /<path>/ll-hls/… for LL-HLS)
 * go2rtc  serves WHEP at    /api/webrtc?src=<name>
 */
export function resolveOrigin(camera: Pick<Camera, "protocol">, streamKey: string): string | null {
  if (!STREAM_PROXY_TARGET) return null;
  const base = STREAM_PROXY_TARGET.replace(/\/$/, "");

  if (camera.protocol === "webrtc") {
    if (GO2RTC_WHEP) return `${GO2RTC_WHEP.replace(/\/$/, "")}?src=${encodeURIComponent(streamKey)}`;
    return `${base}/api/webrtc?src=${encodeURIComponent(streamKey)}`;
  }

  // MediaMTX HLS — low-latency variant first, then the classic playlist.
  return `${base}/${encodeURIComponent(streamKey)}/index.m3u8`;
}

/**
 * Health probe used by the admin camera list and the "camera offline" state.
 * Never throws: a network error simply means "offline".
 */
export async function probeCamera(streamKey: string, timeoutMs = 2500): Promise<boolean> {
  if (!STREAM_PROXY_TARGET) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${STREAM_PROXY_TARGET.replace(/\/$/, "")}/${encodeURIComponent(streamKey)}/index.m3u8`;
    const headers: Record<string, string> = {};
    if (STREAM_ORIGIN_SECRET) headers["x-proxy-secret"] = STREAM_ORIGIN_SECRET;

    const res = await fetch(url, { signal: controller.signal, headers, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Human label for the camera zone filter chips. */
export const cameraZones = ["জমি", "গোয়ালঘর", "মুরগিঘর", "পুকুর", "প্যাকিং", "গুদাম"] as const;

/** MediaMTX names must be safe path segments. */
export function safeStreamKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export function streamKeyFrom(slug: string, zone: string, n: number): string {
  return safeStreamKey(`${slug}-${zone}-${String(n).padStart(2, "0")}`);
}
