import { db, isDbConfigured } from "./db";
import { withReadDeadline } from "./read-deadline";
import type { Seller } from "./types";

/* ==========================================================================
   Sellers — multi-vendor marketplace layer
   --------------------------------------------------------------------------
   A seller owns products (products.seller_id) and, optionally, one farm
   (sellers.farm_id) which is what gives them live cameras.

   Money flow:  gross = Σ sub_orders.subtotal
                commission = gross × sellers.commission_percent / 100
                net = gross − commission
   ========================================================================== */

export type SellerSettings = {
  default_commission_percent: number;
  auto_approve: boolean;
  /** A verified seller's products go live without a per-product review. */
  auto_approve_products: boolean;
};

export const defaultSellerSettings: SellerSettings = {
  default_commission_percent: 10,
  auto_approve: false,
  auto_approve_products: true,
};

export async function getSellerSettings(): Promise<SellerSettings> {
  try {
    const { data } = await db()
      .from("site_settings")
      .select("value")
      .eq("key", "seller")
      .maybeSingle();
    if (!data?.value) return defaultSellerSettings;
    return { ...defaultSellerSettings, ...(data.value as Partial<SellerSettings>) };
  } catch {
    return defaultSellerSettings;
  }
}

/** sub_orders.status / orders.status → Bangla (same enum on both). */
export const orderStatusLabelBn: Record<string, string> = {
  received: "গৃহীত",
  packing: "প্যাকিং",
  shipped: "ডেলিভারির পথে",
  delivered: "সম্পন্ন",
  cancelled: "বাতিল",
};

export const sellerStatusLabelBn: Record<string, string> = {
  pending: "যাচাই চলছে",
  approved: "অনুমোদিত",
  rejected: "বাতিল",
  suspended: "স্থগিত",
};

export type SellerWithStats = Seller & {
  orders_count: number;
  gross: number;
  commission: number;
  net: number;
  product_count: number;
};

export async function getSellerByUser(userId: string): Promise<Seller | null> {
  if (!isDbConfigured()) return null;
  const { data, error } = await db().from("sellers").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as Seller) ?? null;
}

/**
 * Products an approved seller submitted while the per-product review still
 * existed. There is no admin screen that ever approved them, so they sat in
 * `pending` forever — invisible on the seller's own store page. The seller is
 * verified, so publish them (idempotent: touches pending rows only).
 */
export async function approvePendingSellerProducts(sellerId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const { count, error } = await db()
    .from("products")
    .update({ approval_status: "approved" }, { count: "exact" })
    .eq("seller_id", sellerId)
    .eq("approval_status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function getApprovedSellers(limit = 60): Promise<SellerWithStats[]> {
  /* Abortable and bounded, like every other storefront read.
     `dbUsable()` is still checked first — inside `withReadDeadline` — so an
     open breaker makes this free instead of paying the socket timeout again. */
  return withReadDeadline("sellers", "approved", (signal) => queryApprovedSellers(limit, signal), []);
}

async function queryApprovedSellers(limit: number, signal?: AbortSignal): Promise<SellerWithStats[]> {
  const client = db();
  const { data, error } = await client
    .from("sellers")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit)
    .abortSignal(signal as AbortSignal);

  if (error) throw error;
  const sellers = (data ?? []) as Seller[];
  if (!sellers.length) return [];

  const ids = sellers.map((s) => s.id);

  const [{ data: subs }, { data: prods }] = await Promise.all([
    client
      .from("sub_orders")
      .select("seller_id, subtotal, commission, seller_earning, status")
      .in("seller_id", ids),
    client.from("products").select("seller_id").in("seller_id", ids).eq("is_active", true),
  ]);

  // A cancelled order is not a sale — the row stays for the record, the
  // numbers must not count it.
  const agg = new Map<string, { orders: number; gross: number; commission: number; net: number }>();
  for (const row of subs ?? []) {
    if (!row.seller_id || row.status === "cancelled") continue;
    const cur = agg.get(row.seller_id) ?? { orders: 0, gross: 0, commission: 0, net: 0 };
    cur.orders += 1;
    cur.gross += Number(row.subtotal ?? 0);
    cur.commission += Number(row.commission ?? 0);
    cur.net += Number(row.seller_earning ?? 0);
    agg.set(row.seller_id, cur);
  }

  const productCount = new Map<string, number>();
  for (const p of prods ?? []) {
    if (!p.seller_id) continue;
    productCount.set(p.seller_id, (productCount.get(p.seller_id) ?? 0) + 1);
  }

  return sellers.map((s) => {
    const stats = agg.get(s.id) ?? { orders: 0, gross: 0, commission: 0, net: 0 };
    return {
      ...s,
      orders_count: stats.orders,
      gross: stats.gross,
      commission: stats.commission,
      net: stats.net,
      product_count: productCount.get(s.id) ?? 0,
    };
  });
}

/**
 * Public store lookup (approved only). With `ownerUserId` the status filter is
 * replaced by an ownership check, so a seller can preview their own page while
 * pending — the page shows it as a non-public preview instead of a 404.
 */
export async function getSellerBySlug(slug: string, opts: { ownerUserId?: string } = {}) {
  if (!isDbConfigured()) return null;

  const q = db()
    .from("sellers")
    .select("*")
    .eq("slug", slug);
  if (opts.ownerUserId) q.eq("user_id", opts.ownerUserId);
  else q.eq("status", "approved");

  const { data, error } = await q.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: products } = await db()
    .from("products")
    .select("*")
    .eq("seller_id", data.id)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("created_at", { ascending: false })
    .limit(48);

  return { seller: data as Seller, products: products ?? [] };
}

/** Split an order across sellers into sub_orders (called after createOrder). */
export async function createSubOrders(orderId: string, lines: Array<{ seller_id?: string | null; lineTotal: number }>) {
  const client = db();

  const grouped = new Map<string, number>();
  for (const line of lines) {
    if (!line.seller_id) continue;
    grouped.set(line.seller_id, (grouped.get(line.seller_id) ?? 0) + line.lineTotal);
  }
  if (!grouped.size) return [];

  const { data: sellers } = await client
    .from("sellers")
    .select("id, name_bn, commission_percent")
    .in("id", Array.from(grouped.keys()));

  const defaults = await getSellerSettings();
  const rows = (sellers ?? []).map((s, i) => {
    const subtotal = Math.round((grouped.get(s.id) ?? 0) * 100) / 100;
    const pct = Number(s.commission_percent ?? defaults.default_commission_percent);
    const commission = Math.round(subtotal * (pct / 100) * 100) / 100;
    return {
      order_id: orderId,
      sub_no: `SO-${Date.now().toString(36).toUpperCase()}-${i + 1}`,
      seller_id: s.id,
      seller_name: s.name_bn,
      subtotal,
      commission,
      seller_earning: Math.round((subtotal - commission) * 100) / 100,
      status: "received" as const,
    };
  });

  const { data, error } = await client.from("sub_orders").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export const payoutStatusLabelBn: Record<string, string> = {
  pending: "বাকি",
  paid: "পরিশোধিত",
  cancelled: "বাতিল",
};
