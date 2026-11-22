import type { Metadata } from "next";
import { db, dbUsable } from "./db";

/* ==========================================================================
   Editable SEO copy (migration 0006 → `seo_meta`)
   --------------------------------------------------------------------------
   Every page ships with a hand-written Bangla title/description in code. The
   admin panel at the panel’s SEO screen can override any of them per route without a
   deploy. Rules:

     • A blank column means "keep the code default" — never render an empty
       title or description, Google treats those as duplicates.
     • If Supabase is unreachable (build, preview, outage) the defaults win.
       SEO must never be the reason a page fails to render.
   ========================================================================== */

export type SeoRow = {
  path: string;
  title_bn: string | null;
  title_en: string | null;
  description_bn: string | null;
  description_en: string | null;
  keywords_bn: string[] | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical: string | null;
  noindex: boolean | null;
};

/** One page's overrides, memoised for a minute so a page can read it twice. */
const CACHE_TTL_MS = 60_000;
let cache: { at: number; rows: Map<string, SeoRow> } | null = null;

async function loadAll(): Promise<Map<string, SeoRow>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = new Map<string, SeoRow>();
  if (dbUsable()) {
    try {
      const { data, error } = await db().from("seo_meta").select("*");
      if (error) throw error;
      for (const row of (data ?? []) as SeoRow[]) rows.set(row.path, row);
    } catch (error) {
      console.warn("[seo] falling back to built-in metadata:", (error as Error).message);
    }
  }
  cache = { at: Date.now(), rows };
  return rows;
}

export async function seoRowFor(path: string): Promise<SeoRow | null> {
  const rows = await loadAll();
  return rows.get(path) ?? null;
}

/** Drop blank strings so they never overwrite a good default. */
function pick(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Merge the DB row for `path` over a page's built-in metadata.
 *
 * Usage in a page:
 *   export async function generateMetadata() {
 *     return withSeo("/products", { title: "সব পণ্য", description: "…" });
 *   }
 */
export async function withSeo(path: string, fallback: Metadata): Promise<Metadata> {
  const row = await seoRowFor(path);
  if (!row) return fallback;

  const title = pick(row.title_bn, row.title_en);
  const description = pick(row.description_bn, row.description_en);
  const ogTitle = pick(row.og_title, title);
  const ogDescription = pick(row.og_description, description);
  const noindex = row.noindex === true;

  const openGraph: Metadata["openGraph"] = fallback.openGraph
    ? {
        ...fallback.openGraph,
        ...(ogTitle ? { title: ogTitle } : {}),
        ...(ogDescription ? { description: ogDescription } : {}),
        ...(row.og_image ? { images: [{ url: row.og_image }] } : {}),
      }
    : undefined;

  return {
    ...fallback,
    // The root route owns the full brand title — a page template would
    // append the brand a second time, so it renders as an absolute title.
    ...(title ? { title: path === "/" ? { absolute: title } : title } : {}),
    ...(description ? { description } : {}),
    ...(row.keywords_bn?.length ? { keywords: row.keywords_bn } : {}),
    ...(openGraph ? { openGraph } : {}),
    ...(noindex ? { robots: { index: false, follow: false, nocache: true } } : {}),
    // The canonical is derived from the route, not typed by hand — changing it
    // per row is only used when a page is deliberately consolidated.
    ...(row.canonical ? { alternates: { ...fallback.alternates, canonical: row.canonical } } : {}),
  };
}

/** Bust the memo (called after an admin save so the next request re-reads). */
export function clearSeoCache() {
  cache = null;
}
