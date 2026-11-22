import type { MetadataRoute } from "next";
import {
  getBlogPosts,
  getCategories,
  getCombos,
  getFarmers,
  getPackages,
  getProducts,
} from "@/lib/data";
import { site } from "@/lib/site";

/* ==========================================================================
   /sitemap.xml — generated at build time, regenerated every hour
   --------------------------------------------------------------------------
   Covers every public, indexable URL:
     home · static pages · categories · products · combos · packages ·
     farms · sellers (marketplace) · blog

   Excluded on purpose (also blocked in robots.ts):
     /foisal (the panel), /account, /api, /cart, /checkout, /payment, /login, /track…

   `priority` and `changeFrequency` are hints only — Google ignores them for
   ranking, but they help a crawler decide where to spend its budget first.
   ========================================================================== */

export const revalidate = 3600;

const BASE = site.url.replace(/\/+$/, "");

const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, freq: "daily" },
  { path: "/products", priority: 0.95, freq: "daily" },
  { path: "/categories", priority: 0.9, freq: "weekly" },
  { path: "/combos", priority: 0.85, freq: "weekly" },
  { path: "/subscription", priority: 0.85, freq: "weekly" },
  { path: "/market", priority: 0.8, freq: "daily" },
  { path: "/farm", priority: 0.8, freq: "monthly" },
  { path: "/live", priority: 0.75, freq: "weekly" },
  { path: "/live/farms", priority: 0.75, freq: "weekly" },
  { path: "/blog", priority: 0.8, freq: "weekly" },
  { path: "/about", priority: 0.6, freq: "monthly" },
  { path: "/contact", priority: 0.6, freq: "monthly" },
  { path: "/faq", priority: 0.55, freq: "monthly" },
  { path: "/policies/privacy", priority: 0.3, freq: "yearly" },
  { path: "/policies/terms", priority: 0.3, freq: "yearly" },
  { path: "/policies/refund", priority: 0.3, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [categories, products, combos, packages, farmers, posts] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ limit: 500 }).catch(() => []),
    getCombos().catch(() => []),
    getPackages().catch(() => []),
    getFarmers().catch(() => []),
    getBlogPosts(100).catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: now,
    changeFrequency: route.freq,
    priority: route.priority,
  }));

  // ── categories
  for (const category of categories) {
    entries.push({
      url: `${BASE}/categories/${category.slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    });
  }

  // ── products (the bulk of the index)
  for (const product of products) {
    entries.push({
      url: `${BASE}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // ── combos + subscription packages
  for (const combo of combos) {
    entries.push({
      url: `${BASE}/combos/${combo.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Packages live on the single /subscription page as anchored sections; the
  // anchor is included so Google can deep-link straight to a plan.
  for (const pack of packages) {
    entries.push({
      url: `${BASE}/subscription#${pack.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.55,
    });
  }

  // ── live farm pages (the farm directory's own rows have no slug, so the
  //    canonical farm URLs come from the live-farm source of truth)
  const farmSlugs = await getFarmSlugs();
  for (const slug of farmSlugs) {
    entries.push({
      url: `${BASE}/live/farms/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // ── team of farmers shown on /farm (no individual pages, anchor only)
  if (farmers.length) {
    entries.push({
      url: `${BASE}/farm#farmers`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  const sellers = await getSellerSlugs();
  for (const slug of sellers) {
    entries.push({
      url: `${BASE}/market/${slug}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // ── blog: real publish dates so Google can judge freshness
  for (const post of posts) {
    entries.push({
      url: `${BASE}/blog/${post.slug}`,
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: "monthly",
      priority: 0.65,
    });
  }

  // de-duplicate (a few seed products share a slug with a combo)
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}

/** Farm slugs that have a public /live/farms/[slug] page. */
async function getFarmSlugs(): Promise<string[]> {
  try {
    const { listFarms } = await import("@/lib/farms");
    const farms = await listFarms();
    return farms.map((farm) => farm.slug).filter(Boolean);
  } catch {
    return [];
  }
}

/** Public, approved sellers only — never a suspended shop. */
async function getSellerSlugs(): Promise<string[]> {
  try {
    const { db, dbUsable } = await import("@/lib/db");
    if (!dbUsable()) return [];
    const { data, error } = await db().from("public_sellers").select("slug").limit(500);
    if (error) return [];
    return (data ?? []).map((row) => row.slug as string).filter(Boolean);
  } catch {
    return [];
  }
}
