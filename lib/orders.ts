import { db } from "./db";
import { getProductsByIds, getCombos, getDeliveryZones, getCouponByCode } from "./data";
import { orderNumber } from "./format";
import { dhakaMetroThanas } from "./bd-locations";

export type IncomingItem = { id: string; kind: "product" | "combo"; quantity: number };

export type PricedLine = {
  product_id: string | null;
  name_bn: string;
  unit: string;
  price: number;
  quantity: number;
  image: string | null;
};

/**
 * Re-prices the cart on the server. Never trust client-supplied prices.
 * Returns null if any line references a missing/inactive product.
 */
export async function priceCart(items: IncomingItem[]): Promise<{
  lines: PricedLine[];
  subtotal: number;
  hasCombo: boolean;
} | null> {
  const productIds = items.filter((i) => i.kind === "product").map((i) => i.id);
  const comboIds = items.filter((i) => i.kind === "combo").map((i) => i.id);

  const [products, combos] = await Promise.all([
    productIds.length ? getProductsByIds(productIds) : Promise.resolve([]),
    comboIds.length ? getCombos() : Promise.resolve([]),
  ]);

  const lines: PricedLine[] = [];

  for (const item of items) {
    if (item.kind === "product") {
      const product = products.find((p) => p.id === item.id && p.is_active);
      if (!product) return null;
      if (product.stock < item.quantity) {
        // Clamp to available stock rather than failing the whole order
        if (product.stock <= 0) return null;
        item.quantity = product.stock;
      }
      lines.push({
        product_id: product.id,
        name_bn: product.name_bn,
        unit: product.unit,
        price: Number(product.price),
        quantity: item.quantity,
        image: product.image,
      });
    } else {
      const combo = combos.find((c) => c.id === item.id);
      if (!combo) return null;
      lines.push({
        product_id: null,
        name_bn: combo.name_bn,
        unit: "বক্স",
        price: Number(combo.price),
        quantity: item.quantity,
        image: combo.image,
      });
    }
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
  return { lines, subtotal, hasCombo: comboIds.length > 0 };
}

/** Server-side delivery charge: Dhaka metro thanas = 60, otherwise zone based. */
export async function computeDelivery(
  division: string,
  district: string,
  upazila: string,
  subtotal: number,
  hasCombo: boolean
): Promise<{ charge: number; eta: string }> {
  if (hasCombo) return { charge: 0, eta: "১ দিন" };

  if (subtotal >= 1200) return { charge: 0, eta: division === "ঢাকা" ? "আজ" : "২–৩ দিন" };

  const zones = await getDeliveryZones();
  const isDhakaMetro = division === "ঢাকা" && dhakaMetroThanas.has(upazila);

  if (isDhakaMetro) {
    const zone = zones.find((z) => z.scope === "inside_dhaka");
    return { charge: Number(zone?.charge ?? 60), eta: zone?.eta_days ?? "আজ" };
  }

  const zone =
    zones.find((z) => z.district === district) ??
    zones.find((z) => z.division === division) ??
    zones.find((z) => z.scope === "outside_dhaka");

  return { charge: Number(zone?.charge ?? 120), eta: zone?.eta_days ?? "২–৩ দিন" };
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
  if (!priced || !priced.lines.length) {
    const err = new Error("কার্টে থাকা কোনো পণ্য এখন পাওয়া যাচ্ছে না") as Error & { status?: number };
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

  const { data: order, error } = await client
    .from("orders")
    .insert({
      order_no: orderNo,
      user_id: params.userId,
      customer_name: params.customer.customer_name,
      phone: params.customer.phone,
      email: params.customer.email || null,
      division: params.customer.division,
      district: params.customer.district,
      upazila: params.customer.upazila,
      address: params.customer.address,
      delivery_note: params.customer.delivery_note || null,
      subtotal: priced.subtotal,
      delivery_charge: charge,
      discount,
      total,
      coupon_code: couponCode,
      payment_method: params.paymentMethod,
      payment_status: "pending",
      status: "received",
    })
    .select()
    .single();

  if (error) throw error;

  const { error: itemsError } = await client
    .from("order_items")
    .insert(priced.lines.map((l) => ({ ...l, order_id: order.id })));

  if (itemsError) {
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
