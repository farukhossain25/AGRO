/**
 * The path/token parsers used by /api/stream/auth.
 *
 * They live in their own module because the edge (Caddy) hands that route two
 * different shapes and both are security-relevant:
 *
 *   1. `?path=/hls/<key>/<file>`             — the direct edge, where Caddy has
 *                                              already stripped the secret prefix
 *   2. `?path=/hls/<key>/<file>?t=<token>`   — the same, but the requested URI
 *                                              carried its own query string
 *
 * A parser that split on "/" without trimming the query would compare the
 * camera-isolation check against "<key>" only by luck, and one that ignored the
 * second shape would reject every segment. `scripts/test-stream-auth.mjs`
 * exercises both, so a rewrite here has to keep the contract.
 */

/** The sub-path the edge is about to serve, e.g. /hls/dvr-cam-01/index.m3u8. */
export function requestedKey(path) {
  if (!path) return null;
  const clean = path.split("#")[0].split("?")[0];
  const segments = clean.split("/").filter(Boolean);
  const hls = segments.indexOf("hls");
  const key = hls >= 0 ? segments[hls + 1] : segments[0];
  return key ? decodeURIComponent(key) : null;
}

/**
 * The token, from every place the edge may legitimately put it — and nowhere
 * else.
 *
 * Two transports exist, and both are real:
 *
 *   1. `?t=` in the request the edge forwards. The direct edge passes
 *      `{http.request.uri}` through, so a playlist arrives as
 *      `?path=/hls/<key>/index.m3u8?t=…` and the token is INSIDE `path`. A
 *      browser hitting the auth route directly puts it in the outer query.
 *   2. `X-Stream-Token` — the Vercel proxy (app/api/stream/[...path]) strips
 *      the token from the upstream URL and sends it as a header instead. The
 *      proxy edge must still authorise every segment, so the header is the
 *      only place left for it to arrive.
 *
 * The header is NOT trusted for being present. It is signed, short-lived and
 * bound to a session row and one camera, exactly like the query-string form —
 * `verifyStreamToken()` plus the two database reads decide. Passing a header is
 * only a way to *transport* a credential, never a way to prove one.
 *
 * An empty or whitespace-only header is treated as absent, so a caller cannot
 * short-circuit the query-string path with `X-Stream-Token: ""`.
 *
 * `headers` is optional so the existing call sites and tests keep working; the
 * route always passes the real request headers.
 */
export function requestedToken(url, headers) {
  const direct = url.searchParams.get("t");
  if (direct) return direct;

  const path = url.searchParams.get("path");
  if (path && path.includes("?")) {
    const nested = new URLSearchParams(path.split("?")[1]).get("t");
    if (nested) return nested;
  }

  /* Header last: it is the one transport that carries no structural hint about
     which camera was meant, so the URL shapes get first say. */
  const header = headers?.get?.("x-stream-token")?.trim();
  return header || null;
}

/**
 * True when a token arrived in a header rather than the URL.
 *
 * Used only to decide how loudly to log a refusal — the token itself is never
 * logged either way, and the answer does not affect authorization.
 */
export function tokenCameFromHeader(url, headers) {
  if (url.searchParams.get("t")) return false;
  const path = url.searchParams.get("path");
  if (path && path.includes("?") && new URLSearchParams(path.split("?")[1]).get("t")) return false;
  return Boolean(headers?.get?.("x-stream-token")?.trim());
}
