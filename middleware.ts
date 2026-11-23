import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_BASE, LEGACY_ADMIN_BASE } from "@/lib/paths";
import { updateSession } from "@/lib/supabase/middleware";

/* ==========================================================================
   middleware.ts — session refresh + route guards
   --------------------------------------------------------------------------
   1. Refreshes the Supabase session on every document request (see
      lib/supabase/middleware.ts). This is what keeps a signed-in user signed in
      after a reload or after the 1-hour access token expires.
   2. Guards private customer pages (/account/*, /checkout, /orders) by
      redirecting to /login?next=<path>. The login page only accepts same-site
      paths, so `next` cannot be used as an open redirect.
   3. Hides the admin panel: /admin returns a plain 404, and /foisal requires
      role = 'admin' read from profiles.role server-side. A signed-in
      non-admin gets the same 404 — never a hint that the panel exists.
   4. Sets the per-request CSP (with a fresh nonce) and no-store headers on
      private surfaces.

   /auth/callback is deliberately untouched: the PKCE exchange there must see
   the exact cookies the browser sent, so middleware never rotates them first.
   ========================================================================== */

/** Pages that need a signed-in customer. */
const PRIVATE_PREFIXES = ["/account", "/checkout", "/orders"] as const;

/** Never run the session refresh here (it would break the PKCE exchange). */
const SKIP_PREFIXES = ["/auth"] as const;

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    /\.(?:png|jpe?g|svg|webp|avif|ico|gif|woff2?|ttf|txt|xml|webmanifest|json|js|css|map)$/i.test(pathname)
  );
}

function supabaseOrigins(): { http: string[]; ws: string[] } {
  return {
    http: ["https://*.supabase.co"],
    ws: ["wss://*.supabase.co"],
  };
}

/** CSP for one request. `nonce` is unique per response. */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const { http, ws } = supabaseOrigins();
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonce'd Next bootstrap load its own chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    // Avatars come from Supabase Storage or a Google account; product imagery
    // from Supabase Storage / our own /images; maps from the tile hosts.
    // No third-party placeholder host (unsplash, pravatar) is allowed.
    [
      "img-src 'self' data: blob:",
      ...http,
      "https://*.googleusercontent.com",
      "https://lh3.googleusercontent.com",
      "https://*.tile.openstreetmap.org",
      "https://*.basemaps.cartocdn.com",
    ].join(" "),
    "manifest-src 'self'",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      ...http,
      ...ws,
      "https://vitals.vercel-insights.com",
      "https://*.tile.openstreetmap.org",
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
    ].join(" "),
    `media-src 'self' blob: ${http.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://www.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Minimal 404 body — used for /admin and for non-admin access to the panel. */
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

function plain404(): NextResponse {
  const res = new NextResponse(notFoundHtml(), {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  // ── 0. the old admin URL must look like it never existed ────────────────
  if (pathname === LEGACY_ADMIN_BASE || pathname.startsWith(`${LEGACY_ADMIN_BASE}/`)) {
    return plain404();
  }

  // ── 1. API routes: no CSP, no session refresh (handlers verify themselves)
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    if (pathname.startsWith(`/api/${ADMIN_BASE.replace(/^\//, "")}/`)) return noStore(res);
    return res;
  }

  // ── 2. static assets / manifest / images need no session work
  if (isStaticAsset(pathname)) return NextResponse.next();

  // ── 3. the OAuth/PKCE callback owns its own cookies
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const nonce = randomNonce();

  // ── 4. admin panel — role = 'admin' only, checked server-side ───────────
  const isAdminArea = pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`);
  if (isAdminArea) {
    /* The panel's own login screen has to render before there is an admin
       session, otherwise the guard below would 404 the only door in. */
    if (pathname === `${ADMIN_BASE}/login`) {
      const { response } = await updateSession(req, { nonce });
      response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
      return noStore(response);
    }

    const { response, user, role } = await updateSession(req, { nonce, withRole: true });

    if (!user) {
      /* Always carry `next` — including for the panel root. Without it an owner
         who types /foisal lands on the home page after signing in and has to
         type the URL again. safeNextPath() in the login form rejects only
         /login, /reset-password and /auth, so /foisal survives the round-trip. */
      const url = new URL(`${ADMIN_BASE}/login`, req.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return noStore(NextResponse.redirect(url));
    }
    if (role !== "admin") {
      // Signed in, not an admin: identical response to a URL that never existed.
      return plain404();
    }

    response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
    return noStore(response);
  }

  // ── 5. private customer pages
  if (isPrivatePath(pathname)) {
    const { response, user } = await updateSession(req, { nonce });
    if (!user) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
    return response;
  }

  // ── 6. everything else: refresh the session + set the CSP
  const { response } = await updateSession(req, { nonce });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));

  if (process.env.VERCEL_ENV === "preview") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

/* Middleware runs on the Edge runtime in Next 15 (no `runtime` export).
   @supabase/ssr is fetch/WebCrypto based, so the session work above is fine
   there — nothing touches the Node filesystem or a database driver. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|images/|splash/).*)"],
};
