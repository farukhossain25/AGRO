import type { NextConfig } from "next";
import { IS_PREVIEW } from "./lib/site-url";

/* ==========================================================================
   next.config.ts
   --------------------------------------------------------------------------
   Section C (performance) + section D (SEO/security headers).

   Deployment: Vercel only. `vercel.json` repeats the security and cache
   headers at the CDN edge so a static asset is answered without invoking a
   function, while `headers()` below covers everything the CDN rule list does
   not name (per-route noindex, the service worker). Two layers, one source of
   truth for the values — see README §25.
   ========================================================================== */

/* Content-Security-Policy ------------------------------------------------
   CSP is set per-request in middleware.ts, with a fresh nonce. It cannot live
   here: headers() is fixed for the whole build, while a nonce changes on every
   response. Two policies would also both arrive at the browser, and the
   stricter intersection of the two would apply.

   Everything else (HSTS, nosniff, frame options, permissions) stays here so
   the CDN can serve it without invoking the function layer.
*/

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    /* Only features the browser actually recognises — Chrome logs
       "Unrecognized feature" for the rest (e.g. `payment`), and `camera` must
       stay open to self for the admin QR/camera capture. */
    value: "camera=(self), microphone=(), geolocation=(self), fullscreen=(self)",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS — one year, subdomains, preload-ready. Only meaningful over HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** Derive the Supabase Storage hostname from NEXT_PUBLIC_SUPABASE_URL. */
function supabaseImageHost(): { protocol: "https"; hostname: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return { protocol: "https", hostname: new URL(raw).hostname };
  } catch {
    return null;
  }
}

/* The deployment's identity, exposed to the client so the service worker can
   tell a new build from the one it has cached. Vercel provides the commit SHA
   on every deploy; a local/self-hosted build falls back to the build clock.

   WHY IT MUST BE STABLE PER BUILD AND DIFFERENT BETWEEN BUILDS
   `components/pwa-register.tsx` compares this with what the browser saw last
   time and, on a change, unregisters every worker and deletes every cache
   before reloading. If the value did not change, a visitor would keep the
   previous build's chunks and the error boundary would stay stuck; if it
   changed on every REQUEST the page would reload in a loop. A build-time
   constant is exactly right. */
const BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  `local-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /* Inlined into the client bundle at build time (see BUILD_ID above). */
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },

  images: {
    // AVIF first: ~50% smaller than JPEG at the same quality. WebP is the
    // automatic fallback for Safari < 16.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [56, 64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    /* The Storage host comes from the environment so a new Supabase project
       does not need a code change: NEXT_PUBLIC_SUPABASE_URL already contains
       the ref, and Vercel Storage custom domains (files.<domain>) are allowed
       too. A wildcard on *.supabase.co would be simpler but would let any
       Supabase project's images through the optimiser. */
    remotePatterns: [
      ...(supabaseImageHost() ? [supabaseImageHost()!] : []),
    ],
  },

  // Smaller client payloads: the default is fine, but these two matter most.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  async headers() {
    return [
      // ── security headers everywhere
      { source: "/(.*)", headers: securityHeaders },

      // ── immutable hashed build assets (fonts, JS, CSS chunks)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/splash/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },

      /* ── preview deployments must never be indexed ─────────────────────
         Every Vercel preview gets its own *.vercel.app hostname. Without this
         header Google would happily index a half-finished branch and later
         see it as duplicate content against production. VERCEL_ENV is
         "preview" on branch/PR builds and "production" on the live site. */
      ...(IS_PREVIEW
        ? [{ source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
        : []),

      // ── private surfaces: keep them out of the index even if linked
      {
        source: "/account/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/foisal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/seller/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/track/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },

      // ── the service worker must never be cached by the browser
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },

      // ── feed + machine files
      {
        source: "/sitemap.xml",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600" }],
      },
      {
        source: "/robots.txt",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },

  async redirects() {
    /* Permanent moves only. Keep this list tiny — every entry is a URL Google
       has to re-crawl. Bangla-slug legacy paths map onto the new routes. */
    return [
      { source: "/shop", destination: "/products", permanent: true },
      { source: "/farmer", destination: "/farm", permanent: true },
      { source: "/farmers", destination: "/farm", permanent: true },
      { source: "/organic", destination: "/categories/agri", permanent: true },
      { source: "/privacy", destination: "/policies/privacy", permanent: true },
      { source: "/terms", destination: "/policies/terms", permanent: true },
      { source: "/refund", destination: "/policies/refund", permanent: true },
    ];
  },
};

export default nextConfig;
