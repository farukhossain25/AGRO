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
  return (data ?? []) as Combo[];
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
  let q = db().from("combos").select("*").eq("is_active", true).order("sort_order");
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Combo[];
}

export async function getComboBySlug(slug: string): Promise<Combo | null> {
  const { data } = await db().from("combos").select("*").eq("slug", slug).maybeSingle();
  return (data as Combo) ?? null;
}

export async function getPackages(): Promise<Package[]> {
  const { data, error } = await db()
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Package[];
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

export async function getFarmers(): Promise<Farmer[]> {
  const { data, error } = await db()
    .from("farmers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Farmer[];
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

export async function getApprovedReviews(productId?: string, limit = 8): Promise<Review[]> {
  let q = db()
    .from("reviews")
    .select("*")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (productId) q = q.eq("product_id", productId);
  const { data } = await q;
  return (data ?? []) as Review[];
}

/* --------------------------------------------------------------- logistics */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await db()
    .from("delivery_zones")
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
/** Normalise an order row so both dialects (order_no/tracking_id, phone/customer_phone, `items` jsonb + `order_items`) work. */
function normaliseOrder(row: Record<string, unknown>): Order & { order_items: OrderItem[] } {
  // dialect shims: expose lyih names from izem columns
  if (!row.order_no && row.tracking_id) row.order_no = row.tracking_id;
  if (!row.tracking_id && row.order_no) row.tracking_id = row.order_no;
  if (!row.phone && row.customer_phone) row.phone = row.customer_phone;
  if (!row.customer_phone && row.phone) row.customer_phone = row.phone;
  if (!row.email && row.customer_email) row.email = row.customer_email;
  if (!row.customer_email && row.email) row.customer_email = row.email;
  if (!row.delivery_note && row.note) row.delivery_note = row.note;
  if (!row.note && row.delivery_note) row.note = row.delivery_note;
  if (!row.payment_ref && row.transaction_id) row.payment_ref = row.transaction_id;

  // when order_items relation is missing/empty, synthesize from `items` jsonb (izem legacy)
  const items = row.order_items as OrderItem[] | undefined;
  if ((!items || items.length === 0) && Array.isArray(row.items)) {
    row.order_items = (row.items as unknown[]).map((raw: unknown, idx: number) => {
      const it = (raw as Record<string, unknown>) ?? {};
      return {
        id: (it.id as string) ?? `${row.id as string}-${idx}`,
        order_id: row.id as string,
        product_id: (it.product_id as string) ?? (it.id as string) ?? null,
        name_bn: (it.name_bn as string) ?? (it.name as string) ?? "পণ্য",
        unit: (it.unit as string) ?? "পিস",
        price: Number(it.price ?? 0),
        quantity: Number(it.quantity ?? 1),
        image: (it.image as string) ?? null,
        sub_order_id: null,
        seller_id: null,
        weight_grams: null,
      } as OrderItem;
    });
  }
  if (!row.order_items) row.order_items = [];
  return row as unknown as Order & { order_items: OrderItem[] };
}

export async function getOrderByNo(orderNo: string): Promise<(Order & { order_items: OrderItem[] }) | null> {
  const token = orderNo.toUpperCase().trim();
  // try lyih `order_no` first, then izem `tracking_id` for backwards compat
  try {
    const { data, error } = await db().from("orders").select("*, order_items(*)").eq("order_no", token).maybeSingle();
    if (!error && data) return normaliseOrder(data as Record<string, unknown>);
    if (error && !String(error.message ?? "").toLowerCase().includes("order_no") && (error as { code?: string }).code !== "42703") throw error;
  } catch {}
  try {
    const { data } = await db().from("orders").select("*, order_items(*)").eq("tracking_id", token).maybeSingle();
    if (data) return normaliseOrder(data as Record<string, unknown>);
  } catch {}
  // final fallback: try raw select without relation (covers when order_items missing)
  try {
    const { data } = await db().from("orders").select("*").eq("order_no", token).maybeSingle();
    if (data) return normaliseOrder(data as Record<string, unknown>);
    const { data: d2 } = await db().from("orders").select("*").eq("tracking_id", token).maybeSingle();
    if (d2) return normaliseOrder(d2 as Record<string, unknown>);
  } catch {}
  return null;
}

export async function getOrdersForUser(userId: string) {
  try {
    const { data, error } = await db().from("orders").select("*, order_items(*)").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (!error && data) return (data as Record<string, unknown>[]).map(normaliseOrder);
    if (error) throw error;
  } catch {}
  try {
    const { data } = await db().from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return ((data ?? []) as Record<string, unknown>[]).map(normaliseOrder);
  } catch {
    return [];
  }
}
