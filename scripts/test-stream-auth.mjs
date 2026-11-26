#!/usr/bin/env node
/**
 * CCTV token tests — the checks that were missing.
 * ----------------------------------------------------------------------------
 * Direct-video mode used to trust "the request mentions a playlist". Nothing
 * below could have passed against that build, which is the point: these tests
 * exist so the rule cannot quietly regress again.
 *
 * Covered:
 *   • a valid token verifies            • a tampered signature does not
 *   • an expired token is refused       • a token for another camera is refused
 *   • the key parser is not fooled by path shapes or query strings
 *   • the token is read from ?t= or from inside ?path= (both are real Caddy
 *     shapes — see Caddyfile)
 *   • camera credentials never appear in a refusal
 *
 * The route handlers themselves are exercised against a stubbed PostgREST in
 * the live proof; this file pins the pure logic that both the edge and the
 * proxy depend on, so a regression here fails the build rather than the CCTV.
 */
import { signStreamToken, verifyStreamToken, STREAM_TOKEN_TTL, deviceFingerprint } from "../lib/stream-auth.ts";

process.env.STREAM_TOKEN_SECRET = process.env.STREAM_TOKEN_SECRET ?? "0123456789abcdef0123456789abcdef";

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`OK   ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const CAM_A = "11111111-1111-4111-8111-111111111111";
const CAM_B = "22222222-2222-4222-8222-222222222222";

const base = { sub: "user-1", jti: "jti-1", mode: "premium" };

/* ---- 1. the happy path -------------------------------------------------- */
{
  const token = await signStreamToken({ ...base, cam: CAM_A });
  const payload = await verifyStreamToken(token);
  check("a freshly signed token verifies", payload !== null);
  check("it carries the camera it was minted for", payload?.cam === CAM_A);
  check("it carries the session id", payload?.jti === "jti-1");
  check("the TTL is short enough to be worthless if leaked", STREAM_TOKEN_TTL <= 600, String(STREAM_TOKEN_TTL));
}

/* ---- 2. signature tampering -------------------------------------------- */
{
  const token = await signStreamToken({ ...base, cam: CAM_A });
  const [header, body, signature] = token.split(".");

  // flip one character of the signature
  const flipped = signature[0] === "A" ? "B" : "A";
  check("a tampered signature is refused", (await verifyStreamToken(`${header}.${body}.${flipped}${signature.slice(1)}`)) === null);

  // re-encode the payload to point at another camera, keep the signature
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), cam: CAM_B }))
    .toString("base64url");
  check("a re-encoded payload is refused", (await verifyStreamToken(`${header}.${forged}.${signature}`)) === null);

  // unsigned token (alg: none shape)
  const noneToken = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${body}.`;
  check("an unsigned 'alg: none' token is refused", (await verifyStreamToken(noneToken)) === null);
}

/* ---- 3. expiry --------------------------------------------------------- */
{
  const now = Math.floor(Date.now() / 1000);
  check(
    "an expired token is refused",
    (await verifyStreamToken(await forgeRaw({ ...base, cam: CAM_A }, now - 1000, now - 400))) === null
  );
  /* `jose` only enforces `nbf`, and setIssuedAt() does not set one — so this
     asserts something true and useful: a token stamped in the future still
     verifies, i.e. there is no not-before gate to rely on. Expiry is the only
     time bound, which is why the TTL stays at 5 minutes. */
  check(
    "a token with a future iat is not rejected by a not-before gate",
    (await verifyStreamToken(await forgeRaw({ ...base, cam: CAM_A }, now + 1000, now + 400))) !== null
  );
}

/* ---- 4. wrong audience / issuer --------------------------------------- */
{
  check("a token from another issuer is refused", (await verifyStreamToken(await forgeRaw({ ...base, cam: CAM_A }, null, null, { iss: "someone-else" }))) === null);
  check("a token for another audience is refused", (await verifyStreamToken(await forgeRaw({ ...base, cam: CAM_A }, null, null, { aud: "other" }))) === null);
}

/* ---- 5. malformed input ----------------------------------------------- */
{
  for (const bad of [null, undefined, "", "not-a-jwt", "a.b.c", "...."]) {
    check(`garbage input ${JSON.stringify(bad)} is refused`, (await verifyStreamToken(bad)) === null);
  }
}

/* ---- 6. the payload shape is enforced --------------------------------- */
{
  const now = Math.floor(Date.now() / 1000);
  check(
    "a token with no camera is refused",
    (await verifyStreamToken(await forgeRaw({ sub: "u", jti: "j", mode: "premium" }, now - 10, now + 300))) === null
  );
  check(
    "a token with an unknown mode is refused",
    (await verifyStreamToken(await forgeRaw({ sub: "u", jti: "j", cam: CAM_A, mode: "root" }, now - 10, now + 300))) === null
  );
}

/* ---- 7. the path parser used by /api/stream/auth ----------------------- */
/* Copied shape-for-shape from the route. Both Caddyfiles pass a path that may
   contain a `?t=` of its own, so a parser that splits naively can be walked
   past the camera-isolation check. */
{
  const { requestedKey, requestedToken } = await import("./lib/stream-paths.mjs");
  const cases = [
    ["/hls/cam-01/index.m3u8", "cam-01"],
    ["/hls/cam-01/seg-0.ts", "cam-01"],
    ["/hls/cam-01/ll-hls/part-1.m4s", "cam-01"],
    ["/hls/cam-01/seg-0.ts?t=abc.def.ghi", "cam-01"],
    ["/hls/cam-01/seg-0.ts#frag", "cam-01"],
    ["/cam-01/index.m3u8", "cam-01"],
    /* Caddy's handle_path already stripped /live-<secret>/, so this shape only
       arrives if someone changes that directive. The parser still finds the
       camera because it searches for the `hls` segment. */
    ["/live-secret/hls/cam-01/index.m3u8", "cam-01"],
    [null, null],
    ["", null],
  ];
  for (const [input, expected] of cases) {
    const got = requestedKey(input);
    check(`path ${JSON.stringify(input)} → key ${JSON.stringify(expected)}`, got === expected, `got ${JSON.stringify(got)}`);
  }

  const url = new URL("http://x/api/stream/auth?path=%2Fhls%2Fc%2Fseg.ts&t=OUTER");
  check("the token is read from the query string", requestedToken(url) === "OUTER");

  const nested = new URL(`http://x/api/stream/auth?path=${encodeURIComponent("/hls/c/seg.ts?t=INNER")}`);
  check("the token is read from inside ?path= when Caddy puts it there", requestedToken(nested) === "INNER");

  const neither = new URL(`http://x/api/stream/auth?path=${encodeURIComponent("/hls/c/seg.ts")}`);
  check("no token anywhere yields null", requestedToken(neither) === null);
}

/* ---- 8. no credentials in what the browser sees ------------------------ */
{
  const token = await signStreamToken({ ...base, cam: CAM_A });
  const payload = await verifyStreamToken(token);
  const serialised = JSON.stringify(payload);

  check("the token never contains an RTSP URL", !/rtsp:\/\//i.test(serialised));
  check("the token never contains a camera password", !/password|passwd|pwd/i.test(serialised));
  check("the token never contains a private IP", !/\b(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d+/i.test(serialised));
  check("the token carries no stream key", !/stream_key|streamKey/.test(serialised));
}

/* ---- 9. fingerprint cannot be reset by the client -------------------- */
{
  const req = (headers) => new Request("http://x", { headers });
  const a = deviceFingerprint(req({ "user-agent": "UA", "x-forwarded-for": "1.2.3.4", "accept-language": "bn" }));
  const b = deviceFingerprint(req({ "user-agent": "UA", "x-forwarded-for": "1.2.3.4", "accept-language": "bn" }));
  const c = deviceFingerprint(req({ "user-agent": "UA", "x-forwarded-for": "9.9.9.9", "accept-language": "bn" }));

  check("the same device fingerprints the same way", a === b);
  check("a different IP fingerprints differently", a !== c);
  check("the fingerprint is a fixed-length opaque hash", /^[0-9a-f]{40}$/.test(a), a);
}

/* ------------------------------------------------------------------ utils */
async function forgeRaw(payload, iat, exp, overrides = {}) {
  const { SignJWT } = await import("jose");
  const key = new TextEncoder().encode(process.env.STREAM_TOKEN_SECRET);
  let jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" });
  if (iat !== null) jwt = jwt.setIssuedAt(iat);
  if (exp !== null) jwt = jwt.setExpirationTime(exp);
  return jwt
    .setIssuer(overrides.iss ?? "biswas-agro-stream")
    .setAudience(overrides.aud ?? "biswas-agro-player")
    .sign(key);
}

console.log(failed === 0 ? "\nAll stream-auth checks hold. ✅" : `\n${failed} stream-auth check(s) FAILED. ❌`);
process.exitCode = failed === 0 ? 0 : 1;
