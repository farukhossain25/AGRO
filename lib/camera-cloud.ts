import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { checkUpstreamUrl as checkDirectUpstream } from "./upstream-guard";

/* ==========================================================================
   Camera cloud bridge — play a seller's camera without any server of ours
   --------------------------------------------------------------------------
   A seller installs the camera with the phone app it ships with (Imou Life,
   EZVIZ, the Dahua/Hikvision app…) and that app already makes the feed
   reachable from anywhere. We reuse exactly the same cloud:

     seller's phone app ──► vendor cloud ──► this server ──► buyer's browser
                                   ▲
                             (signed API call,
                              credentials in Vercel env)

   No VPS, no laptop left running at the farm, no port forwarded on the router,
   and no RTSP address ever reaches a browser.

   Three providers are supported:

     hls    play `cameras.stream_url` as-is (an ALREADY-PUBLIC https .m3u8)
     tv     same URL, but pointed at a free/open TV channel instead of a camera
     imou   Imou Life Open Platform   (open.imoulife.com)
     ezviz  EZVIZ Open Platform       (open.ys7.com / iusopen.ezvizlife.com)

   `hls` vs `tv` is a LABEL, not a different transport: both fetch a playlist
   URL the owner pasted and re-serve it through this server. The label exists
   because a channel and a camera answer the same question differently — a TV
   channel has no vendor quota, no viewer cap and no subscription, and the UI
   says "লাইভ টিভি" instead of "খামারের ক্যামেরা". Keeping them apart in the data
   means switching a farm from a test channel to a real camera later is an edit
   in the admin panel, not a redeploy.

   Every call is signed server-side: the AppSecret never leaves this module, and
   the HLS URL we hand to the browser points at OUR proxy, not at the vendor.
   ========================================================================== */

export type CloudProvider = "none" | "hls" | "tv" | "imou" | "ezviz";

export type CloudCamera = {
  id: string;
  cloud_provider: string;
  cloud_serial: string | null;
  cloud_channel: number | null;
  stream_url: string | null;
};

/** What the player needs: a same-origin URL plus a human hint about latency. */
export type CloudPlayback = {
  /** Path under /api/cam/live/<id>… that the browser plays. */
  path: string;
  /** "hls" for everything we support today. */
  protocol: "hls";
};

export function cloudBridgeReady(): boolean {
  const imou = Boolean(process.env.IMOU_APP_ID && process.env.IMOU_APP_SECRET);
  const ezviz = Boolean(process.env.EZVIZ_APP_KEY && process.env.EZVIZ_APP_SECRET);
  return imou || ezviz || Boolean(process.env.CAM_ALLOW_DIRECT_HLS);
}

/* ------------------------------------------------------------------ secrets */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new CloudError(`${name} সেট করা নেই`, "config");
  return value;
}

export class CloudError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "auth" | "device" | "upstream" | "not-ready" = "upstream"
  ) {
    super(message);
    this.name = "CloudError";
  }
}

/* ------------------------------------------------------------- Imou (life) */
/*
 * Docs: https://open.imoulife.com/book/http/develop.html
 *   sign = md5("time:<ts>,nonce:<uuid>,appSecret:<secret>")
 *   POST https://openapi-sg.easy4ip.com/openapi/<method>
 *   body: { system: { ver, appId, sign, time, nonce }, id, params }
 *
 * Region matters: a Singapore account on the Frankfurt host returns an empty
 * device list. Bangladesh accounts live on the Singapore data centre.
 */

const IMOU_HOST =
  process.env.IMOU_API_HOST?.replace(/\/$/, "") ?? "https://openapi-sg.easy4ip.com";

type ImouSystem = { ver: "1.0"; appId: string; sign: string; time: number; nonce: string };

type ImouResponse<T> = {
  result?: { code?: string; msg?: string; data?: T };
  id?: string;
};

let imouToken: { value: string; expires: number } | null = null;

function imouSign(time: number, nonce: string, secret: string): string {
  return createHash("md5").update(`time:${time},nonce:${nonce},appSecret:${secret}`).digest("hex");
}

async function imouCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const appId = env("IMOU_APP_ID");
  const secret = env("IMOU_APP_SECRET");

  const time = Math.floor(Date.now() / 1000);
  const nonce = randomUUID();
  const system: ImouSystem = { ver: "1.0", appId, sign: imouSign(time, nonce, secret), time, nonce };

  const res = await fetch(`${IMOU_HOST}/openapi/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system, id: randomUUID(), params }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) throw new CloudError("Imou ক্লাউডে পৌঁছানো যাচ্ছে না", "upstream");

  const json = (await res.json().catch(() => null)) as ImouResponse<T> | null;
  const code = json?.result?.code;

  if (!res.ok || code !== "0" || json?.result?.data === undefined) {
    const msg = json?.result?.msg ?? `HTTP ${res.status}`;
    // TK1002 = expired access token → mint a new one and retry once.
    if (code === "TK1002") {
      imouToken = null;
      return imouCall<T>(method, params);
    }
    throw new CloudError(`Imou: ${msg}`, code?.startsWith("TK") ? "auth" : "upstream");
  }

  return json.result.data as T;
}

/** 3-day administrator token, cached in memory (fine for a warm serverless fn). */
async function imouAccessToken(): Promise<string> {
  if (imouToken && imouToken.expires > Date.now() + 60_000) return imouToken.value;

  const data = await imouCall<{ accessToken: string; expireTime: number }>("accessToken", {});
  // expireTime is an absolute epoch in seconds on some firmware and a duration
  // on others — treat anything below 10^10 as a duration.
  const raw = Number(data.expireTime) || 0;
  const expires = raw > 10_000_000_000 ? raw : Date.now() + raw * 1000;
  imouToken = { value: data.accessToken, expires };
  return data.accessToken;
}

type ImouLiveInfo = {
  liveType?: number;
  liveStatus?: number;
  streams?: { hls?: string; streamId?: number; liveToken?: string; status?: string }[];
};

/**
 * Ask Imou for the device's live address.
 *
 * Two-step by design: `bindDeviceLive` opens the channel (some accounts only
 * get an address after this call), then `getLiveStreamInfo` returns the HLS
 * URLs. The SD stream (streamId 1) is the one a phone on mobile data can
 * actually afford; we prefer it and fall back to HD.
 */
/**
 * Which Imou stream to serve: 0 = HD main, 1 = SD sub.
 *
 * Default is the SD sub-stream because a phone on mobile data is what most
 * visitors use. A Dahua XVR/NVR is the exception: its sub-stream can be as
 * small as CIF 352×288 @ 7 fps, which is unusable on a product page — those
 * recorders need IMOU_STREAM_ID=0.
 */
function imouPreferredStream(): 0 | 1 {
  return Number(process.env.IMOU_STREAM_ID ?? 1) === 0 ? 0 : 1;
}

async function imouLiveUrl(camera: CloudCamera): Promise<string> {
  const token = await imouAccessToken();
  const serial = camera.cloud_serial;
  if (!serial) throw new CloudError("এই ক্যামেরার সিরিয়াল নম্বর দেওয়া নেই", "device");

  const channelId = String(camera.cloud_channel ?? 0);
  const wantStream = imouPreferredStream();

  await imouCall("bindDeviceLive", { deviceId: serial, channelId, streamId: wantStream, token }).catch(
    () => null // already bound is a normal answer; getLiveStreamInfo below is the real test
  );

  const info = await imouCall<ImouLiveInfo>("getLiveStreamInfo", {
    deviceId: serial,
    channelId,
    token,
  });

  const streams = info.streams ?? [];
  const playable = (id: number) =>
    streams.find((s) => s.streamId === id && /^https?:/i.test(s.hls ?? ""));
  // Ask for the configured stream first, then fall back to whatever the
  // vendor did publish — a recorder often only returns the stream we bound.
  const pick = playable(wantStream) ?? playable(0) ?? playable(1) ??
    streams.find((s) => /^https?:/i.test(s.hls ?? ""));

  if (!pick?.hls) throw new CloudError("ক্যামেরাটি এখন লাইভ দিচ্ছে না", "device");
  return pick.hls;
}

/* ---------------------------------------------------------------- EZVIZ */
/*
 * Docs: https://open.ys7.com/help/en/534
 *   POST /api/lapp/token/get        form: appKey, appSecret
 *   POST /api/lapp/live/address/get form: accessToken, deviceSerial,
 *                                        channelNo, protocol=2 (HLS), quality
 *
 * The response `data.url` is an HLS playlist; it is time-limited, so we fetch
 * it lazily on every playback start and never store it.
 */

const EZVIZ_HOST = process.env.EZVIZ_API_HOST?.replace(/\/$/, "") ?? "https://openapi.ys7.com";

let ezvizToken: { value: string; expires: number } | null = null;

type EzvizEnvelope<T> = { code?: string; msg?: string; data?: T };

async function ezvizPost<T>(path: string, form: Record<string, string>): Promise<T> {
  const res = await fetch(`${EZVIZ_HOST}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  }).catch(() => null);

  if (!res) throw new CloudError("EZVIZ ক্লাউডে পৌঁছানো যাচ্ছে না", "upstream");

  const json = (await res.json().catch(() => null)) as EzvizEnvelope<T> | null;
  if (!res.ok || json?.code !== "200" || json.data === undefined) {
    const msg = json?.msg ?? `HTTP ${res.status}`;
    if (json?.code === "10002") {
      ezvizToken = null;
      throw new CloudError(`EZVIZ: ${msg}`, "auth");
    }
    throw new CloudError(`EZVIZ: ${msg}`, "upstream");
  }
  return json.data as T;
}

async function ezvizAccessToken(): Promise<string> {
  if (ezvizToken && ezvizToken.expires > Date.now() + 60_000) return ezvizToken.value;

  const data = await ezvizPost<{ accessToken: string; expireTime: number }>("/api/lapp/token/get", {
    appKey: env("EZVIZ_APP_KEY"),
    appSecret: env("EZVIZ_APP_SECRET"),
  });

  const raw = Number(data.expireTime) || Date.now() + 6 * 24 * 3600 * 1000;
  ezvizToken = { value: data.accessToken, expires: raw };
  return data.accessToken;
}

async function ezvizLiveUrl(camera: CloudCamera): Promise<string> {
  const accessToken = await ezvizAccessToken();
  const serial = camera.cloud_serial;
  if (!serial) throw new CloudError("এই ক্যামেরার সিরিয়াল নম্বর দেওয়া নেই", "device");

  const data = await ezvizPost<{ url?: string }>("/api/lapp/live/address/get", {
    accessToken,
    deviceSerial: serial,
    channelNo: String(camera.cloud_channel || 1),
    protocol: "2", // 2 = HLS
    quality: "2", // 2 = fluent / sub-stream — kinder to mobile data
    type: "1", // live preview
    expireTime: "86400",
  });

  if (!data.url) throw new CloudError("ক্যামেরাটি এখন লাইভ দিচ্ছে না", "device");
  return data.url;
}

/* --------------------------------------------------------------- public API */

/**
 * Resolve the upstream HLS playlist for a cloud camera.
 *
 * Called on every `/api/cam/live/<id>/index.m3u8`, so it must be cheap:
 * tokens are cached, the vendor call is a single POST, and nothing is stored.
 */
export async function resolveCloudHls(camera: CloudCamera): Promise<{ url: string; origin: string }> {
  const provider = (camera.cloud_provider || "none") as CloudProvider;

  if (provider === "hls" || provider === "tv") {
    const raw = camera.stream_url ?? "";
    if (!/^https:\/\//i.test(raw)) {
      throw new CloudError(
        provider === "tv"
          ? "চ্যানেলের লিংক সঠিক নয় (https দিয়ে শুরু হতে হবে)"
          : "এই ক্যামেরার স্ট্রিম লিংক সঠিক নয় (https দিয়ে শুরু হতে হবে)",
        "device"
      );
    }
    /* `.m3u` (a channel LIST) resolves to its first HLS entry; `.m3u8` is
       already a stream and comes back unchanged. The result is cached by the
       caller, so a multi-hundred-entry IPTV list is fetched once per TTL, not
       once per playlist refresh. */
    const url = await resolvePlaylistUrl(raw);
    return { url, origin: new URL(url).origin };
  }

  if (provider === "imou") {
    const url = await imouLiveUrl(camera);
    return { url, origin: new URL(url).origin };
  }

  if (provider === "ezviz") {
    const url = await ezvizLiveUrl(camera);
    return { url, origin: new URL(url).origin };
  }

  throw new CloudError("এই ক্যামেরাটি ক্লাউড ব্রিজে সেট করা নেই", "config");
}


/* ------------------------------------------------------- .m3u (multi-channel) */
/**
 * Resolve a pasted .m3u playlist to ONE playable .m3u8.
 *
 * `.m3u8` is HLS — index it and play. `.m3u` is not a stream: it is a LIST of
 * channels, the format every "open source TV" playlist on the internet uses
 * (IPTV-org, public broadcaster lists, an owner's own export from VLC). A
 * seller or the owner pastes one line and reasonably expects a picture.
 *
 * What this does is pick the first entry that is itself an HLS playlist, so a
 * playlist of RTSP or YouTube links fails with a Bangla explanation instead of
 * a timeout. It is a deliberate "first working channel" rule, not a channel
 * picker: one camera row = one visible channel, which is the mental model the
 * admin form already teaches. Multiple channels = multiple rows, each with its
 * own .m3u8.
 *
 * The playlist bytes are fetched HERE, server-side, with a hard deadline and no
 * credentials: a URL that hangs must not hold a page render (see
 * lib/read-deadline.ts for what that cost before).
 */
const M3U_LIMIT_BYTES = 512 * 1024;

export async function resolvePlaylistUrl(raw: string): Promise<string> {
  const trimmed = raw.trim();

  /* SSRF gate: the server is about to fetch this. See lib/upstream-guard.ts
     for why a pasted URL is not automatically a public one. */
  const allowed = checkDirectUpstream(trimmed);
  if (!allowed.ok) throw new CloudError(allowed.reason, "device");

  /* Already a stream: nothing to resolve. */
  if (/\.m3u8(\?|#|$)/i.test(trimmed)) return trimmed;

  if (!/\.m3u(\?|#|$)/i.test(trimmed)) {
    throw new CloudError("লিংকটি .m3u8 (স্ট্রিম) বা .m3u (চ্যানেল তালিকা) হতে হবে", "device");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("playlist read timed out")), 6000);
  let text = "";
  try {
    const res = await fetch(trimmed, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "BiswasAgro-Playlist/1.0" },
    });
    if (!res.ok) throw new CloudError(`চ্যানেল তালিকা পড়া যায়নি (${res.status})`, "upstream");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > M3U_LIMIT_BYTES) throw new CloudError("চ্যানেল তালিকা খুব বড়", "upstream");
    text = (await res.text()).slice(0, M3U_LIMIT_BYTES);
  } catch (error) {
    if (error instanceof CloudError) throw error;
    throw new CloudError("চ্যানেল তালিকা লোড হয়নি — লিংক ও ইন্টারনেট দেখুন", "upstream");
  } finally {
    clearTimeout(timer);
  }

  const base = trimmed.replace(/[^/]*$/, "");
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const absolute = /^https?:\/\//i.test(value) ? value : new URL(value, base).toString();
    /* HLS only: an .m3u of rtsp:// or youtube.com links is not something this
       proxy can play, and pretending otherwise produces a spinner, not a
       picture. */
    if (/\.m3u8(\?|#|$)/i.test(absolute)) return absolute;
  }

  throw new CloudError("তালিকায় কোনো HLS (.m3u8) চ্যানেল পাওয়া যায়নি", "device");
}

/* --------------------------------------------------------- playlist cache */
/*
 * HLS players re-fetch the playlist every few seconds while a stream is open —
 * hls.js does it on every segment boundary. Each of those hits used to call the
 * vendor (bindDeviceLive + getLiveStreamInfo), and the Imou Open Platform bills
 * the App ID: 30,000 requests and 2 GB of media flow per month, then
 * $0.02/10,000 calls and $0.25/GB. One viewer for one hour would burn ~1,200 of
 * those calls; ten viewers would exhaust the month in a single afternoon and the
 * stream would die with LV1003 / FL1004 ("insufficient traffic").
 *
 * A resolved vendor URL is stable for far longer than a few seconds, so we hold
 * it briefly. This is a cache in ONE serverless instance only — it is a saving,
 * not a correctness guarantee, and it never serves a dead URL for long.
 */
const PLAYLIST_TTL_MS = Number(process.env.CAM_PLAYLIST_TTL_MS ?? 20_000);

// Keyed by camera + the fields that change the answer, so re-pointing a camera
// in the admin panel takes effect on the next request instead of minutes later.
const playlistCache = new Map<string, { url: string; origin: string; expires: number }>();

function playlistKey(camera: CloudCamera): string {
  return [
    camera.id,
    camera.cloud_provider,
    camera.cloud_serial ?? "",
    camera.cloud_channel ?? "",
    camera.stream_url ?? "",
  ].join("|");
}

export async function resolveCloudHlsCached(
  camera: CloudCamera
): Promise<{ url: string; origin: string }> {
  const key = playlistKey(camera);
  const hit = playlistCache.get(key);
  if (hit && hit.expires > Date.now()) return { url: hit.url, origin: hit.origin };

  const resolved = await resolveCloudHls(camera);

  // Bound the map: a serverless instance serves a handful of cameras, but never
  // let a pathological caller grow it without limit.
  if (playlistCache.size > 200) playlistCache.clear();
  playlistCache.set(key, { ...resolved, expires: Date.now() + PLAYLIST_TTL_MS });
  return resolved;
}

/* ------------------------------------------------- signed segment addresses */
/*
 * A playlist lists segments on the vendor's CDN. We rewrite each one to go
 * through /api/cam/live/<id>/seg/<host>?u=<absolute>&s=<signature>.
 *
 * The `s` value is what makes the segment endpoint safe: HMAC-SHA256 over
 * "cameraId|absoluteUrl" using a server-only key. Without it, `?u=` would be an
 * open relay (anyone could point the endpoint at 169.254.169.254 or an internal
 * 10.x host and read the response), because a base64 origin is computable by
 * anyone. With it, only URLs that appeared in a playlist we fetched ourselves
 * can be retrieved.
 */

function signingKey(): Uint8Array {
  const explicit = process.env.STREAM_TOKEN_SECRET;
  if (explicit && explicit.length >= 16) return new TextEncoder().encode(`cam-seg:${explicit}`);

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}|${
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  }`;
  if (base.length < 40) throw new CloudError("স্ট্রিম কী কনফিগার করা নেই", "config");
  return new Uint8Array(createHash("sha256").update(`cam-seg:${base}`).digest());
}

export function signSegment(cameraId: string, absolute: string): string {
  return createHmac("sha256", signingKey()).update(`${cameraId}|${absolute}`).digest("base64url");
}

export function verifySegment(cameraId: string, absolute: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signSegment(cameraId, absolute);
  // constant-time compare — the values are short but there is no reason not to
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** The browser-facing playlist path — same origin, token in the query string. */
export function cloudPlaybackPath(cameraId: string): string {
  return `/api/cam/live/${cameraId}/index.m3u8`;
}
