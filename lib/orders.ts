import { db } from "./db";
import { getCombos, getDeliveryZones, getCouponByCode } from "./data";
import { getProductsByIds, getProductsBySlugs, getCombosBySlugs } from "./queries";
import { orderNumber } from "./format";
import { dhakaMetroThanas } from "./bd-locations";
import { getDeliverySettings } from "./site-settings";

export type IncomingItem = {
  id: string;
  kind: "product" | "combo";
  quantity: number;
  /** Sent by the cart since 2026-11 so a stale id can still be resolved. */
  slug?: string;
  /** Only used to name the product in an error message. */
  name?: string;
};

export type PricedLine = {
  product_id: string | null;
  name_bn: string;
  unit: string;
  price: number;
  quantity: number;
  image: string | null;
  seller_id?: string | null;
};

/** A cart line the server could not sell any more, with a reason in Bangla. */
export type UnavailableLine = {
  id: string;
  slug?: string;
  name: string;
  reason: string;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  hasCombo: boolean;
  unavailable: UnavailableLine[];
  /** Quantities the server lowered because stock was short. */
  adjusted: Array<{ id: string; name: string; requested: number; available: number }>;
};

/**
 * Re-prices the cart on the server. Never trusts client prices.
 *
 * Resolution order per line: product id → product slug → combo id → combo slug.
 * The slug fallback matters: the catalogue was re-seeded in 2026-11 with fresh
 * row ids, and every cart saved before that pointed at ids that no longer
 * existed — checkout then cried "কার্টে থাকা কোনো পণ্য এখন পাওয়া যাচ্ছে না"
 * while the cart page happily showed the items.
 */
export async function priceCart(items: IncomingItem[]): Promise<PricedCart> {
  const productIds = items.filter((i) => i.kind === "product").map((i) => i.id);
  const productSlugs = items
    .filter((i) => i.kind === "product" && i.slug)
    .map((i) => i.slug as string);
  const combosNeeded = items.some((i) => i.kind === "combo");

  const [productsById, productsBySlug, allCombos, combosBySlug] = await Promise.all([
    productIds.length ? getProductsByIds(productIds) : Promise.resolve([]),
    productSlugs.length ? getProductsBySlugs(productSlugs) : Promise.resolve([]),
    combosNeeded ? getCombos() : Promise.resolve([]),
    combosNeeded
      ? getCombosBySlugs(items.filter((i) => i.kind === "combo" && i.slug).map((i) => i.slug as string))
      : Promise.resolve([]),
  ]);

  const products = [...productsById, ...productsBySlug];
  const combos = [...allCombos, ...combosBySlug];

  const lines: PricedLine[] = [];
  const unavailable: UnavailableLine[] = [];
  const adjusted: PricedCart["adjusted"] = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));

    if (item.kind === "product") {
      const product =
        products.find((p) => p.id === item.id) ??
        (item.slug ? products.find((p) => p.slug === item.slug) : undefined);

      if (!product) {
        unavailable.push({
          id: item.id,
          slug: item.slug,
          name: item.name ?? "একটি পণ্য",
          reason: "পণ্যটি এখন আর বিক্রিতে নেই",
        });
        continue;
      }
      if (product.is_active === false) {
        unavailable.push({ id: product.id, slug: product.slug, name: product.name_bn, reason: "পণ্যটি বন্ধ আছে" });
        continue;
      }
      if (product.stock <= 0) {
        unavailable.push({ id: product.id, slug: product.slug, name: product.name_bn, reason: "স্টক শেষ" });
        continue;
      }

      let qty = quantity;
      if (product.stock < qty) {
        qty = product.stock;
        adjusted.push({ id: product.id, name: product.name_bn, requested: quantity, available: product.stock });
      }

      lines.push({
        product_id: product.id,
        name_bn: product.name_bn,
        unit: product.unit,
        price: Number(product.price),
        quantity: qty,
        image: product.image,
        seller_id: (product as { seller_id?: string | null }).seller_id ?? null,
      });
    } else {
      const combo =
        combos.find((c) => c.id === item.id) ??
        (item.slug ? combos.find((c) => c.slug === item.slug) : undefined);

      if (!combo) {
        unavailable.push({
          id: item.id,
          slug: item.slug,
          name: item.name ?? "একটি কম্বো",
          reason: "কম্বোটি এখন আর পাওয়া যাচ্ছে না",
        });
        continue;
      }
      lines.push({
        product_id: null,
        name_bn: combo.name_bn,
        unit: "বক্স",
        price: Number(combo.price),
        quantity,
        image: combo.image,
        seller_id: null,
      });
    }
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
  return { lines, subtotal, hasCombo: items.some((i) => i.kind === "combo"), unavailable, adjusted };
}

/**
 * Server-side delivery charge.
 *
 * Precedence, most specific first:
 *   1. a combo box  → always free, next-day
 *   2. subtotal     → free above `settings.delivery.free_over`
 *   3. named row    → a `delivery_zones` row for this district or division
 *   4. defaults     → `settings.delivery.inside_dhaka` / `.outside_dhaka`
 *
 * Steps 3 and 4 used to be one hard-coded 60 / 120 / 1200. Those numbers are
 * now the `settings.delivery` defaults, so /foisal/settings can change what a
 * customer is actually charged without a deploy.
 */
export async function computeDelivery(
  division: string,
  district: string,
  upazila: string,
  subtotal: number,
  hasCombo: boolean
): Promise<{ charge: number; eta: string }> {
  if (hasCombo) return { charge: 0, eta: "১ দিন" };

  const rules = await getDeliverySettings();
  if (subtotal >= rules.free_over) {
    return { charge: 0, eta: division === "ঢাকা" ? "আজ" : "২–৩ দিন" };
  }

  const zones = await getDeliveryZones();
  const isDhakaMetro = division === "ঢাকা" && dhakaMetroThanas.has(upazila);

  if (isDhakaMetro) {
    const zone = zones.find((z) => z.scope === "inside_dhaka" && z.is_active !== false);
    return { charge: Number(zone?.charge ?? rules.inside_dhaka), eta: zone?.eta_days ?? "আজ" };
  }

  const zone =
    zones.find((z) => z.district === district) ??
    zones.find((z) => z.division === division) ??
    zones.find((z) => z.scope === "outside_dhaka");

  return { charge: Number(zone?.charge ?? rules.outside_dhaka), eta: zone?.eta_days ?? "২–৩ দিন" };
}

/** Validates a coupon server-side and returns the discount amount. */
export async function computeDiscount(code: string | undefined, subtotal: number) {
  if (!code) return { discount: 0, couponCode: null as string | null, couponId: null as string | null };

  const coupon = await getCouponByCode(code);
  if (!coupon || !coupon.is_active) return { discount: 0, couponCode: null, couponId: null };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { discount: 0, couponCode: null, couponId: null };
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { discount: 0, couponCode: null, couponId: null };
  }
  if (subtotal < Number(coupon.min_order)) {
    return { discount: 0, couponCode: null, couponId: null };
  }

  let discount =
    coupon.type === "percent" ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  discount = Math.min(discount, subtotal);
  discount = Math.round(discount * 100) / 100;

  return { discount, couponCode: coupon.code, couponId: coupon.id };
}

/** Creates the order + items atomically-ish and returns the order row. */
export async function createOrder(params: {
  userId: string | null;
  customer: {
    customer_name: string;
    phone: string;
    email?: string;
    division: string;
    district: string;
    upazila: string;
    address: string;
    delivery_note?: string;
  };
  paymentMethod: "cod" | "bkash" | "nagad" | "sslcommerz";
  items: IncomingItem[];
  couponCode?: string;
}) {
  const priced = await priceCart(params.items);

  if (priced.unavailable.length) {
    const names = priced.unavailable.map((u) => `${u.name} (${u.reason})`).join(", ");
    const err = new Error(
      `কার্টে থাকা কিছু পণ্য এখন পাওয়া যাচ্ছে না — ${names}। কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।`
    ) as Error & { status?: number; unavailable?: UnavailableLine[] };
    err.status = 409;
    err.unavailable = priced.unavailable;
    throw err;
  }

  if (!priced.lines.length) {
    const err = new Error("আপনার কার্টে কোনো পণ্য নেই — প্রথমে পণ্য যোগ করুন।") as Error & {
      status?: number;
    };
    err.status = 422;
    throw err;
  }

  const { charge } = await computeDelivery(
    params.customer.division,
    params.customer.district,
    params.customer.upazila,
    priced.subtotal,
    priced.hasCombo
  );

  const { discount, couponCode, couponId } = await computeDiscount(params.couponCode, priced.subtotal);
  const total = Math.max(0, Math.round((priced.subtotal + charge - discount) * 100) / 100);

  const orderNo = orderNumber();
  const client = db();

  // Insert header with BOTH dialects so either schema reads it. `items` mirrors `order_items` for izem.
  const { data: order, error } = await client
    .from("orders")
    .insert({
      order_no: orderNo,
      tracking_id: orderNo,
      user_id: params.userId,
      customer_name: params.customer.customer_name,
      phone: params.customer.phone,
      customer_phone: params.customer.phone,
      email: params.customer.email || null,
      customer_email: params.customer.email || null,
      division: params.customer.division,
      district: params.customer.district,
      upazila: params.customer.upazila,
      address: params.customer.address,
      delivery_note: params.customer.delivery_note || null,
      note: params.customer.delivery_note || null,
      subtotal: priced.subtotal,
      delivery_charge: charge,
      discount,
      total,
      coupon_code: couponCode,
      payment_method: params.paymentMethod,
      payment_status: "pending",
      status: "received",
      items: priced.lines as unknown as never,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("[orders] order insert failed:", error.message, error.details ?? "", error.hint ?? "");
    throw error;
  }

  // keep `items` jsonb in sync for legacy readers (best-effort, never block checkout)
  try {
    await client.from("orders").update({ items: priced.lines as unknown as never } as never).eq("id", order.id);
  } catch {}

  const { error: itemsError } = await client
    .from("order_items")
    .insert(priced.lines.map((l) => ({ ...l, order_id: order.id })));

  if (itemsError) {
    console.error("[orders] order_items insert failed:", itemsError.message, itemsError.details ?? "");
    // roll back the header so we never leave a half-written order
    await client.from("orders").delete().eq("id", order.id);
    throw itemsError;
  }

  // decrement stock + bump coupon usage (best effort)
  for (const line of priced.lines) {
    if (!line.product_id) continue;
    const { data: current } = await client
      .from("products")
      .select("stock")
      .eq("id", line.product_id)
      .single();
    if (current) {
      await client
        .from("products")
        .update({ stock: Math.max(0, current.stock - line.quantity) })
        .eq("id", line.product_id);
    }
  }

  if (couponId) {
    const { data: c } = await client.from("coupons").select("used_count").eq("id", couponId).single();
    if (c) await client.from("coupons").update({ used_count: (c.used_count ?? 0) + 1 }).eq("id", couponId);
  }

  return { order, lines: priced.lines, deliveryCharge: charge, discount, total };
}
