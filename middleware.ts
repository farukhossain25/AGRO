import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_BASE, ADMIN_LOGIN_PATH, LEGACY_ADMIN_BASE } from "@/lib/paths";

/* ==========================================================================
   middleware.ts — edge guards
   --------------------------------------------------------------------------
   Three jobs, all cheap enough for the edge:

   1. Admin gate. The panel lives at `/{ADMIN_PATH}` (default /foisal), read
      from env through lib/paths.ts. A signed-out or customer session never
      reaches an admin render. The (protected) layout and every API route
      re-verify against the database, which stays authoritative — this is
      defence in depth, not the boundary.

   2. /admin must NOT exist. The brief asks for a plain 404 with no redirect
      and no hint. We rewrite to a path that has no route, rather than
      redirecting to /404, because a redirect would itself be a signal.

   3. A per-request CSP nonce. Next injects the nonce into its own bootstrap
      scripts, so the policy can drop 'unsafe-inline' for script-src.

   Idle logout is enforced in two places: the admin cookie carries a 12-hour
   absolute TTL (set at login), and `ba_admin_active` records the last seen
   time so client code can warn before the session dies.
   ========================================================================== */

const ADMIN_COOKIE = "ba_admin";
const SESSION_COOKIE = "ba_session";
const ACTIVITY_COOKIE = "ba_admin_active";

/** Roles allowed into the panel. Keep in step with lib/permissions.ts STAFF_ROLES. */
const STAFF_ROLES = new Set(["staff", "manager", "admin"]);

/** Mirror of ADMIN_SESSION_SECONDS in the login route. */
const ADMIN_TTL_SECONDS = 60 * 60 * 12;

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

/** Cache-busting headers for the private panel: never let a CDN hold it. */
function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  // ---- 0. the old URL must look like it never existed ---------------------
  // A rewrite (not a redirect) to a nonexistent path renders the app's 404
  // with the original URL preserved. Nothing in the response says "moved".
  if (pathname === LEGACY_ADMIN_BASE || pathname.startsWith(`${LEGACY_ADMIN_BASE}/`)) {
    const res = new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // ---- 1. the panel (and its API) ----------------------------------------
  const adminArea = pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`);
  const adminApi = pathname.startsWith(`/api/${ADMIN_BASE.replace(/^\//, "")}/`);

  if (adminArea) {
    const store = req.cookies;
    const adminToken = store.get(ADMIN_COOKIE)?.value;
    const sessionToken = store.get(SESSION_COOKIE)?.value;

    const adminVerdict = await check(adminToken);
    const sessionVerdict = adminVerdict === "staff" ? "staff" : await check(sessionToken);

    if (pathname === ADMIN_LOGIN_PATH) {
      if (sessionVerdict === "staff") {
        return noStore(NextResponse.redirect(new URL(ADMIN_BASE, req.url)));
      }
    } else if (sessionVerdict === "other") {
      // Signed in but not staff → hard "Access denied".
      const url = new URL("/forbidden", req.url);
      url.searchParams.set("from", pathname);
      return noStore(NextResponse.redirect(url));
    } else if (sessionVerdict !== "staff") {
      const url = new URL(ADMIN_LOGIN_PATH, req.url);
      if (pathname !== ADMIN_BASE) url.searchParams.set("next", pathname);
      const res = NextResponse.redirect(url);
      if (adminToken) res.cookies.delete(ADMIN_COOKIE);
      return noStore(res);
    } else {
      // Signed in as staff: refresh the idle marker so the client-side
      // countdown can resume after a reload.
      const res = NextResponse.next({
        request: { headers: withNonce(req.headers, "") },
      });
      res.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
        httpOnly: true,
        sameSite: "lax",
        secure: !isDev,
        path: ADMIN_BASE,
        maxAge: ADMIN_TTL_SECONDS,
      });
      return noStore(res);
    }
  }

  // Admin APIs get no CSP but must never be cached by a CDN.
  if (adminApi) {
    return noStore(NextResponse.next());
  }

  // ---- 2. per-request CSP nonce ------------------------------------------
  // Only HTML documents need it; skipping API/static responses keeps the edge
  // cost near zero and avoids caching a nonce against a static asset.
  const needsCsp =
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !/\.(?:png|jpe?g|svg|webp|avif|ico|woff2?|txt|xml|webmanifest|json)$/i.test(pathname);

  const nonce = randomNonce();
  const res = NextResponse.next({ request: { headers: withNonce(req.headers, nonce) } });

  if (needsCsp) {
    res.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
  }
  return res;
}

/**
 * A minimal 404 body. Kept inline (not the app's /not-found) because the
 * middleware runs before the router and must not risk a redirect or a render
 * that could reveal the new admin location.
 */
function notFoundHtml(): string {
  return [
    "<!doctype html><html lang=\"bn\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<meta name=\"robots\" content=\"noindex,nofollow\">",
    "<title>পাওয়া যায়নি | বিশ্বাস এগ্রো</title>",
    "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;",
    "background:#111312;color:#e8e4da;font-family:system-ui,sans-serif;text-align:center}",
    "h1{font-size:1.4rem;margin:0 0 .4rem}p{margin:0;opacity:.55;font-size:.86rem}",
    "a{color:#5fce96;text-decoration:none;font-size:.86rem}</style></head>",
    "<body><main><h1>৪০৪</h1><p>এই পেজটি পাওয়া যায়নি</p>",
    "<p style=\"margin-top:.7rem\"><a href=\"/\">হোমে ফিরে যান</a></p></main></body></html>",
  ].join("");
}

function withNonce(headers: Headers, nonce: string): Headers {
  const next = new Headers(headers);
  if (nonce) next.set("x-nonce", nonce);
  return next;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export const config = {
  // Everything except static assets — the admin gate is inside the handler, so
  // adding root coverage for CSP costs nothing extra.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|images/|splash/).*)"],
};
