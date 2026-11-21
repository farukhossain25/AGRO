import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

/* ==========================================================================
   Parcels + QR labels
   --------------------------------------------------------------------------
   Every order gets one parcel row with an unguessable qr_token. The label is
   an A6 shipping slip (printed 4-up on A4). Scanning the QR opens
   /p/<token> — a rider-facing page that shows the delivery details and lets
   staff mark the parcel delivered (requires an admin session).

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
  total: number;
  payment_method: string;
  payment_status: string;
  /** farm/seller names on this order — shown so the rider knows the source */
  sources: string[];
  created_at: string;
};

export function qrToken(orderNo: string): string {
  // Deterministic per order but unguessable without the secret.
  const secret = process.env.ORDER_QR_SECRET ?? process.env.JWT_SECRET ?? "biswas-agro";
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
    client.from("order_items").select("quantity, name_bn").eq("order_id", order.id),
    client.from("sub_orders").select("seller_name").eq("order_id", order.id),
  ]);

  const parcelRow = await ensureParcel(order.id, order.order_no);

  const label: ParcelLabel = {
    order_no: order.order_no,
    customer_name: order.customer_name,
    phone: order.phone,
    address: order.address,
    district: order.district,
    upazila: order.upazila,
    division: order.division,
    delivery_note: order.delivery_note,
    item_count: (items ?? []).reduce((n, i) => n + Number(i.quantity ?? 0), 0),
    total: Number(order.total),
    payment_method: order.payment_method,
    payment_status: order.payment_status,
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
  }

  return parcel;
}

export const paymentLabelBn: Record<string, string> = {
  cod: "ক্যাশ অন ডেলিভারি",
  bkash: "bKash",
  nagad: "Nagad",
  sslcommerz: "কার্ড / SSLCommerz",
  code: "অ্যাক্সেস কোড",
};
