import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, Package, Phone, Truck } from "lucide-react";
import { parcelByToken, paymentLabelBn, type ParcelLabel } from "@/lib/parcels";
import { currentUser } from "@/lib/api";
import { MarkDelivered } from "@/components/admin/mark-delivered";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "পার্সেল স্ক্যান",
  robots: { index: false, follow: false },
};

/**
 * Rider-facing page reached by scanning the QR on a shipping label.
 * Read-only for the public; only an admin session sees "ডেলিভারি সম্পন্ন".
 */
export default async function ParcelScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [parcel, user] = await Promise.all([
    parcelByToken(token).catch(() => null),
    currentUser().catch(() => null),
  ]);

  if (!parcel) notFound();

  const label = (parcel.label ?? {}) as Partial<ParcelLabel>;
  const delivered = Boolean(parcel.delivered_at);

  return (
    <div className="container-x max-w-md py-12">
      <div className="card overflow-hidden">
        <div className="border-b border-white/8 bg-leaf-900/30 p-5 text-center">
          <span className="text-2xl">{delivered ? "✅" : "📦"}</span>
          <p className="mt-1.5 text-[11px] uppercase tracking-wide text-sand-100/45">বিশ্বাস এগ্রো পার্সেল</p>
          <h1 className="mt-0.5 font-mono text-lg font-bold text-mint">{parcel.order_no}</h1>
          {delivered && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-leaf-600/25 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-200">
              <CheckCircle2 className="h-3 w-3" /> ডেলিভারি সম্পন্ন
            </span>
          )}
        </div>

        <div className="space-y-3 p-5">
          <div>
            <p className="text-[10.5px] uppercase tracking-wide text-sand-100/40">গ্রাহক</p>
            <p className="text-[14px] font-semibold text-white">{label.customer_name}</p>
            <a href={`tel:${label.phone}`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-mint">
              <Phone className="h-3 w-3" /> {label.phone}
            </a>
          </div>

          <div>
            <p className="text-[10.5px] uppercase tracking-wide text-sand-100/40">ঠিকানা</p>
            <p className="mt-0.5 flex gap-1.5 text-[12.5px] leading-relaxed text-sand-100/75">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
              <span>
                {label.address}
                <br />
                <span className="text-sand-100/50">
                  {label.upazila}, {label.district}, {label.division}
                </span>
              </span>
            </p>
            {label.delivery_note && (
              <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-200">
                📝 {label.delivery_note}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.03] p-2.5">
              <p className="text-[10px] text-sand-100/40">পণ্য</p>
              <p className="text-[13px] font-bold text-white">{label.item_count ?? 0}টি</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2.5">
              <p className="text-[10px] text-sand-100/40">সংগ্রহযোগ্য</p>
              <p className="text-[13px] font-bold text-mint">
                {label.payment_status === "paid" ? "প্রদত্ত" : `৳${Number(label.total ?? 0).toLocaleString("en-IN")}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11.5px] text-sand-100/50">
            <Truck className="h-3.5 w-3.5 text-mint" />
            {paymentLabelBn[label.payment_method ?? ""] ?? label.payment_method}
          </div>

          {(label.sources ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10.5px] text-sand-100/35">সোর্স:</span>
              {(label.sources ?? []).map((s) => (
                <span key={s} className="rounded-full bg-leaf-600/15 px-2 py-0.5 text-[10.5px] text-leaf-200">
                  {s}
                </span>
              ))}
            </div>
          )}

          {user?.role === "admin" && !delivered && <MarkDelivered token={token} />}
        </div>
      </div>

      <div className="mt-5 text-center">
        <Link href={`/track?order=${parcel.order_no}`} className="text-[12px] text-mint hover:underline">
          <Package className="mr-1 inline h-3 w-3" /> অর্ডার ট্র্যাক করুন
        </Link>
      </div>
    </div>
  );
}
