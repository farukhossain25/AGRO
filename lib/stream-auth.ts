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
     mode = premium | trial
   ========================================================================== */

export const STREAM_TOKEN_TTL = 60 * 5; // 5 minutes — plenty for HLS, short enough to be worthless if leaked

export type StreamTokenPayload = {
  sub: string;
  cam: string;
  jti: string;
  mode: "premium" | "trial";
  fp?: string;
};

function secret(): Uint8Array {
  const value = process.env.STREAM_TOKEN_SECRET ?? process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("STREAM_TOKEN_SECRET / JWT_SECRET missing or too short");
  }
  return new TextEncoder().encode(value);
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
    if (p.mode !== "premium" && p.mode !== "trial") return null;
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
   A server-side hash of (IP + UA + optional client hint). Good enough to stop
   a casual "clear localStorage to reset the trial" loop; a determined user can
   still rotate IPs, which is why paid access is enforced by subscription rows.
   ========================================================================== */

export function deviceFingerprint(req: Request, clientHint?: string): string {
  const ua = req.headers.get("user-agent") ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";
  const lang = req.headers.get("accept-language") ?? "";
  return createHash("sha256")
    .update(`${ip}|${ua}|${lang}|${clientHint ?? ""}`)
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
