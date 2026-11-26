import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";

/* ==========================================================================
   Stream access tokens
   --------------------------------------------------------------------------
   Camera credentials (RTSP/IP) NEVER reach the browser. The server mints a
   short-lived JWT that only opens the *proxy* path for one specific camera.
   The proxy then validates the token before talking to MediaMTX/go2rtc.

   Token payload:
     sub  = user id (or "trial:<fingerprint>")
     cam  = camera id
     jti  = stream session id (revocable, also used for the viewer cap)
     mode = premium | trial | public
            public  → a camera the admin marked "সবার জন্য খোলা" (cameras.is_premium
                      = false). No subscription and no trial is involved, so the
                      token carries the whole entitlement it needs: the camera id.
   ========================================================================== */

export const STREAM_TOKEN_TTL = 60 * 5; // 5 minutes — plenty for HLS, short enough to be worthless if leaked

export type StreamTokenPayload = {
  sub: string;
  cam: string;
  jti: string;
  mode: "premium" | "trial" | "public";
  fp?: string;
};

/**
 * Signing key for stream tokens.
 *
 * This is NOT the app session — user sessions are Supabase cookies only. This
 * key only protects the short-lived HLS proxy URL for one camera.
 * `STREAM_TOKEN_SECRET` wins when set; otherwise a stable per-project key is
 * derived from the server-only Supabase credentials, so no extra env var is
 * required and rotating the service key rotates this too.
 */
function secret(): Uint8Array {
  const explicit = process.env.STREAM_TOKEN_SECRET;
  if (explicit && explicit.length >= 16) return new TextEncoder().encode(explicit);

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}|${
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  }`;
  if (base.length < 40) {
    throw new Error("STREAM_TOKEN_SECRET missing (and no Supabase server credentials to derive one)");
  }
  return new Uint8Array(createHash("sha256").update(`stream-token:${base}`).digest());
}

export async function signStreamToken(payload: StreamTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("biswas-agro-stream")
    .setAudience("biswas-agro-player")
    .setExpirationTime(`${STREAM_TOKEN_TTL}s`)
    .sign(secret());
}

export async function verifyStreamToken(token: string | null | undefined): Promise<StreamTokenPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "biswas-agro-stream",
      audience: "biswas-agro-player",
    });
    const p = payload as Record<string, unknown>;
    if (typeof p.cam !== "string" || typeof p.jti !== "string") return null;
    if (p.mode !== "premium" && p.mode !== "trial" && p.mode !== "public") return null;
    return {
      sub: String(p.sub ?? ""),
      cam: p.cam,
      jti: p.jti,
      mode: p.mode,
      fp: typeof p.fp === "string" ? p.fp : undefined,
    };
  } catch {
    return null;
  }
}

/* ==========================================================================
   Refresh tokens (rotation-friendly)
   ========================================================================== */

export type RefreshPayload = { sub: string; role: string; v: number };

export async function signRefreshToken(payload: RefreshPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("biswas-agro")
    .setAudience("biswas-agro-refresh")
    .setExpirationTime("60d")
    .sign(secret());
}

export async function verifyRefreshToken(token: string | undefined): Promise<RefreshPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "biswas-agro",
      audience: "biswas-agro-refresh",
    });
    const p = payload as Record<string, unknown>;
    if (typeof p.sub !== "string") return null;
    return { sub: p.sub, role: String(p.role ?? "customer"), v: Number(p.v ?? 1) };
  } catch {
    return null;
  }
}

/* ==========================================================================
   Device fingerprint
   --------------------------------------------------------------------------
   A server-side hash of (IP + User-Agent + Accept-Language). All three come
   from the request itself; there is deliberately NO client-supplied part.

   There used to be an optional `hint` (screen size + timezone) sent by the
   player, and it was mixed into the trial identity. That made the trial
   trivially resettable: `hint: Math.random()` produced a new fingerprint on
   every request, so the "one free trial" limit was really "one trial per
   page load". Removing it is why this function now has a single argument.

   Still only as strong as IP+UA: a determined user can rotate IPs, which is
   why paid access is enforced by subscription rows, not this hash.
   ========================================================================== */

export function deviceFingerprint(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";
  const lang = req.headers.get("accept-language") ?? "";
  return createHash("sha256")
    .update(`${ip}|${ua}|${lang}`)
    .digest("hex")
    .slice(0, 40);
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip || "0.0.0.0").digest("hex").slice(0, 24);
}

/* ==========================================================================
   Premium access codes — XXXX-XXXX-XXXX (Crockford base32, no I/O/0/1)
   ========================================================================== */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4).join(""), chars.slice(4, 8).join(""), chars.slice(8, 12).join("")].join("-");
}

export function normaliseAccessCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/I/g, "1")
    .replace(/O/g, "0")
    .match(/.{1,4}/g)
    ?.join("-") ?? "";
}
