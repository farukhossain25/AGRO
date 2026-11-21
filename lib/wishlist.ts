import { db, isDbConfigured } from "./db";
import type { Product } from "./types";

/* ==========================================================================
   Wishlist reads (server side)
   ========================================================================== */

export async function getWishlistProductIds(userId: string): Promise<string[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data } = await db().from("wishlists").select("product_id").eq("user_id", userId);
    return (data ?? []).map((r) => r.product_id as string);
  } catch {
    return [];
  }
}

/** Full product rows for the wishlist page, newest first. */
export async function getWishlistProducts(userId: string): Promise<Product[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await db()
      .from("wishlists")
      .select(
        "created_at, products(id, slug, category_id, name_bn, name_en, description_bn, unit, unit_en, price, compare_price, stock, image, images, farm_source_bn, harvest_date, badge_bn, rating, review_count, is_featured, is_active, created_at, updated_at)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return [];

    return ((data ?? []) as unknown as { products: Product | null }[])
      .map((r) => r.products)
      .filter((p): p is Product => Boolean(p && p.is_active));
  } catch {
    return [];
  }
}
