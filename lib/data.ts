/**
 * Storefront data facade.
 *
 * Every page/route imports from here instead of lib/queries.ts directly.
 * This layer has ONE job on top of the typed queries: make a page render even
 * when the database is empty, slow or unreachable.
 *
 *   • no rows          → an empty array / null  (the page shows its empty state)
 *   • database offline → the same empty shape + one console.warn
 *   • never             → a thrown error that reaches a customer
 *
 * Writes never come through here — they live in the route handlers, which do
 * surface errors (in Bangla) because the person must know a save failed.
 */
import { dbUsable } from "./db";
import * as q from "./queries";
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

/** Run a read, degrade to `empty` instead of throwing. */
async function safe<T>(fn: () => Promise<T>, empty: T, key = "catalogue"): Promise<T> {
  if (!dbUsable()) return empty;
  try {
    const value = await fn();
    return value ?? empty;
  } catch (error) {
    if (process.env.NODE_ENV !== "test" && !warned.has(key)) {
      warned.add(key);
      console.warn(
        `[data] "${key}" read failed — serving an empty state:`,
        (error as Error)?.message ?? error
      );
    }
    return empty;
  }
}

/**
 * Like `safe`, but hands the caller a tri-state:
 *
 *   ok    — a row was found, or the query genuinely matched nothing
 *   error — the read failed; the caller must NOT claim "not found"
 */
export type Lookup<T> = { state: "ok"; value: T } | { state: "error"; error: unknown };

async function lookup<T>(fn: () => Promise<T>, key = "row"): Promise<Lookup<T>> {
  try {
    if (!dbUsable()) throw new Error("database marked unreachable");
    const value = await fn();
    return { state: "ok", value };
  } catch (error) {
    if (process.env.NODE_ENV !== "test" && !warned.has(`lookup:${key}`)) {
      warned.add(`lookup:${key}`);
      console.warn(`[data] "${key}" lookup failed:`, (error as Error)?.message ?? error);
    }
    return { state: "error", error };
  }
}

/* --------------------------------------------------------------- categories */
export function getCategories(activeOnly = true): Promise<Category[]> {
  return safe(() => q.getCategories(activeOnly), [], "categories");
}

export function getCategoryBySlug(slug: string): Promise<Category | null> {
  return safe(() => q.getCategoryBySlug(slug), null, "category");
}

/* ----------------------------------------------------------------- products */
export type ProductFilters = q.ProductFilters;

export function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  return safe(() => q.getProducts(filters), [], "products");
}

export function getProductBySlug(slug: string): Promise<Product | null> {
  return safe(() => q.getProductBySlug(slug), null, "product");
}

/** Slug lookups whose caller renders a 404 — never confuse outage with absence. */
export function lookupProductBySlug(slug: string): Promise<Lookup<Product | null>> {
  return lookup(() => q.getProductBySlug(slug), "product");
}

export function lookupComboBySlug(slug: string): Promise<Lookup<Combo | null>> {
  return lookup(() => q.getComboBySlug(slug), "combo");
}

export function lookupCategoryBySlug(slug: string): Promise<Lookup<Category | null>> {
  return lookup(() => q.getCategoryBySlug(slug), "category");
}

export function lookupBlogPost(slug: string): Promise<Lookup<BlogPost | null>> {
  return lookup(() => q.getBlogPost(slug), "post");
}

export function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return safe(() => q.getRelatedProducts(product, limit), [], "related");
}

/* ------------------------------------------------------- combos & packages */
export function getCombos(kind?: Combo["kind"]): Promise<Combo[]> {
  return safe(() => q.getCombos(kind), [], "combos");
}

export function getComboBySlug(slug: string): Promise<Combo | null> {
  return safe(() => q.getComboBySlug(slug), null, "combo");
}

export function getPackages(): Promise<Package[]> {
  return safe(() => q.getPackages(), [], "packages");
}

/* ------------------------------------------------------------------ content */
export function getBlogPosts(limit = 12): Promise<BlogPost[]> {
  return safe(() => q.getBlogPosts(limit), [], "blog");
}

export function getBlogPost(slug: string): Promise<BlogPost | null> {
  return safe(() => q.getBlogPost(slug), null, "post");
}

export function getFarmers(): Promise<Farmer[]> {
  return safe(() => q.getFarmers(), [], "farmers");
}

export function getBanners(placement = "home_hero"): Promise<Banner[]> {
  return safe(() => q.getBanners(placement), [], "banners");
}

export function getApprovedReviews(productId?: string, limit = 8): Promise<Review[]> {
  return safe(() => q.getApprovedReviews(productId, limit), [], "reviews");
}

/* ---------------------------------------------------------------- logistics */
export function getDeliveryZones(): Promise<DeliveryZone[]> {
  return safe(() => q.getDeliveryZones(), [], "zones");
}

export function getCouponByCode(code: string): Promise<Coupon | null> {
  return safe(() => q.getCouponByCode(code), null, "coupon");
}

/* ------------------------------------------------------------------- orders */
export const getOrderByNo = q.getOrderByNo;
export const getOrdersForUser = q.getOrdersForUser;
export const getProductsByIds = q.getProductsByIds;
