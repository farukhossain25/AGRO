/* ==========================================================================
   lib/upstream-guard.ts — what the live proxy is allowed to fetch
   --------------------------------------------------------------------------
   A live channel is a URL the owner pastes, and this server then fetches it.
   That is the definition of an SSRF surface: the interesting targets are not
   public TV stations, they are the things a production box can reach and a
   browser cannot.

     http://169.254.169.254/latest/meta-data/   cloud instance credentials
     http://127.0.0.1:5432/                     a database on the same host
     http://10.0.0.5/admin                     the private network
     file:///etc/passwd                        never a URL `fetch` accepts, but
                                               worth rejecting explicitly

   Before this module the only gate was "type an https URL into the admin
   panel", and the segment path was signed but the DEADLINE was not: a playlist
   that named an internal host would have had that host fetched, with the
   response streamed back to whoever held the token.

   Two layers, because they fail differently:

     isPrivateHost()      name/IP literal checks. Cheap, synchronous, catches
                          the obvious mistakes (a typo'd LAN address, a
                          `localhost` left in a config).
     assertSafeUpstream() used before every fetch of an owner-supplied URL.

   ⚠️ WHAT THIS DOES NOT DO
   It does not resolve DNS. A hostile domain can resolve to 10.0.0.5 after the
   check — defeating that needs resolution-time pinning, which Node's fetch
   does not expose. The practical consequence: this closes the "paste an
   internal URL" hole completely, and the "register a public-looking domain
   that points inward" hole only partially. The remaining exposure requires an
   admin account and a domain the attacker controls, and is bounded by the
   proxy refusing non-HLS bodies.
   ========================================================================== */

/** Hosts (or suffixes) that must never be fetched on a user's behalf. */
const BLOCKED_EXACT = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "0.0.0.0",
  "[::]",
  "[::1]",
  "169.254.169.254", // AWS / GCP / Azure / DigitalOcean metadata
  "fd00:ec2::254", // AWS IMDS over IPv6
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

/** True when an IPv4 literal falls in a range that is not the public internet. */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (m.slice(1).some((part) => Number(part) > 255)) return true; // malformed → refuse

  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local, metadata services
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** IPv6: only the public global-unicast 2000::/3 range is allowed through. */
function isPrivateIpv6(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!bare.includes(":")) return false;
  if (bare === "::" || bare === "::1") return true;
  if (bare.startsWith("fe80")) return true; // link-local
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true; // unique-local
  if (bare.startsWith("ff")) return true; // multicast
  /* ::ffff:10.0.0.1 — an IPv4 address wearing a v6 hat. */
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(bare);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

/**
 * Is this hostname something the proxy must not talk to?
 * A bare hostname (no dot) is refused too: on a VPS it resolves through the
 * host's own search domain, which is precisely where internal services live.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_EXACT.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (isPrivateIpv4(host)) return true;
  if (isPrivateIpv6(`[${host}]`)) return true;
  /* No dot and not an IP: a single-label name ("redis", "db", "metadata"). */
  if (!host.includes(".") && !host.includes(":")) return true;
  return false;
}

export type UpstreamCheck = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Validate an owner-supplied stream URL before the server fetches it.
 * Only https, only a public host, only a sane port.
 */
export function checkUpstreamUrl(raw: string): UpstreamCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "লিংকটি সঠিক নয়" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "লিংকটি https:// হতে হবে" };
  }
  if (url.username || url.password) {
    /* Credentials in the URL end up in logs and in the signed segment path. */
    return { ok: false, reason: "লিংকে ইউজারনেম/পাসওয়ার্ড রাখা যাবে না" };
  }
  if (url.port && url.port !== "443") {
    return { ok: false, reason: "শুধু ৪৪৩ পোর্টে (স্বাভাবিক https) স্ট্রিম চলবে" };
  }
  if (isPrivateHost(url.hostname)) {
    return { ok: false, reason: "এই ঠিকানায় স্ট্রিম করা যাবে না (ভেতরের নেটওয়ার্ক)" };
  }
  return { ok: true, url };
}
