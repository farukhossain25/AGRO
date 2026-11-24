import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parcelByToken } from "@/lib/parcels";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/api";
import { defaultStoreSettings, getStoreSettings } from "@/lib/site-settings";
import { site } from "@/lib/site";
import { ParcelDetails, type ParcelScanData } from "@/components/parcel/parcel-details";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "অর্ডারের তথ্য",
  robots: { index: false, follow: false },
};

type Sub = { id: string; sub_no: string; seller_name: string | null };
type Item = { sub_order_id: string | null; name_bn: string; unit: string | null; quantity: number; price: number | string };

/**
 * The QR target printed on every receipt: order details — marketplace, vendor,
 * products, what was paid — readable on any phone without an app or a login.
 * On the admin's box label it doubles as the rider's delivery screen (an admin
 * can mark delivery here).
 *
 * `?s=<subNo>` is the seller's/customer's receipt: it narrows the page to the
 * one vendor whose slip was scanned and hides the recipient's phone and
 * address. The presentation lives in components/parcel/parcel-details.tsx.
 */
export default async function ParcelScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { token } = await params;
  const { s: focusSub } = await searchParams;

  const [parcel, user, store] = await Promise.all([
    parcelByToken(token).catch(() => null),
    currentUser().catch(() => null),
    getStoreSettings().catch(() => defaultStoreSettings),
  ]);

  if (!parcel) notFound();

  const client = db();
  const { data: order } = await client
    .from("orders")
    .select(
      "order_no, customer_name, customer_phone, address, upazila, district, division, delivery_note, subtotal, delivery_charge, discount, total, payment_method, payment_status, coupon_code, status"
    )
    .eq("id", parcel.order_id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: subs }, { data: items }] = await Promise.all([
    client.from("sub_orders").select("id, sub_no, seller_name").eq("order_id", parcel.order_id),
    client.from("order_items").select("sub_order_id, name_bn, unit, quantity, price").eq("order_id", parcel.order_id),
  ]);

  const data: ParcelScanData = {
    brand: { nameBn: store.name, nameEn: store.name_en, tagline: site.taglineBn },
    store: { name: store.name, phoneDisplay: store.phone_display },
    order: {
      order_no: order.order_no,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      address: order.address,
      upazila: order.upazila,
      district: order.district,
      division: order.division,
      delivery_note: order.delivery_note,
      subtotal: order.subtotal,
      delivery_charge: order.delivery_charge,
      discount: order.discount,
      total: order.total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      coupon_code: order.coupon_code,
      status: order.status,
    },
    vendors: (subs ?? []) as unknown as Sub[],
    items: (items ?? []) as unknown as Item[],
    focusSubNo: focusSub ?? null,
    // A receipt QR (`?s=`) never shows the customer's phone or address.
    showDelivery: !focusSub,
    token,
    delivered: Boolean(parcel.delivered_at),
    canMarkDelivered: user?.role === "admin",
  };

  return <ParcelDetails data={data} />;
}
