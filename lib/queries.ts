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

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { data } = await db().from("products").select("*").in("id", ids);
  return (data ?? []) as Product[];
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
export async function getOrderByNo(orderNo: string): Promise<(Order & { order_items: OrderItem[] }) | null> {
  const { data } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_no", orderNo.toUpperCase().trim())
    .maybeSingle();
  return (data as (Order & { order_items: OrderItem[] }) | null) ?? null;
}

export async function getOrdersForUser(userId: string) {
  const { data } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
