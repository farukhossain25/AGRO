/**
 * Catalogue cache.
 *
 * WHY THIS FILE EXISTS
 *   Storefront pages are almost all `force-dynamic` (they read the session for
 *   wishlist / premium state), and the data layer talked to Supabase on every
 *   single render. One home-page render issued **13 queries**; the header and
 *   footer in the layout issued 5 more. A visitor on a phone in Dhaka waited for
 *   18 round-trips to Supabase before a single product card could paint — which
 *   is exactly the grey skeleton in the bug report.
 *
 *   None of that data changes per visitor. Products, categories, combos,
 *   packages, blog posts, farms, reviews, hero slides and layout rows are the
 *   same bytes for everybody, and they are edited a few times a week at most.
 *
 * WHAT THIS DOES
 *   Two layers, both keyed by the query:
 *
 *     React `cache()`  — de-duplicates within ONE request. The layout asks for
 *                        categories and so does the page; that must be one
 *                        query, not two.
 *
 *     `unstable_cache()` — survives across requests, in the serverless data
 *                        cache. A cold visitor's render hits Supabase; the next
 *                        thousand are served from cache until it expires.
 *
 * WHY 60 SECONDS AND NOT ISR
 *   `revalidateTag` is called from every admin write that touches catalogue
 *   data (see `afterWrite` in app/api/foisal/[resource]/route.ts), so the owner
 *   sees an edit immediately. The 60 s window is the safety net for writes that
 *   bypass that route — a direct SQL edit, a Supabase table editor change, a
 *   cron job. Long enough to make caches useful, short enough that a mistake
 *   corrects itself within a minute.
 *
 * WHAT IS NOT CACHED
 *   Anything that depends on who is asking: wallet balance, the viewer's saved
 *   products, premium entitlement, orders, notifications. Those stay direct.
 *   Caching them would show one customer another's data — the worst possible
 *   bug, and one that no amount of speed is worth.
 */
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

/** One tag for everything a customer may browse. Writes invalidate it wholesale. */
export const CATALOGUE_TAG = "catalogue";

/** How long a catalogue read may be stale if nothing invalidates it. */
export const CATALOGUE_TTL = 60;

/**
 * Wrap a read so it is cached and tagged.
 *
 * `keyParts` must include every argument that changes the result — otherwise
 * `/products?category=fish` and `/products?category=dairy` share one cache
 * entry and one of them shows the wrong products.
 */
export function cachedRead<T>(keyParts: (string | number | boolean)[], fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, keyParts.map(String), {
    revalidate: CATALOGUE_TTL,
    tags: [CATALOGUE_TAG],
  })();
}

/**
 * Drop the catalogue cache. Called by admin writes; safe to call when nothing
 * is cached.
 *
 * Note the `catch`: `revalidateTag` throws when called outside a request scope
 * (a script, a test harness, a cron entry point). A failed cache invalidation
 * must never fail the write that triggered it — the write already happened, and
 * the 60-second window will clear it anyway.
 */
export function invalidateCatalogue(): void {
  try {
    revalidateTag(CATALOGUE_TAG);
  } catch {
    /* outside a request scope — the TTL handles it */
  }
}
