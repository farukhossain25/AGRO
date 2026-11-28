/**
 * Storefront data facade.
 *
 * Every page/route imports from here instead of lib/queries.ts directly.
 * This layer has ONE job on top of the typed queries: make a page render even
 * when the database is empty, slow or unreachable.
 *
 *   • no rows          → an empty array / null  (the page shows its empty state)
 *   • database offline → the same empty shape, instantly (the breaker is open)
 *   • slow database    → the read is ABORTED at `READ_TIMEOUT_MS`, not just
 *                        raced, so the server stops waiting on the socket
 *   • never            → a thrown error that reaches a customer
 *
 * Writes never come through here — they live in the route handlers, which do
 * surface errors (in Bangla) because the person must know a save failed.
 *
 * ── WHAT WAS BROKEN, AND WHY THE FIX LOOKS LIKE THIS ──────────────────────
 * This file used to wrap each read in `safe(fn, empty)` and rely on
 * `unstable_cache` for sharing. Three failures compounded:
 *
 *   1. No deadline. A stalled query held the render for the socket's full
 *      timeout (8 s), and eleven of them ran "in parallel", so the page took
 *      as long as the slowest one plus everything it blocked after it.
 *   2. A race is not a cancellation. When a `Promise.race` gave up, the query
 *      stayed in flight; the server could not finish the response until the
 *      socket closed anyway. Measured: the log said "timeout at 4 s" and the
 *      page arrived at 39 s.
 *   3. The breaker never opened, because the failure surfaced as a resolved
 *      empty array rather than a transport error. Every page view repeated the
 *      whole sequence.
 *
 * The fix is one mechanism, `lib/read-deadline.ts`: it passes an AbortSignal
 * into the query, aborts the socket at the deadline, opens the breaker the
 * instant it fires, and never throws. Everything below is a thin adapter over
 * it, plus the three things this layer adds: in-flight de-duplication, cache
 * keys, and the empty-vs-unavailable distinction for 404 callers.
 */
import { cachedRead, invalidateCatalogue } from "./catalogue-cache";
import * as q from "./queries";
import { readWithOutcome, READ_TIMEOUT_MS } from "./read-deadline";
import { logReadOk } from "./log";
import type {
  Banner,
  BlogPost,
  Category,
  Combo,
  Coupon,
  DeliveryZone,
  Farmer,
  Package,
  Product,
  Review,
} from "./types";

/** Re-exported so callers keep one import for the read budget. */
export { READ_TIMEOUT_MS };

const warned = new Set<string>();

/**
 * A read that can distinguish "nothing matched" from "the database did not
 * answer". Callers that answer 404 / not-found on a null have to use this:
 * `safe(..., null)` turns a transient outage into a permanent-looking 404.
 * That is exactly how every /products/<slug> started 404-ing in production
 * while the catalogue itself looked healthy.
 */
export class DataUnavailableError extends Error {
  constructor(readonly key: string, cause?: unknown) {
    super(`database unavailable while reading "${key}"`);
    this.name = "DataUnavailableError";
    this.cause = cause;
  }
}

/**
 * Reads already in flight, by cache key.
 *
 * The homepage asks for `categories` twice — once for the category grid, once
 * for the product ring's filter chips — and `products` three times with
 * different filters. `unstable_cache` de-duplicates a *resolved* entry, but two
 * concurrent requests both miss and both hit Supabase: on a cold instance that
 * is two identical round-trips, and on a slow database two identical waits.
 * This shares the pending promise so the second caller joins the first.
 *
 * Cleared in `finally`, success or failure — a failed read must not be sticky.
 */
const inflight = new Map<string, Promise<{ value: unknown; ok: boolean }>>();

/**
 * Run a read, degrade to `empty` instead of throwing.
 *
 * `cacheKey` opts the read into the shared catalogue cache (off by default —
 * see lib/catalogue-cache.ts) and into in-flight de-duplication. It MUST
 * include every argument that changes the result: two different filters
 * sharing one key means one of them silently shows the other's rows. Reads
 * without a key stay direct, and that is the right default — anything scoped
 * to a signed-in visitor must never be shared between visitors.
 */
async function safe<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  empty: T,
  key = "catalogue",
  cacheKey?: (string | number | boolean)[]
): Promise<T> {
  const dedupeKey = cacheKey?.join(":") ?? null;

  let pending = dedupeKey ? (inflight.get(dedupeKey) as Promise<{ value: T; ok: boolean }> | undefined) : undefined;
  if (pending) {
    /* Joining an existing read: it is already bounded and already logged. */
    const outcome = await pending;
    return outcome.value ?? empty;
  }

  pending = readWithOutcome(
    "data",
    key,
    (signal) => (cacheKey ? cachedRead(cacheKey, () => fn(signal)) : fn(signal)),
    empty,
    READ_TIMEOUT_MS
  );

  if (dedupeKey) {
    inflight.set(dedupeKey, pending as Promise<{ value: unknown; ok: boolean }>);
    void pending.finally(() => inflight.delete(dedupeKey));
  }

  const outcome = await pending;
  if (!outcome.ok && !warned.has(key)) {
    warned.add(key);
    /* Kept because operators grep for it; lib/log.ts records every occurrence
       with a duration and a failure kind. Once per key per process. */
    console.warn(`[data] "${key}" read failed — serving an empty state`);
  }
  return outcome.value ?? empty;
}

/**
 * Like `safe`, but hands the caller a tri-state:
 *
 *   ok    — a row was found, or the query genuinely matched nothing
 *   error — the read failed; the caller must NOT claim "not found"
 */
export type Lookup<T> = { state: "ok"; value: T } | { state: "error"; error: unknown };

async function lookup<T>(fn: (signal: AbortSignal) => Promise<T>, key = "row"): Promise<Lookup<T>> {
  const outcome = await readWithOutcome("data", `lookup:${key}`, fn, undefined as unknown as T, READ_TIMEOUT_MS);
  if (outcome.ok) {
    logReadOk("data", `lookup:${key}`, 0);
    return { state: "ok", value: outcome.value };
  }
  if (!warned.has(`lookup:${key}`)) {
    warned.add(`lookup:${key}`);
    console.warn(`[data] "${key}" lookup failed — not reporting "not found"`);
  }
  return { state: "error", error: new DataUnavailableError(key) };
}

/* --------------------------------------------------------------- categories */
export function getCategories(activeOnly = true): Promise<Category[]> {
  return safe((signal) => q.getCategories(activeOnly, signal), [], "categories", ["categories", activeOnly]);
}

export function getCategoryBySlug(slug: string): Promise<Category | null> {
  return safe((signal) => q.getCategoryBySlug(slug, signal), null, "category", ["category", slug]);
}

/**
 * A stable cache key for a filter object. Object key order in JS is insertion
 * order, so two call sites writing `{limit, sort}` and `{sort, limit}` would
 * produce different keys for the same query — same data fetched twice.
 */
function filtersKey(filters: ProductFilters): string {
  return Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("&");
}

/* ----------------------------------------------------------------- products */
export type ProductFilters = q.ProductFilters;

export function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  return safe((signal) => q.getProducts(filters, signal), [], "products", ["products", filtersKey(filters)]);
}

export function getProductBySlug(slug: string): Promise<Product | null> {
  return safe((signal) => q.getProductBySlug(slug, signal), null, "product", ["product", slug]);
}

/** Slug lookups whose caller renders a 404 — never confuse outage with absence. */
export function lookupProductBySlug(slug: string): Promise<Lookup<Product | null>> {
  return lookup((signal) => q.getProductBySlug(slug, signal), "product");
}

export function lookupComboBySlug(slug: string): Promise<Lookup<Combo | null>> {
  return lookup((signal) => q.getComboBySlug(slug, signal), "combo");
}

export function lookupCategoryBySlug(slug: string): Promise<Lookup<Category | null>> {
  return lookup((signal) => q.getCategoryBySlug(slug, signal), "category");
}

export function lookupBlogPost(slug: string): Promise<Lookup<BlogPost | null>> {
  return lookup((signal) => q.getBlogPost(slug, signal), "post");
}

export function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return safe(
    (signal) => q.getRelatedProducts(product, limit, signal),
    [],
    "related",
    ["related", product.id, limit]
  );
}

/* ------------------------------------------------------- combos & packages */
export function getCombos(kind?: Combo["kind"]): Promise<Combo[]> {
  return safe((signal) => q.getCombos(kind, signal), [], "combos", ["combos", kind ?? "all"]);
}

export function getComboBySlug(slug: string): Promise<Combo | null> {
  return safe((signal) => q.getComboBySlug(slug, signal), null, "combo", ["combo", slug]);
}

export function getPackages(): Promise<Package[]> {
  return safe((signal) => q.getPackages(signal), [], "packages", ["packages"]);
}

/* ------------------------------------------------------------------ content */
export function getBlogPosts(limit = 12): Promise<BlogPost[]> {
  return safe((signal) => q.getBlogPosts(limit, signal), [], "blog", ["blog", limit]);
}

export function getBlogPost(slug: string): Promise<BlogPost | null> {
  return safe((signal) => q.getBlogPost(slug, signal), null, "post", ["post", slug]);
}

export function getFarmers(): Promise<Farmer[]> {
  return safe((signal) => q.getFarmers(signal), [], "farmers", ["farmers"]);
}

export function getBanners(placement = "home_hero"): Promise<Banner[]> {
  return safe((signal) => q.getBanners(placement, signal), [], "banners", ["banners", placement]);
}

export function getApprovedReviews(productId?: string, limit = 8): Promise<Review[]> {
  return safe(
    (signal) => q.getApprovedReviews(productId, limit, signal),
    [],
    "reviews",
    ["reviews", productId ?? "all", limit]
  );
}

/* Re-exported so write paths have one import for "forget the catalogue". */
export { invalidateCatalogue };

/* ---------------------------------------------------------------- logistics */
export function getDeliveryZones(): Promise<DeliveryZone[]> {
  return safe((signal) => q.getDeliveryZones(signal), [], "zones", ["zones"]);
}

export function getCouponByCode(code: string): Promise<Coupon | null> {
  return safe((signal) => q.getCouponByCode(code, signal), null, "coupon");
}

/* ------------------------------------------------------------------- orders */
export const getOrderByNo = q.getOrderByNo;
export const getOrdersForUser = q.getOrdersForUser;
export const getProductsByIds = q.getProductsByIds;
