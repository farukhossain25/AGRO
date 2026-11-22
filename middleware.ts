import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_BASE, ADMIN_LOGIN_PATH, LEGACY_ADMIN_BASE } from "@/lib/paths";

/* ==========================================================================
   middleware.ts — edge guards
   --------------------------------------------------------------------------
   Three jobs, all cheap enough for the edge:

   1. Admin gate. The panel lives at `/{ADMIN_PATH}` (default /foisal), read
      from env through lib/paths.ts. The gate does NOT trust the app JWT's
      role claim (that is only a snapshot taken at login). Instead it:

        a. reads the Supabase session cookie via @supabase/ssr,
        b. calls `auth.getUser()` — Supabase Auth validates the token
           server-side, so a forged or expired cookie is rejected,
        c. reads the CURRENT `profiles.role` for that user through PostgREST
           with the user's own JWT, so RLS (`profiles_select_own`) applies.

      A demoted admin loses access on the very next request, not after the
      12-hour cookie expires. Signed-in non-staff get /forbidden; signed-out
      visitors get sent to the login page. The (protected) layout and every
      API route re-verify too — this is defence in depth, not the only wall.

   2. /admin must NOT exist. The brief asks for a plain 404 with no redirect
      and no hint. We rewrite to a path that has no route, rather than
      redirecting to /404, because a redirect would itself be a signal.

   3. A per-request CSP nonce. Next injects the nonce into its own bootstrap
      scripts, so the policy can drop 'unsafe-inline' for script-src.

   Idle logout is enforced client-side by components/admin/idle-guard.tsx
   (which reads `ba:last-activity` from localStorage); the admin session also
   carries a 12-hour absolute TTL, and `ba_admin_active` records the last seen
   time so the countdown resumes after a reload.
   ========================================================================== */

const ACTIVITY_COOKIE = "ba_admin_active";

/** Roles allowed into the panel. Keep in step with lib/permissions.ts STAFF_ROLES. */
const STAFF_ROLES = new Set(["staff", "manager", "admin"]);

/** Mirror of ADMIN_SESSION_SECONDS in the login route. */
const ADMIN_TTL_SECONDS = 60 * 60 * 12;

type Verdict = "staff" | "other" | "none";

type RefreshedCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Validate the Supabase session and read the caller's CURRENT role.
 *
 * `auth.getUser()` is the only safe way to ask "who is this?" on the server —
 * it round-trips to Supabase Auth and validates the JWT signature, unlike
 * `getSession()` which trusts whatever is in the cookie. The role read then
 * goes through PostgREST with the user's own token, so the
 * `profiles_select_own` RLS policy is what authorises it (a user can only
 * ever read their own row, and `role` is not user-writable — migration 0008
 * revokes that column and the `guard_profile_role` trigger enforces it).
 *
 * Any refreshed session cookies (from a token rotation during getUser) are
 * collected into `refreshed` so the caller can set them on the final
 * response — without this, the next request would replay a rotated refresh
 * token and the admin would be signed out spuriously.
 */
async function supabaseVerdict(
  req: NextRequest,
  refreshed: RefreshedCookie[]
): Promise<Verdict> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return "none"; // Supabase not configured → no session

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const item of cookiesToSet) refreshed.push(item);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "none";

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (data as { role?: string } | null)?.role;
  return role && STAFF_ROLES.has(role) ? "staff" : "other";
}

/**
 * The Supabase origin used by Storage images and the Realtime websocket.
 * Derived from NEXT_PUBLIC_SUPABASE_URL so moving to another Supabase project
 * is an environment change, not a code change. Without it the browser would
 * block every image and every Realtime connection.
 */
function supabaseOrigins(): { http: string; ws: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    const host = new URL(raw).host;
    return { http: `https://${host}`, ws: `wss://${host}` };
  } catch {
    return null;
  }
}

/** Build the CSP for one request. `nonce` is unique per response. */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const sb = supabaseOrigins();
  const supabase = sb ? sb.http : "https://*.supabase.co";
  const realtime = sb ? sb.ws : "wss://*.supabase.co";
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonce'd Next bootstrap load the rest of the
    // chunks without listing every one. No 'unsafe-inline' outside dev.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    `img-src 'self' data: blob: ${supabase} https://images.unsplash.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${realtime} https://vitals.vercel-insights.com https://*.tile.openstreetmap.org https://www.googletagmanager.com https://*.google-analytics.com`,
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

  /* Supabase session cookies refreshed while the admin gate runs. Applied to
     whichever response we finally return (including the login-page
     fall-through at the bottom). */
  const refreshedCookies: RefreshedCookie[] = [];

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
    const verdict = await supabaseVerdict(req, refreshedCookies);

    /* Set any refreshed Supabase cookies on the response we are about to
       return, then apply the panel's no-store/noindex headers. */
    const finish = (res: NextResponse) => {
      for (const item of refreshedCookies) {
        try {
          res.cookies.set(item.name, item.value, item.options as never);
        } catch {
          /* a cookie that cannot be set here is safe to drop */
        }
      }
      return noStore(res);
    };

    if (pathname === ADMIN_LOGIN_PATH) {
      if (verdict === "staff") {
        return finish(NextResponse.redirect(new URL(ADMIN_BASE, req.url)));
      }
      /* Not staff → show the login form. Fall through to the CSP section
         below; any refreshed cookies are applied there. */
    } else if (verdict === "other") {
      // Signed in but not staff → hard "Access denied".
      const url = new URL("/forbidden", req.url);
      url.searchParams.set("from", pathname);
      return finish(NextResponse.redirect(url));
    } else if (verdict !== "staff") {
      const url = new URL(ADMIN_LOGIN_PATH, req.url);
      if (pathname !== ADMIN_BASE) url.searchParams.set("next", pathname);
      return finish(NextResponse.redirect(url));
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
      return finish(res);
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

  /* Preview deployments (branch / PR builds on Vercel) must never be indexed:
     otherwise Google can pick up a half-finished branch as the canonical page.
     Production is untouched. */
  if (process.env.VERCEL_ENV === "preview") {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  /* Cookies refreshed by the admin gate (login-page fall-through). */
  for (const item of refreshedCookies) {
    try {
      res.cookies.set(item.name, item.value, item.options as never);
    } catch {
      /* safe to drop */
    }
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

/* Vercel runs this on the Edge runtime by default (no `runtime` export = edge
   for middleware in Next 15). @supabase/ssr is WebCrypto/fetch-based, so the
   session check above works there; nothing here touches the Node filesystem
   or a database driver. The Supabase round-trip only happens for the admin
   area, so ordinary storefront traffic pays nothing for the gate. */
export const config = {
  // Everything except static assets — the admin gate is inside the handler, so
  // adding root coverage for CSP costs nothing extra.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|images/|splash/).*)"],
};
