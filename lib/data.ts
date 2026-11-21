/**
 * Data access layer — Postgres first, static catalogue as a fallback.
 *
 * Every page/route imports from here instead of lib/queries.ts directly.
 * If Supabase is unreachable (offline dev, preview, outage) the storefront
 * still renders the full seeded catalogue instead of a 500 page.
 * Writes never fall back — see lib/db.ts.
 */
import { isDbConfigured } from "./db";
import * as q from "./queries";
import * as seed from "./seed-data";
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

async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured()) return fallback;
  try {
    const value = await fn();
    if (Array.isArray(value) && value.length === 0) return value; // genuinely empty
    if (value === null || value === undefined) return fallback;
    return value;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[data] falling back to static catalogue:", (error as Error).message);
    }
    return fallback;
  }
}

/* --------------------------------------------------------------- categories */
export function getCategories(activeOnly = true): Promise<Category[]> {
  const fallback = activeOnly ? seed.seedCategories : seed.seedCategories;
  return withFallback(() => q.getCategories(activeOnly), fallback);
}

/* ----------------------------------------------------------------- products */
export type ProductFilters = q.ProductFilters;

export function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  return withFallback(() => q.getProducts(filters), filterSeedProducts(filters));
}

function filterSeedProducts(f: ProductFilters): Product[] {
  let list = seed.seedProducts.slice();

  const categoryId =
    f.categoryId ??
    (f.categorySlug ? seed.seedCategories.find((c) => c.slug === f.categorySlug)?.id : undefined);

  if (f.categorySlug && !f.categoryId && !seed.seedCategories.some((c) => c.slug === f.categorySlug)) {
    return [];
  }
  if (categoryId) list = list.filter((p) => p.category_id === categoryId);
  if (f.featuredOnly) list = list.filter((p) => p.is_featured);
  if (f.inStockOnly) list = list.filter((p) => p.stock > 0);
  if (f.minPrice != null) list = list.filter((p) => p.price >= f.minPrice!);
  if (f.maxPrice != null) list = list.filter((p) => p.price <= f.maxPrice!);
  if (f.search) {
    const term = f.search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name_bn.toLowerCase().includes(term) ||
        p.name_en.toLowerCase().includes(term) ||
        (p.description_bn ?? "").toLowerCase().includes(term)
    );
  }

  switch (f.sort) {
    case "price_asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      break;
    case "rating":
      list.sort((a, b) => b.rating - a.rating);
      break;
    default:
      list.sort(
        (a, b) =>
          Number(b.is_featured) - Number(a.is_featured) ||
          +new Date(b.created_at) - +new Date(a.created_at)
      );
  }

  return f.limit ? list.slice(0, f.limit) : list;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return withFallback(
    () => q.getCategoryBySlug(slug),
    seed.seedCategories.find((c) => c.slug === slug) ?? null
  );
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return withFallback(
    () => q.getProductBySlug(slug),
    seed.seedProducts.find((p) => p.slug === slug) ?? null
  );
}

export function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return withFallback(
    () => q.getRelatedProducts(product, limit),
    seed.seedProducts
      .filter((p) => p.category_id === product.category_id && p.id !== product.id)
      .slice(0, limit)
  );
}

/* ------------------------------------------------------- combos & packages */
export function getCombos(kind?: Combo["kind"]): Promise<Combo[]> {
  return withFallback(
    () => q.getCombos(kind),
    kind ? seed.seedCombos.filter((c) => c.kind === kind) : seed.seedCombos
  );
}

export async function getComboBySlug(slug: string): Promise<Combo | null> {
  return withFallback(
    () => q.getComboBySlug(slug),
    seed.seedCombos.find((c) => c.slug === slug) ?? null
  );
}

export function getPackages(): Promise<Package[]> {
  return withFallback(() => q.getPackages(), seed.seedPackages);
}

/* ------------------------------------------------------------------ content */
export function getBlogPosts(limit = 12): Promise<BlogPost[]> {
  return withFallback(() => q.getBlogPosts(limit), seed.seedBlogPosts.slice(0, limit));
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return withFallback(
    () => q.getBlogPost(slug),
    seed.seedBlogPosts.find((p) => p.slug === slug) ?? null
  );
}

export function getFarmers(): Promise<Farmer[]> {
  return withFallback(() => q.getFarmers(), seed.seedFarmers);
}

export function getBanners(placement = "home_hero"): Promise<Banner[]> {
  return withFallback(() => q.getBanners(placement), seed.seedBanners as Banner[]);
}

export function getApprovedReviews(productId?: string, limit = 8): Promise<Review[]> {
  let fb = seed.seedReviews;
  if (productId) fb = fb.filter((r) => r.product_id === productId);
  return withFallback(() => q.getApprovedReviews(productId, limit), fb.slice(0, limit));
}

/* ---------------------------------------------------------------- logistics */
export function getDeliveryZones(): Promise<DeliveryZone[]> {
  return withFallback(() => q.getDeliveryZones(), seed.seedZones);
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  return withFallback(
    () => q.getCouponByCode(code),
    seed.seedCoupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase()) ?? null
  );
}

/* ------------------------------------------------------------------- orders */
export const getOrderByNo = q.getOrderByNo;
export const getOrdersForUser = q.getOrdersForUser;
export const getProductsByIds = q.getProductsByIds;
