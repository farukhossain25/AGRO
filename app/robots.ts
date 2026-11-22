import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { ADMIN_BASE } from "@/lib/paths";

/* ==========================================================================
   /robots.txt
   --------------------------------------------------------------------------
   `/api/` must stay crawlable enough for Google to see the 401 rather than
   assume the whole site is broken, but we still want it out of the index:
   a `Disallow` is the correct signal. Same for the private customer and admin
   surfaces — no sitemap entry, no crawl.

   Blocking a URL does NOT remove it from the index if it is already there;
   the private pages also send `X-Robots-Tag: noindex` (see next.config.ts).
   ========================================================================== */

export default function robots(): MetadataRoute.Robots {
  const base = site.url.replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ADMIN_BASE,
          `${ADMIN_BASE}/`,
          "/account",
          "/account/",
          "/api/",
          "/cart",
          "/checkout",
          "/payment",
          "/payment/",
          "/login",
          "/register",
          "/forgot-password",
          "/forbidden",
          "/offline",
          "/track",
          "/order-success",
          "/seller",
          "/seller/",
          "/search",
        ],
      },
      // Google's own crawler is welcome to the whole catalogue.
      { userAgent: "Googlebot", allow: "/", disallow: [ADMIN_BASE, "/account", "/api/", "/cart", "/checkout", "/payment", "/seller"] },
      // Aggressive scrapers get nothing but the homepage.
      { userAgent: ["AhrefsBot", "SemrushBot", "MJ12bot", "DotBot"], allow: ["/$"], disallow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
