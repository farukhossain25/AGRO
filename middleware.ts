import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/* ==========================================================================
   middleware.ts — edge guards
   --------------------------------------------------------------------------
   Two jobs, both cheap enough for the edge:

   1. /admin/** gate (section F). A fast JWT check so a signed-out or
      customer session never reaches an admin render. The (protected) layout
      and every /api/admin route re-verify against the database, which stays
      authoritative — this is defence in depth, not the boundary.

   2. A per-request CSP nonce (section G). Next injects the nonce into its own
      bootstrap scripts, so the policy can drop 'unsafe-inline' for
      script-src. Style-src keeps 'unsafe-inline' because Next and Tailwind
      both emit inline style attributes, and nonces do not apply to those.
      The header set in next.config.ts omits CSP when this runs (middleware
      wins), so the two never contradict each other.
   ========================================================================== */

const ADMIN_COOKIE = "ba_admin";
const SESSION_COOKIE = "ba_session";

/** Roles allowed into /admin. Keep in step with lib/permissions.ts STAFF_ROLES. */
const STAFF_ROLES = new Set(["staff", "manager", "admin"]);

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me-please-32"
  );
}

type Verdict = "staff" | "other" | "none";

async function check(token: string | undefined): Promise<Verdict> {
  if (!token) return "none";
  try {
    const { payload } = await jwtVerify(token, secret());
    return STAFF_ROLES.has(String(payload.role)) ? "staff" : "other";
  } catch {
    return "none"; // expired or tampered → treat as signed out
  }
}

/** Build the CSP for one request. `nonce` is unique per response. */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const supabase = "https://lyihdzgmtjkkhybpkqot.supabase.co";
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonce'd Next bootstrap load the rest of the
    // chunks without listing every one. No 'unsafe-inline' outside dev.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    `img-src 'self' data: blob: ${supabase} https://images.unsplash.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} wss://lyihdzgmtjkkhybpkqot.supabase.co https://vitals.vercel-insights.com https://*.tile.openstreetmap.org https://www.googletagmanager.com https://*.google-analytics.com`,
    `media-src 'self' blob: ${supabase}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://www.google.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  // ---- 1. admin gate (only for /admin, and not for the login screen itself)
  if (pathname.startsWith("/admin")) {
    const store = req.cookies;
    const adminToken = store.get(ADMIN_COOKIE)?.value;
    const sessionToken = store.get(SESSION_COOKIE)?.value;

    const adminVerdict = await check(adminToken);
    const sessionVerdict = adminVerdict === "staff" ? "staff" : await check(sessionToken);

    if (pathname === "/admin/login") {
      if (sessionVerdict === "staff") return NextResponse.redirect(new URL("/admin", req.url));
    } else if (sessionVerdict === "other") {
      // Signed in but not staff → hard "Access denied".
      const url = new URL("/forbidden", req.url);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    } else if (sessionVerdict !== "staff") {
      const url = new URL("/admin/login", req.url);
      if (pathname !== "/admin") url.searchParams.set("next", pathname);
      const res = NextResponse.redirect(url);
      if (adminToken) res.cookies.delete(ADMIN_COOKIE);
      return res;
    }
  }

  // ---- 2. per-request CSP nonce
  // Only HTML documents need it; skipping API/static responses keeps the edge
  // cost near zero and avoids caching a nonce against a static asset.
  const needsCsp =
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !/\.(?:png|jpe?g|svg|webp|avif|ico|woff2?|txt|xml|webmanifest|json)$/i.test(pathname);

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (needsCsp) {
    res.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
  }
  return res;
}

export const config = {
  // Everything except static assets — the admin gate is inside the handler, so
  // adding root coverage for CSP costs nothing extra.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|images/|splash/).*)",
  ],
};
