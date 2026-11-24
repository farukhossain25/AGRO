import { db } from "./db";
import type {
  Banner,
  BlogPost,
  Category,
  Combo,
  Coupon,
  DeliveryZone,
  Farmer,
  Order,
  OrderItem,
  Package,
  Product,
  Review,
} from "./types";

/* ------------------------------------------------------------------ catalog */
export async function getCategories(activeOnly = true): Promise<Category[]> {
  let q = db().from("categories").select("*").order("sort_order", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data } = await db().from("categories").select("*").eq("slug", slug).maybeSingle();
  return (data as Category) ?? null;
}

export type ProductFilters = {
  categorySlug?: string;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "featured" | "price_asc" | "price_desc" | "newest" | "rating";
  limit?: number;
  featuredOnly?: boolean;
  inStockOnly?: boolean;
};

export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  let categoryId = filters.categoryId;

  if (!categoryId && filters.categorySlug) {
    const cat = await getCategoryBySlug(filters.categorySlug);
    categoryId = cat?.id;
    if (!cat) return [];
  }

  let q = db().from("products").select("*").eq("is_active", true);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (filters.featuredOnly) q = q.eq("is_featured", true);
  if (filters.inStockOnly) q = q.gt("stock", 0);
  if (filters.minPrice != null) q = q.gte("price", filters.minPrice);
  if (filters.maxPrice != null) q = q.lte("price", filters.maxPrice);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim();
    if (term) q = q.or(`name_bn.ilike.%${term}%,name_en.ilike.%${term}%,description_bn.ilike.%${term}%`);
  }

  switch (filters.sort) {
    case "price_asc":
      q = q.order("price", { ascending: true });
      break;
    case "price_desc":
      q = q.order("price", { ascending: false });
      break;
    case "newest":
      q = q.order("created_at", { ascending: false });
      break;
    case "rating":
      q = q.order("rating", { ascending: false });
      break;
    default:
      q = q.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  }

  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await db().from("products").select("*").eq("slug", slug).maybeSingle();
  return (data as Product) ?? null;
}

/**
 * Products for the given ids, used when re-pricing a cart on the server.
 * Never swallows an error: an empty list here used to look identical to
 * "nobody sells this any more", which is exactly the wrong message to show a
 * customer at checkout.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { data, error } = await db().from("products").select("*").in("id", ids);
  if (error) throw error;
  return (data ?? []) as Product[];
}

/** Same lookup keyed by slug — lets a cart survive an id change. */
export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (!slugs.length) return [];
  const { data, error } = await db().from("products").select("*").in("slug", slugs);
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getCombosBySlugs(slugs: string[]): Promise<Combo[]> {
  if (!slugs.length) return [];
  const { data, error } = await db().from("combos").select("*").in("slug", slugs);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    contents: Array.isArray(row.contents) ? (row.contents as unknown as Combo["contents"]) : [],
  })) as Combo[];
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const { data } = await db()
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category_id", product.category_id ?? "")
    .neq("id", product.id)
    .limit(limit);
  return (data ?? []) as Product[];
}

/* ------------------------------------------------------- combos & packages */
export async function getCombos(kind?: "daily" | "weekly" | "monthly"): Promise<Combo[]> {
  let query = db().from("combos").select("*").eq("is_active", true).order("sort_order");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    contents: Array.isArray(row.contents) ? (row.contents as unknown as Combo["contents"]) : [],
  })) as Combo[];
}

export async function getComboBySlug(slug: string): Promise<Combo | null> {
  const { data } = await db().from("combos").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    contents: Array.isArray(data.contents) ? (data.contents as unknown as Combo["contents"]) : [],
  } as Combo;
}

/** Monthly family plans live in `subscription_plans` (was `packages`). */
export async function getPackages(): Promise<Package[]> {
  const { data, error } = await db()
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as Package[];
}

/* ------------------------------------------------------------------ content */
export async function getBlogPosts(limit = 12): Promise<BlogPost[]> {
  const { data, error } = await db()
    .from("blog_posts")
    .select("*")
    .eq("is_active", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BlogPost[];
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const { data } = await db().from("blog_posts").select("*").eq("slug", slug).maybeSingle();
  return (data as BlogPost) ?? null;
}

/**
 * The "our farmers" strip on /farm is built from the farms table now — a farm
 * IS the farmer profile, so there is no second table to keep in sync.
 */
export async function getFarmers(): Promise<Farmer[]> {
  // `sellers` (owner-seller of the farm) brings the logo / banner the seller
  // uploads from the dashboard; the banner doubles as the card's picture.
  // Falls back to the plain select on a database that predates migration 22.
  const cols =
    "id, name_bn, district, division, description_bn, owner_bio_bn, story_bn, established_year, cover, images, is_active, sort_order";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic select string
  type FarmRows = { data: any[] | null; error: { code?: string; message: string } | null };
  const query = (select: string): Promise<FarmRows> =>
    db().from("farms").select(select).eq("is_active", true).order("sort_order") as unknown as Promise<FarmRows>;
  let result = await query(`${cols}, sellers(slug, logo, banner)`);
  if (result.error && /sellers\.(logo|banner)|42703/i.test(`${result.error.code} ${result.error.message}`)) {
    result = await query(cols);
  }
  const { data, error } = result;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const seller = Array.isArray(row.sellers) ? row.sellers[0] : null;
    return {
      id: row.id,
      name_bn: row.name_bn,
      location_bn: [row.district, row.division].filter(Boolean).join(", ") || null,
      specialty_bn: row.description_bn,
      story_bn: row.story_bn ?? row.owner_bio_bn ?? null,
      years: row.established_year ? Math.max(1, new Date().getFullYear() - row.established_year) : 0,
      image: seller?.banner || row.cover || row.images?.[0] || null,
      logo: seller?.logo ?? null,
      is_active: row.is_active,
      sort_order: row.sort_order,
    };
  }) as Farmer[];
}

export async function getBanners(placement = "home_hero"): Promise<Banner[]> {
  const { data } = await db()
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .eq("placement", placement)
    .order("sort_order");
  return (data ?? []) as Banner[];
}

/**
 * Published reviews rendered as testimonials. A review row carries its own
 * display name for guests; for signed-in customers we fall back to the profile.
 */
export async function getApprovedReviews(productId?: string, limit = 8): Promise<Review[]> {
  let query = db()
    .from("reviews")
    .select("id, product_id, user_id, rating, comment, author_name, author_location, status, created_at")
    .eq("status", "published")
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (productId) query = query.eq("product_id", productId);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    user_id: row.user_id,
    name_bn: row.author_name ?? "একজন ক্রেতা",
    location_bn: row.author_location,
    rating: Number(row.rating),
    comment: row.comment ?? "",
    is_approved: row.status === "published",
    created_at: row.created_at ?? "",
  })) as Review[];
}

/* --------------------------------------------------------------- logistics */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await db()
    .from("delivery_charges")
    .select("*")
    .eq("is_active", true)
    .order("division");
  if (error) throw error;
  return (data ?? []) as DeliveryZone[];
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const { data } = await db()
    .from("coupons")
    .select("*")
    .ilike("code", code.trim())
    .maybeSingle();
  return (data as Coupon) ?? null;
}

/* ------------------------------------------------------------------ orders */
/**
 * One canonical shape reaches the UI: `phone`/`email`/`delivery_note` are kept
 * as friendly aliases of customer_phone/customer_email/delivery_note so the
 * storefront and the invoice keep reading the same fields.
 */
function shapeOrder(row: Record<string, unknown>): Order & { order_items: OrderItem[] } {
  const items = (row.order_items as OrderItem[] | undefined) ?? [];
  return {
    ...(row as unknown as Order),
    phone: (row.customer_phone as string) ?? (row.phone as string) ?? "",
    email: (row.customer_email as string | null) ?? (row.email as string | null) ?? null,
    order_items: items,
  };
}

export async function getOrderByNo(orderNo: string): Promise<(Order & { order_items: OrderItem[] }) | null> {
  const token = orderNo.toUpperCase().trim();
  const { data } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_no", token)
    .maybeSingle();
  return data ? shapeOrder(data as Record<string, unknown>) : null;
}

export async function getOrdersForUser(userId: string) {
  const { data, error } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(shapeOrder);
}
