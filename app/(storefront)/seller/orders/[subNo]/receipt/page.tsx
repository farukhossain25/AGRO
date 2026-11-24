import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/api";
import { getSellerByUser } from "@/lib/sellers";
import { ensureParcel } from "@/lib/parcels";
import { qrSvg, scanUrlFor } from "@/lib/qr";
import { formatDateBn, money, paymentLabelBn, toBn } from "@/lib/format";
import { defaultStoreSettings, getStoreSettings } from "@/lib/site-settings";
import { orderStatusLabelBn } from "@/lib/sellers";
import { site } from "@/lib/site";
import { ADMIN_BASE } from "@/lib/paths";
import { ReceiptSheet, type ReceiptSheetData } from "@/components/receipt/receipt-sheet";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "রসিদ ও লেবেল",
  robots: { index: false, follow: false },
};

type Item = {
  name_bn: string;
  unit: string | null;
  quantity: number;
  price: number | string;
};

/**
 * The seller's receipt — the same document the admin panel prints.
 *
 * It goes to the customer too, so the marketplace leads and the vendor sits
 * right underneath it (see components/receipt/receipt-sheet.tsx). The money
 * block is still vendor-specific: the seller sees the discount share, the
 * commission and what they actually receive.
 *
 * The discount lives on the order, not on the items, so each seller's share is
 * their proportional slice — exactly how place_order() charged the customer.
 */
export default async function SellerReceiptPage({ params }: { params: Promise<{ subNo: string }> }) {
  const { subNo } = await params;
  const user = await currentUser().catch(() => null);
  if (!user) redirect(`/login?next=/seller/orders/${encodeURIComponent(subNo)}/receipt`);

  const client = db();
  const { data: sub } = await client
    .from("sub_orders")
    .select("*")
    .eq("sub_no", subNo.toUpperCase())
    .maybeSingle();

  if (!sub) notFound();

  const seller = await getSellerByUser(user.id).catch(() => null);
  const isAdmin = user.role === "admin";
  // A seller may print only their own slips; an admin may print any.
  if (!isAdmin && (!seller || sub.seller_id !== seller.id)) notFound();

  const { data: order } = await client.from("orders").select("*").eq("id", sub.order_id).maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: sellerRow }, store] = await Promise.all([
    client.from("order_items").select("name_bn, unit, quantity, price").eq("sub_order_id", sub.id),
    client
      .from("sellers")
      .select("name_bn, farm_address_bn, division, district, phone")
      .eq("id", sub.seller_id ?? "")
      .maybeSingle(),
    getStoreSettings().catch(() => defaultStoreSettings),
  ]);

  const parcel = await ensureParcel(order.id, order.order_no).catch(() => null);
  const token = parcel?.qr_token ?? "";
  // `?s=` makes the scan page open on THIS vendor's products, not just the order.
  const scanUrl = token
    ? `${scanUrlFor(`/p/${token}`)}?s=${encodeURIComponent(String(sub.sub_no))}`
    : "";
  const svg = token ? await qrSvg(scanUrl) : "";

  const lines = (items ?? []) as unknown as Item[];
  const orderSubtotal = Number(order.subtotal ?? 0);
  const subSubtotal = Number(sub.subtotal ?? 0);
  // Proportional share of the order-level discount, guarded against a zero subtotal.
  const discountShare =
    orderSubtotal > 0 ? Math.round((Number(order.discount ?? 0) * subSubtotal) / orderSubtotal) : 0;
  const commission = Number(sub.commission ?? 0);
  const earning = Number(sub.seller_earning ?? 0);
  const vendorName =
    (sellerRow as { name_bn?: string } | null)?.name_bn ?? (sub.seller_name as string) ?? store.name;
  const vendorAddress = [sellerRow?.farm_address_bn, sellerRow?.district, sellerRow?.division]
    .filter(Boolean)
    .join(", ");
  const vendorDetail = [vendorAddress, sellerRow?.phone].filter(Boolean).join(" · ");

  const data: ReceiptSheetData = {
    brand: {
      nameBn: store.name,
      nameEn: store.name_en,
      tagline: site.taglineBn,
      domain: site.domain,
    },
    vendor: { name: vendorName, detail: vendorDetail },
    meta: [
      { label: "অর্ডার নম্বর", value: order.order_no, mono: true },
      { label: "সাব-অর্ডার", value: sub.sub_no, mono: true },
      { label: "তারিখ", value: formatDateBn(order.created_at as string) },
      { label: "স্টেটাস", value: orderStatusLabelBn[sub.status] ?? String(sub.status) },
    ],
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      address: `${order.address}\n${order.upazila}, ${order.district}${order.division ? `, ${order.division}` : ""}`,
      note: order.delivery_note,
    },
    lines: lines.map((item) => ({
      name: item.name_bn,
      qty: Number(item.quantity ?? 0),
      unit: item.unit,
      price: Number(item.price ?? 0),
    })),
    money: [
      { label: "পণ্যের মোট", value: money(subSubtotal) },
      {
        label: "কুপন ছাড় (আপনার অংশ)",
        value: `− ${money(discountShare)}`,
        muted: discountShare === 0,
      },
      {
        label: `কমিশন (${toBn(subSubtotal > 0 ? Math.round((commission / subSubtotal) * 100) : 0)}%)`,
        value: `− ${money(commission)}`,
        muted: commission === 0,
      },
    ],
    total: { label: "আপনি পাবেন", value: money(earning) },
    payment: [
      paymentLabelBn[order.payment_method] ?? order.payment_method,
      order.payment_status === "paid" ? "পরিশোধিত" : "পেমেন্ট বাকি",
      order.coupon_code ? `কুপন ${order.coupon_code}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    qr: svg
      ? {
          svg,
          url: scanUrl,
          caption:
            "অর্ডার নম্বর, ভেন্ডরের নাম, পণ্যের তালিকা ও ডেলিভারি স্ট্যাটাস — যেকোনো ফোনের ক্যামেরা বা QR স্ক্যানারে দেখা যাবে।",
          hint: scanUrl,
        }
      : null,
    footer: `এই রসিদটি পণ্যের বাক্সের ভেতরে/গায়ে লাগিয়ে দিন · ${store.name} · ${store.phone_display}`,
    kind: "vendor",
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/seller"
          className="inline-flex items-center gap-1.5 text-[13px] text-sand-100/60 hover:text-mint"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> সেলার ড্যাশবোর্ড
        </Link>
        <PrintButton />
      </div>

      <ReceiptSheet data={data} />

      <p className="mt-4 text-center text-[11.5px] text-sand-100/40 print:hidden">
        🖨️ A6 (১০৫×১৪৮মিমি) বা থার্মাল প্রিন্টারে প্রিন্ট করুন · QR-এর চারপাশের সাদা ফাঁক রাখুন
      </p>

      {isAdmin ? (
        <p className="mt-2 text-center text-[11px] text-sand-100/30 print:hidden">
          অ্যাডমিন হিসেবে দেখছেন ·{" "}
          <Link href={`${ADMIN_BASE}/orders`} className="text-mint hover:underline">
            অর্ডার প্যানেলে ফিরে যান
          </Link>
        </p>
      ) : null}
    </div>
  );
}

