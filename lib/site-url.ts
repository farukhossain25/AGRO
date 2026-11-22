/* ==========================================================================
   lib/site-url.ts — the ONE place the deployment address is decided
   --------------------------------------------------------------------------
   The brief: "Never hardcode the site URL. Read it from NEXT_PUBLIC_SITE_URL
   (default: the vercel.app URL) so that metadata, sitemap.xml, robots.txt,
   canonical tags, Open Graph and JSON-LD all update automatically when I add
   a domain later."

   Resolution order, most explicit first:

     1. NEXT_PUBLIC_SITE_URL   — you set this in Vercel → Settings →
                                 Environment Variables. Set it once to
                                 https://<project>.vercel.app and later to your
                                 own domain; nothing else changes.
     2. VERCEL_PROJECT_PRODUCTION_URL
                               — Vercel injects this on every deployment
                                 (e.g. biswas-agro.vercel.app). It is the
                                 *production* domain, so a preview build still
                                 points canonical tags at production rather
                                 than at itself.
     3. VERCEL_URL             — the per-deployment hostname. Last resort, and
                                 only used when neither of the above exists, so
                                 a first deploy still produces valid absolute
                                 URLs instead of crashing on `new URL("")`.
     4. http://localhost:3000  — local development.

   Why this file is separate from lib/site.ts: `site` is a plain object that
   client components import. Reading `process.env.VERCEL_*` there would inline
   server-only values into the browser bundle. lib/site.ts now takes its `url`
   from `resolveSiteUrl()`, which only ever looks at NEXT_PUBLIC_SITE_URL on
   the client side.

   Important: this is a MODULE-LEVEL constant, not a function of the request.
   Next inlines NEXT_PUBLIC_* at build time, which is what lets `metadataBase`,
   the sitemap and every JSON-LD block agree without threading a parameter
   through fifty files. Changing the variable therefore needs a redeploy —
   that is documented in README §25.
   ========================================================================== */

/** True when running on a Vercel deployment (production or preview). */
export const IS_VERCEL = Boolean(process.env.VERCEL);

/** "production" | "preview" | "development" — Vercel sets this on every build. */
export const VERCEL_ENV = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

/**
 * Preview deployments get noindex. Production and local development do not.
 * Exported because next.config.ts, middleware.ts and layout.tsx all ask.
 */
export const IS_PREVIEW = VERCEL_ENV === "preview";

/**
 * The canonical origin, without a trailing slash.
 *
 * Deliberately NOT `new URL(...)` — a malformed value in the dashboard should
 * degrade to the fallback, not throw during `next build` and fail the deploy.
 */
export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  // Injected by Vercel at build time. Server-only, hence the guard.
  if (typeof process.env.VERCEL_PROJECT_PRODUCTION_URL === "string") {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.trim();
    if (host) return withHttps(host);
  }

  if (typeof process.env.VERCEL_URL === "string") {
    const host = process.env.VERCEL_URL.trim();
    if (host) return withHttps(host);
  }

  return "http://localhost:3000";
}

/**
 * The bare hostname of the canonical origin — used for `site.domain`, the
 * WhatsApp share text and anything that must not include a protocol.
 */
export function resolveSiteHost(): string {
  try {
    return new URL(resolveSiteUrl()).host;
  } catch {
    return "localhost:3000";
  }
}

/** True when the site is still on a free *.vercel.app address. */
export function isVercelAppDomain(): boolean {
  return resolveSiteHost().endsWith(".vercel.app");
}

/**
 * Where Supabase should send the browser back to after Google / email links.
 *
 * Always built from the CURRENT origin when available, so a preview deployment
 * and localhost both work without extra configuration; the canonical URL is
 * the server-side fallback where `window` does not exist.
 */
export function authCallbackUrl(next?: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : resolveSiteUrl();
  const url = new URL("/auth/callback", origin);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function withHttps(host: string): string {
  // Vercel injects a bare hostname; tolerate a pasted full URL too.
  if (/^https?:\/\//i.test(host)) return stripTrailingSlash(host);
  return `https://${stripTrailingSlash(host)}`;
}
