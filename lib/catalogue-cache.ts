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
import { logCache } from "./log";

/**
 * The catalogue cache is OPT-IN.
 *
 * ⚠️ WHY IT IS OFF BY DEFAULT
 *   `unstable_cache` wraps the read in a promise the caller cannot cancel. When
 *   that read stalls, the deadline in lib/data.ts gives up and the page paints —
 *   but the underlying query keeps running to its own 8 s socket timeout, fails,
 *   and the data cache stores that failure for a minute. Measured on a stalling
 *   host: every page view re-issued all eleven reads and paid 4 s each, forever,
 *   because each one "made progress" in the background and the circuit breaker
 *   could never stay closed. A cache that cannot be cancelled turns a bounded
 *   failure into a permanent one.
 *
 *   With it off, a failed read marks the database unreachable (lib/db.ts
 *   breaker) and the next reads return instantly for the probe window. On a
 *   healthy database the cost is one extra query per render — mitigated by the
 *   in-flight de-duplication in lib/data.ts and by the per-request React cache
 *   in lib/content.ts / lib/site-settings.ts, which cover the duplicates that
 *   actually occur (the homepage asks for `categories` twice).
 *
 *   Set `CATALOGUE_CACHE=1` to turn it back on. The write-path invalidation
 *   (`invalidateCatalogue`) is wired either way and stays correct.
 */
export const CATALOGUE_CACHE_ENABLED = process.env.CATALOGUE_CACHE === "1";

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
/**
 * The plain cached read: one cache entry per key, 60 s, tagged.
 *
 * ⚠️ WHAT THIS CANNOT DO, AND WHERE THE FIX LIVES INSTEAD
 *   A promise handed to `unstable_cache` is stored as soon as it settles —
 *   INCLUDING when it rejects. Wrapping the inner function with its own timer
 *   cannot prevent that, because the rejection still reaches `unstable_cache`;
 *   the first attempt here proved it (a "not cached" log line, and the next
 *   request paying the same budget again).
 *
 *   So the deadline must sit ABOVE this call, and a timed-out read must never
 *   reach `unstable_cache` at all. `lib/data.ts` does exactly that: it races
 *   the read against `READ_TIMEOUT_MS`, and on timeout it stops waiting, opens
 *   the circuit breaker and returns the empty state — the in-flight promise is
 *   abandoned, not stored.
 */

export function cachedRead<T>(keyParts: (string | number | boolean)[], fn: () => Promise<T>): Promise<T> {
  /* Uncached: see CATALOGUE_CACHE_ENABLED above. Callers and `safe()` are
     unchanged — this is one switch, not a second code path. */
  if (!CATALOGUE_CACHE_ENABLED) return fn();

  const key = keyParts.map(String).join(":");
  try {
    return unstable_cache(fn, keyParts.map(String), {
      revalidate: CATALOGUE_TTL,
      tags: [CATALOGUE_TAG],
    })();
  } catch (error) {
    /* `unstable_cache` throws synchronously outside a request scope ("Invariant:
       incrementalCache missing") — a script, a test harness, a cron entry
       point. That must not fail the read: the uncached value is correct, just
       unshared. Logged because it is the difference between "the cache is not
       working" and "this code is not running in a request". */
    logCache("unstable_cache unavailable — reading direct", { key, err: (error as Error)?.message });
    return fn();
  }
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
  } catch (error) {
    /* Outside a request scope, or the write ran before the cache existed. The
       60-second TTL clears it either way — but say so, because "the owner
       edited a product and did not see it for a minute" is a real report and
       this line explains it. */
    logCache("invalidate failed — TTL will clear it", { err: (error as Error)?.message });
  }
}
