import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* ==========================================================================
   TOTP (RFC 6238) — Google Authenticator / Authy compatible
   --------------------------------------------------------------------------
   Self-contained so 2FA works for BOTH auth modes (Supabase Auth users and
   legacy bcrypt accounts) without depending on Supabase's MFA endpoints or a
   browser-held Supabase session.
   ========================================================================== */

const DIGITS = 6;
const PERIOD = 30; // seconds
const ALGORITHM = "sha1";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Generate a 160-bit secret, base32 encoded (what authenticator apps expect). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** The 6-digit code for a given time step. */
export function totpCode(secret: string, timestamp = Date.now(), step = 0): string {
  const counter = Math.floor(timestamp / 1000 / PERIOD) + step;
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = createHmac(ALGORITHM, base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Verify a submitted code, allowing ±1 time step (30 s) of clock drift —
 * roughly what Google Authenticator tolerates.
 */
export function verifyTotp(secret: string, code: string, timestamp = Date.now()): boolean {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== DIGITS || !secret) return false;

  for (const step of [0, -1, 1]) {
    const expected = totpCode(secret, timestamp, step);
    if (
      expected.length === clean.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(clean))
    ) {
      return true;
    }
  }

  return false;
}

/** otpauth:// URI that authenticator apps read from a QR code. */
export function totpUri(opts: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = opts.issuer ?? "Biswas Agro";
  const label = encodeURIComponent(`${issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** One-time recovery codes (shown once, stored hashed). */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-")
  );
}
