import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { currentUser } from "@/lib/api";
import { buildLabel } from "@/lib/parcels";
import { qrSvg, scanUrlFor } from "@/lib/qr";
import { site } from "@/lib/site";
import { defaultStoreSettings, getStoreSettings } from "@/lib/site-settings";
import { formatDateBn, money, paymentLabelBn, toBn } from "@/lib/format";
import { orderStatusLabelBn } from "@/lib/sellers";
import { ReceiptSheet, type ReceiptSheetData } from "@/components/receipt/receipt-sheet";
import { PrintButton } from "@/components/admin/print-button";
import { ADMIN_BASE, ADMIN_LOGIN_PATH } from "@/lib/paths";

export const dynamic = "force-dynamic";

export const metadata = { title: "অর্ডার রসিদ", robots: { index: false } };

/**
 * The admin's receipt for one order — the SAME sheet the seller prints
 * (components/receipt/receipt-sheet.tsx), so the box never carries two
 * different-looking documents. This one covers the whole order, so the money
 * block shows what the customer paid rather than one vendor's share.
 *
 * buildLabel() owns the data: it caches this exact receipt as the parcel's
 * label snapshot (a reprint stays identical) and counts the print.
 */
export default async function LabelPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const user = await currentUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);
  if (user.role !== "admin") redirect("/");

  const { orderNo } = await params;
  const result = await buildLabel(orderNo).catch(() => null);
  if (!result) notFound();

  const { parcel, token } = result;
  const store = await getStoreSettings().catch(() => defaultStoreSettings);
  const scanUrl = scanUrlFor(`/p/${token}`);
  const svg = await qrSvg(scanUrl);

  const vendorNames = parcel.sources;
  const vendor =
    vendorNames.length === 0
      ? null
      : vendorNames.length === 1
        ? { name: vendorNames[0], detail: `${toBn(1)} ভেন্ডর · পণ্য ${toBn(parcel.item_count)}টি আইটেম` }
        : {
            name: `${toBn(vendorNames.length)} জন ভেন্ডরের অর্ডার`,
            detail: vendorNames.join(", "),
          };

  const data: ReceiptSheetData = {
    brand: { nameBn: store.name, nameEn: store.name_en, tagline: site.taglineBn, domain: site.domain },
    vendor,
    meta: [
      { label: "অর্ডার নম্বর", value: parcel.order_no, mono: true },
      { label: "তারিখ", value: formatDateBn(parcel.created_at) },
      { label: "স্টেটাস", value: orderStatusLabelBn[parcel.status] ?? parcel.status },
      { label: "পেমেন্ট", value: parcel.payment_status === "paid" ? "পরিশোধিত" : "বাকি" },
    ],
    customer: {
      name: parcel.customer_name,
      phone: parcel.phone,
      address: `${parcel.address}\n${parcel.upazila}, ${parcel.district}${parcel.division ? `, ${parcel.division}` : ""}`,
      note: parcel.delivery_note,
    },
    lines: parcel.items.map((i) => ({ name: i.name_bn, qty: i.quantity, unit: i.unit, price: i.price })),
    money: [
      { label: "পণ্যের মোট", value: money(parcel.subtotal) },
      { label: "ডেলিভারি চার্জ", value: parcel.delivery_charge === 0 ? "ফ্রি" : money(parcel.delivery_charge), muted: parcel.delivery_charge === 0 },
      { label: "কুপন ছাড়", value: `− ${money(parcel.discount)}`, muted: parcel.discount === 0 },
    ],
    total: { label: "মোট পরিশোধ", value: money(parcel.total) },
    payment: [
      paymentLabelBn[parcel.payment_method] ?? parcel.payment_method,
      parcel.payment_status === "paid" ? "পরিশোধিত" : "পেমেন্ট বাকি",
      parcel.coupon_code ? `কুপন ${parcel.coupon_code}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    qr: {
      svg,
      url: scanUrl,
      caption:
        "অর্ডারের তথ্য, ভেন্ডর ও পণ্যের তালিকা — স্ক্যান করলে যেকোনো ফোনে দেখা যাবে। ডেলিভারির সময় স্টাফ এখান থেকেই ডেলিভারি নিশ্চিত করতে পারবেন।",
      hint: scanUrl,
    },
    footer: `এই রসিদটি পণ্যের বাক্সের ভেতরে/গায়ে লাগিয়ে দিন · ${store.name} · ${store.phone_display}`,
    kind: "order",
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`${ADMIN_BASE}/orders`}
          className="inline-flex items-center gap-1.5 text-[13px] text-sand-100/60 hover:text-mint"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> অর্ডারে ফিরে যান
        </Link>
        <PrintButton />
      </div>

      <ReceiptSheet data={data} />

      <p className="mt-4 text-center text-[11.5px] text-sand-100/40 print:hidden">
        🖨️ প্রিন্ট করতে Ctrl/Cmd + P · থার্মাল প্রিন্টারে ১০০×১৫০মিমি সিলেক্ট করুন · QR-এর চারপাশের সাদা ফাঁক কেটে ফেলবেন না
      </p>
      <p className="mt-1 break-all text-center text-[10px] text-sand-100/25 print:hidden">{scanUrl}</p>

      <div className="mt-5 flex items-center justify-center gap-3 print:hidden">
        <Printer className="h-4 w-4 text-sand-100/30" />
        <span className="text-[11.5px] text-sand-100/40">
          সেলারের রসিদের সাথে একই ডিজাইন — একই অর্ডারে দুই রকম কাগজ যাবে না।
        </span>
      </div>
    </div>
  );
}

