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

/** The token, from the query string or from inside the forwarded path. */
export function requestedToken(url) {
  const direct = url.searchParams.get("t");
  if (direct) return direct;

  const path = url.searchParams.get("path");
  if (!path || !path.includes("?")) return null;
  return new URLSearchParams(path.split("?")[1]).get("t");
}
