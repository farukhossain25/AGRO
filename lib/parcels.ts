import { notify } from "./notify";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

/* ==========================================================================
   Parcels + QR labels
   --------------------------------------------------------------------------
   Every order gets one parcel row with an unguessable qr_token. The label is
   an A6 receipt — the SAME sheet the seller prints (components/receipt/
   receipt-sheet.tsx), so the box never carries two different documents.
   Scanning the QR opens /p/<token> — an order-details page (marketplace →
   vendor → products → what was paid) readable on any phone; for staff it also
   lets them mark the parcel delivered. `?s=<subNo>` narrows it to the one
   vendor whose slip was scanned.

   The QR itself is rendered from the token, so reprinting never changes it.
   ========================================================================== */

export type ParcelLabel = {
  order_no: string;
  customer_name: string;
  phone: string;
  address: string;
  district: string;
  upazila: string;
  division: string;
  delivery_note?: string | null;
  item_count: number;
  /** what the customer paid — the receipt's money block */
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  /** the lines on the receipt, in order */
  items: { name_bn: string; unit: string | null; quantity: number; price: number }[];
  /** farm/seller names on this order — shown so the rider knows the source */
  sources: string[];
  created_at: string;
};

export function qrToken(orderNo: string): string {
  // Deterministic per order but unguessable without the secret. Prefers
  // ORDER_QR_SECRET; otherwise derived from server-only Supabase credentials.
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}|${
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  }`;
  const secret =
    process.env.ORDER_QR_SECRET ??
    (base.length > 40 ? createHash("sha256").update(`order-qr:${base}`).digest("hex") : "biswas-agro");
  return createHash("sha256").update(`${orderNo}:${secret}:${randomBytes(4).toString("hex")}`).digest("hex").slice(0, 32);
}

export async function ensureParcel(orderId: string, orderNo: string) {
  const client = db();

  const { data: existing } = await client
    .from("parcels")
    .select("id, qr_token, printed_count")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await client
    .from("parcels")
    .insert({ order_id: orderId, order_no: orderNo, qr_token: qrToken(orderNo) })
    .select("id, qr_token, printed_count")
    .single();

  if (error) {
    // A concurrent request may have won the race — re-read.
    const { data: again } = await client
      .from("parcels")
      .select("id, qr_token, printed_count")
      .eq("order_id", orderId)
      .maybeSingle();
    if (again) return again;
    throw error;
  }

  return data;
}

export async function buildLabel(orderNo: string): Promise<{ parcel: ParcelLabel; token: string } | null> {
  const client = db();

  const { data: order, error } = await client
    .from("orders")
    .select("*")
    .eq("order_no", orderNo.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const [{ data: items }, { data: subs }] = await Promise.all([
    client
      .from("order_items")
      .select("name_bn, unit, quantity, price")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    client.from("sub_orders").select("seller_name").eq("order_id", order.id),
  ]);

  const parcelRow = await ensureParcel(order.id, order.order_no);

  const label: ParcelLabel = {
    order_no: order.order_no,
    customer_name: order.customer_name,
    phone: order.customer_phone,
    address: order.address,
    district: order.district,
    upazila: order.upazila,
    division: order.division,
    delivery_note: order.delivery_note,
    item_count: (items ?? []).reduce((n, i) => n + Number(i.quantity ?? 0), 0),
    subtotal: Number(order.subtotal ?? 0),
    delivery_charge: Number(order.delivery_charge ?? 0),
    discount: Number(order.discount ?? 0),
    total: Number(order.total),
    coupon_code: order.coupon_code ?? null,
    status: order.status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    items: ((items ?? []) as { name_bn: string; unit: string | null; quantity: number; price: number | string }[]).map(
      (i) => ({ name_bn: i.name_bn, unit: i.unit, quantity: Number(i.quantity ?? 0), price: Number(i.price ?? 0) })
    ),
    sources: Array.from(new Set((subs ?? []).map((s) => s.seller_name).filter(Boolean) as string[])),
    created_at: order.created_at,
  };

  // cache the snapshot so a reprint is identical even if the order changes
  await client
    .from("parcels")
    .update({ label, printed_count: (parcelRow.printed_count ?? 0) + 1 })
    .eq("id", parcelRow.id);

  return { parcel: label, token: parcelRow.qr_token };
}

export async function parcelByToken(token: string) {
  const { data, error } = await db()
    .from("parcels")
    .select("id, order_id, order_no, label, delivered_at, created_at")
    .eq("qr_token", token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Sent once when the parcel is scanned delivered: a single notification with a
 * deep link into the per-supplier review screen.
 */
async function notifyReviewInvite(orderId: string, orderNo: string) {
  const { data: order } = await db()
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.user_id) return;

  await notify({
    userId: order.user_id as string,
    audience: "user",
    kind: "order",
    title: "পণ্য পেয়েছেন? রিভিউ দিন ⭐",
    body: `অর্ডার ${orderNo} ডেলিভারি সম্পন্ন। প্রতিটি সেলার ও পণ্যকে আলাদাভাবে রেটিং দিন — ৭ দিনের মধ্যে সম্পাদনা করা যাবে।`,
    link: `/account/orders/${orderId}/review`,
    meta: { orderId, orderNo, cta: "review" },
    push: true,
  });
}

export async function markDelivered(token: string, userId?: string | null) {
  const client = db();
  const now = new Date().toISOString();

  const { data: parcel } = await client
    .from("parcels")
    .update({ delivered_at: now, delivered_by: userId ?? null })
    .eq("qr_token", token)
    .select("order_id, order_no")
    .maybeSingle();

  if (parcel?.order_id) {
    await client.from("orders").update({ status: "delivered", delivered_at: now }).eq("id", parcel.order_id);
    await client.from("sub_orders").update({ status: "delivered" }).eq("order_id", parcel.order_id);

    // invite the customer to review each supplier/product (section A)
    await notifyReviewInvite(parcel.order_id as string, parcel.order_no as string).catch(() => undefined);
  }

  return parcel;
}

// Moved to lib/format.ts (client-safe). Re-exported so existing imports keep working.
export { paymentLabelBn } from "./format";
