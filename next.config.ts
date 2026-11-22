import type { NextConfig } from "next";

/* ==========================================================================
   next.config.ts
   --------------------------------------------------------------------------
   Section C (performance) + section D (SEO/security headers).

   Deployment note: this project is deployed on Vercel. `vercel.json` and
   `netlify.toml` carry the same header set for the CDN edge, because Vercel
   serves `headers()` from the function layer and Netlify needs them declared
   statically. Keeping all three in sync is deliberate — see README §17.
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
    value: "camera=(), microphone=(), geolocation=(self), payment=(self), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS — one year, subdomains, preload-ready. Only meaningful over HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // AVIF first: ~50% smaller than JPEG at the same quality. WebP is the
    // automatic fallback for Safari < 16.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [56, 64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      { protocol: "https", hostname: "lyihdzgmtjkkhybpkqot.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
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
        source: "/splash/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },

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
