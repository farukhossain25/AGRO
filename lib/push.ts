/* ==========================================================================
   Web Push (VAPID) — no external SDK
   --------------------------------------------------------------------------
   Implements RFC 8291 (aes128gcm) + RFC 8292 (VAPID) with the Web Crypto API
   so it runs on Node and the Edge runtime without extra dependencies.

   Generate keys once:

     npx web-push generate-vapid-keys
     # or:
     node -e "const c=require('crypto');const {privateKey,publicKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});console.log(publicKey.export({type:'spki',format:'der'}).toString('base64url'));console.log(privateKey.export({type:'pkcs8',format:'der'}).toString('base64url'))"

   Then set:
     NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
     VAPID_PRIVATE_KEY=<private>
     VAPID_SUBJECT=mailto:hello@bishwasagro.com
   ========================================================================== */

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type PushPayload = { title: string; body: string; link?: string; kind?: string };

const enc = new TextEncoder();

/** TS 5.7 types Uint8Array over ArrayBufferLike; WebCrypto wants ArrayBuffer. */
const asBuffer = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asBuffer(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/** HKDF-SHA256 (extract + expand) exactly as RFC 8291 §3.3 requires. */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const prkKey = await hmacKey(salt);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, asBuffer(ikm)));

  const out = new Uint8Array(length);
  let t = new Uint8Array(0);
  let offset = 0;
  let counter = 1;

  while (offset < length) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t, 0);
    input.set(info, t.length);
    input[input.length - 1] = counter;

    const stepKey = await hmacKey(prk);
    t = new Uint8Array(await crypto.subtle.sign("HMAC", stepKey, asBuffer(input)));

    const take = Math.min(t.length, length - offset);
    out.set(t.subarray(0, take), offset);
    offset += take;
    counter += 1;
  }
  return out;
}

function vapidKeys() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@bishwasagro.com";
  if (!pub || !priv) return null;
  return { pub, priv, subject };
}

async function vapidAuthHeader(endpoint: string): Promise<string | null> {
  const keys = vapidKeys();
  if (!keys) return null;

  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    enc.encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: keys.subject }))
  );
  const signingInput = `${header}.${payload}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64urlToBytes(keys.priv),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      asBuffer(enc.encode(signingInput))
    )
  );

  return `vapid t=${header}.${payload}.${bytesToB64url(signature)}, k=${keys.pub}`;
}

/** Encrypt the payload for one subscription (aes128gcm). */
async function encryptPayload(sub: PushSubscriptionJSON, payload: PushPayload): Promise<Uint8Array> {
  const plaintext = enc.encode(JSON.stringify(payload));

  const uaPublic = b64urlToBytes(sub.keys.p256dh);
  const authSecret = b64urlToBytes(sub.keys.auth);

  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  const uaKey = await crypto.subtle.importKey(
    "raw",
    asBuffer(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKeys.privateKey, 256)
  );

  // PRK = HKDF(auth_secret, ecdh_secret, "WebPush: info" || ua_public || as_public)
  const keyInfo = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...uaPublic,
    ...serverPublicRaw,
  ]);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = enc.encode("Content-Encoding: nonce\0");

  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  const key = await crypto.subtle.importKey("raw", asBuffer(cek), { name: "AES-GCM" }, false, ["encrypt"]);

  // single record + 0x02 padding delimiter
  const record = new Uint8Array(plaintext.length + 1);
  record.set(plaintext, 0);
  record[plaintext.length] = 2;

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(nonce) }, key, asBuffer(record))
  );

  // aes128gcm content coding header: salt(16) | rs(4) | idlen(1) | keyid
  const header = new Uint8Array(16 + 4 + 1 + serverPublicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = serverPublicRaw.length;
  header.set(serverPublicRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);
  return body;
}

export async function sendPushToSubscription(
  sub: PushSubscriptionJSON,
  payload: PushPayload
): Promise<boolean> {
  try {
    const auth = await vapidAuthHeader(sub.endpoint);
    if (!auth) return false;

    const body = await encryptPayload(sub, payload);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
      },
      body: asBuffer(body),
    });

    return res.ok;
  } catch (error) {
    console.warn("[push] send failed:", (error as Error).message);
    return false;
  }
}

/** Public key the browser needs for pushManager.subscribe(). */
export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
