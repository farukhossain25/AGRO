import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_BASE, LEGACY_ADMIN_BASE, canOpenPanelPath, firstReachablePanelPath } from "@/lib/paths";
import { canForRole } from "@/lib/permissions";
import { getRoleOverrides } from "@/lib/role-access";
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
      a role read from profiles.role server-side. Admin sees everything; staff
      and manager see only the pages their permissions cover (lib/paths.ts →
      PANEL_PAGE_PERMISSIONS). A customer gets the same 404 a stranger does —
      never a hint that the panel exists.
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

/**
 * Origin of the stream edge when video bypasses the Vercel proxy
 * (`STREAM_PUBLIC_BASE`). hls.js fetches the playlist with XHR — that needs
 * connect-src — and iOS Safari attaches the URL to <video src> directly, which
 * needs media-src. Empty when the same-origin proxy is in use, so nothing
 * changes. `process.env.*` is inlined at build time in the Edge runtime.
 */
function streamOrigin(): string[] {
  const base = (process.env.STREAM_PUBLIC_BASE ?? "").replace(/\/$/, "");
  if (!base) return [];
  // STREAM_PUBLIC_BASE may carry a path (https://host/live-<secret>); CSP
  // source expressions want the origin only.
  try {
    return [new URL(base).origin];
  } catch {
    return [];
  }
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
  const stream = streamOrigin();
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
      ...stream,
      ...http,
      ...ws,
      "https://vitals.vercel-insights.com",
      "https://*.tile.openstreetmap.org",
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
    ].join(" "),
    ["media-src 'self' blob:", ...stream, ...http].join(" "),
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

/**
 * Pass "which URL is this" to the server component.
 *
 * `headers()` inside a layout reads the *request*; response headers would only
 * reach the browser. So the forwarded request gets the extra header, and every
 * header the session helper already set on the response (the rotated cookies)
 * is copied across — losing those would sign the user out on every page.
 */
function withRequestHeader(req: NextRequest, response: NextResponse, name: string, value: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(name, value);
  const next = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [key, val] of response.headers.entries()) next.headers.append(key, val);
  return next;
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
    /* A non-admin may open the pages its own permission set covers — that is
       how a staff account reaches products/media/reviews and a manager reaches
       orders/reports, instead of the single live-chat page it used to get.
       Every other panel URL keeps returning the identical 404 a stranger sees,
       so the panel's shape is still not advertised to a role that may not see
       it. The page's own API re-checks the permission; this is only the door. */
    if (role !== "admin") {
      const staffRole = role === "staff" || role === "manager";
      /* The admin may have changed what staff/manager can reach (migration 30).
         One cached read per request; a failure falls back to the code defaults,
         which is exactly what an unconfigured panel does. */
      const overrides = staffRole ? await getRoleOverrides() : null;
      /* The panel root is a front door, not a wall. Send the account to the
         first page it may actually open. This MUST happen here rather than in
         the layout: `redirect()` from a Server Component renders the loading
         shell first and then emits a <meta refresh>, so a staff member would
         see a one-second flash of the money dashboard before being moved.
         A middleware response is a real 307 with no body at all. */
      if (pathname === ADMIN_BASE) {
        if (!staffRole) return plain404();
        const target = firstReachablePanelPath((perm) => canForRole(role, perm, overrides));
        if (target !== ADMIN_BASE) return noStore(NextResponse.redirect(new URL(target, req.url)));
      } else if (!(staffRole && canOpenPanelPath(pathname, (perm) => canForRole(role, perm, overrides)))) {
        return plain404();
      }
    }

    /* The panel layout has to re-check "is this sub-path open to staff?" and it
       cannot read the URL on the server otherwise. Passed as a REQUEST header
       so `headers()` inside the layout sees it. */
    response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce, isDev));
    return noStore(withRequestHeader(req, response, "x-pathname", pathname));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|brand/|fonts/|images/|splash/).*)"],
};
