"use client";

import Link from "next/link";
import { CheckCircle2, MapPin, Package, Phone, Store, Truck } from "lucide-react";
import { money, paymentLabelBn, toBn } from "@/lib/format";
import { orderStatusLabelBn } from "@/lib/sellers";
import { MarkDelivered } from "@/components/admin/mark-delivered";

export type ParcelScanData = {
  brand: { nameBn: string; nameEn: string; tagline: string };
  store: { name: string; phoneDisplay: string };
  order: {
    order_no: string;
    customer_name: string;
    customer_phone: string;
    address: string;
    upazila: string;
    district: string;
    division: string | null;
    delivery_note: string | null;
    subtotal: number | string;
    delivery_charge: number | string;
    discount: number | string;
    total: number | string;
    payment_method: string;
    payment_status: string;
    coupon_code: string | null;
    status: string;
  };
  vendors: { id: string; sub_no: string; seller_name: string | null }[];
  items: { sub_order_id: string | null; name_bn: string; unit: string | null; quantity: number; price: number | string }[];
  /** the one sub-order this slip was printed for, if the QR carried `?s=` */
  focusSubNo: string | null;
  /**
   * Show the recipient's name, phone and address. Only for the admin's box
   * label, which the rider carries. The seller's receipt goes to the customer
   * and may be photographed, so its QR (`?s=`) must not expose the customer's
   * phone and address to anyone who scans it.
   */
  showDelivery: boolean;
  token: string;
  delivered: boolean;
  canMarkDelivered: boolean;
};

/**
 * What the QR on the receipt opens — on any phone, no app, no login.
 *
 * An ORDER DETAILS page first (marketplace → vendor → products → what was
 * paid), because that is what the customer holding the box wants to read. On
 * the admin's box label it doubles as the rider's delivery screen. A
 * `?s=<subNo>` scan — the seller's/customer's receipt — narrows it to the one
 * vendor whose slip was scanned and withholds the recipient's phone and
 * address.
 */
export function ParcelDetails({ data }: { data: ParcelScanData }) {
  const { order } = data;
  const focus = data.focusSubNo
    ? data.vendors.find((v) => v.sub_no.toUpperCase() === data.focusSubNo?.toUpperCase()) ?? null
    : null;
  const shownVendors = focus ? [focus] : data.vendors;
  const shownItems = focus ? data.items.filter((i) => i.sub_order_id === focus.id) : data.items;

  const subtotal = Number(order.subtotal ?? 0);
  const delivery = Number(order.delivery_charge ?? 0);
  const discount = Number(order.discount ?? 0);
  const paid = order.payment_status === "paid";

  return (
    <div className="container-x max-w-md py-8 sm:py-12">
      {/* ── brand ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[26px] border border-white/60 bg-neu-raised shadow-neu-lg">
        <div
          className="relative px-5 pb-5 pt-6 text-white"
          style={{ background: "linear-gradient(135deg,#06350a 0%,#0a4d0a 78%,#1f7a2b 100%)" }}
        >
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" className="mt-0.5 shrink-0">
              <path d="M20 4C11 4 5 10 5 19c9 0 15-6 15-15Z" fill="#fff" opacity="0.96" />
              <path d="M5 19C9 15 13 11 20 4" stroke="#1f7a4d" strokeWidth="1.1" fill="none" opacity="0.55" />
            </svg>
            <div className="min-w-0 flex-1">
              <h1 className="text-[26px] font-extrabold leading-none tracking-tight">{data.brand.nameBn}</h1>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                {data.brand.nameEn}
              </p>
              <p className="mt-0.5 text-[11px] text-white/75">{data.brand.tagline}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.18em] text-white/60">অর্ডার নম্বর</p>
              <p className="font-mono text-[17px] font-bold">{order.order_no}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
              {data.delivered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
              {data.delivered ? "ডেলিভারি সম্পন্ন" : (orderStatusLabelBn[order.status] ?? order.status)}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* ── vendor ─────────────────────────────────────────────── */}
          {shownVendors.length > 0 ? (
            <section className="rounded-2xl border border-neu-accent/20 bg-neu-accent-soft/60 p-3.5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-neu-accent-strong">
                <Store className="h-3.5 w-3.5" /> ভেন্ডর
              </p>
              {shownVendors.map((v) => (
                <p key={v.id} className="mt-1 text-[15px] font-bold text-neu-ink">
                  {v.seller_name ?? data.store.name}
                </p>
              ))}
              {focus ? (
                <p className="mt-1 text-[10.5px] text-neu-muted">
                  এই রসিদ {focus.seller_name ?? data.store.name} এর পণ্যের জন্য · {focus.sub_no}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* ── products ───────────────────────────────────────────── */}
          <section>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-neu-muted">পণ্যের তালিকা</p>
            <ul className="mt-2 divide-y divide-neu-line/60">
              {shownItems.map((item, i) => {
                const qty = Number(item.quantity ?? 0);
                const price = Number(item.price ?? 0);
                return (
                  <li key={`${item.name_bn}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-[13.5px] font-medium text-neu-ink">{item.name_bn}</span>
                    <span className="shrink-0 text-[11.5px] text-neu-muted">
                      {toBn(qty)}
                      {item.unit ? ` ${item.unit}` : ""}
                    </span>
                    <span className="w-20 shrink-0 text-right text-[13px] font-semibold text-neu-ink">
                      {money(qty * price)}
                    </span>
                  </li>
                );
              })}
              {shownItems.length === 0 ? (
                <li className="py-2 text-[12px] text-neu-muted">কোনো পণ্য পাওয়া যায়নি</li>
              ) : null}
            </ul>
          </section>

          {/* ── money ──────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-neu-line/70 bg-white/60 p-3.5">
            <Row label="পণ্যের মোট" value={money(subtotal)} />
            <Row label="ডেলিভারি চার্জ" value={delivery === 0 ? "ফ্রি" : money(delivery)} />
            {discount > 0 ? <Row label="কুপন ছাড়" value={`− ${money(discount)}`} /> : null}
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-neu-line pt-2">
              <span className="text-[13px] font-bold text-neu-ink">মোট</span>
              <span className="text-[17px] font-extrabold text-neu-accent-strong">
                {money(Number(order.total ?? 0))}
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neu-muted">
              <Truck className="h-3.5 w-3.5" />
              {paymentLabelBn[order.payment_method] ?? order.payment_method} · {paid ? "পরিশোধিত" : "পরিশোধ বাকি"}
              {order.coupon_code ? ` · ${order.coupon_code}` : ""}
            </p>
          </section>

          {/* ── delivery (box label only — see showDelivery) ────────── */}
            {data.showDelivery ? (
              <section>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-neu-muted">ডেলিভারি</p>
              <p className="mt-1.5 text-[14px] font-bold text-neu-ink">{order.customer_name}</p>
              <a
                href={`tel:${order.customer_phone}`}
                className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-neu-accent-strong"
              >
                <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
              </a>
              <p className="mt-1.5 flex gap-1.5 text-[12.5px] leading-relaxed text-neu-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neu-accent" />
                <span>
                  {order.address}
                  <br />
                  <span className="text-neu-faint">
                    {order.upazila}, {order.district}
                    {order.division ? `, ${order.division}` : ""}
                  </span>
                </span>
              </p>
              {order.delivery_note ? (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-700">
                  📝 {order.delivery_note}
                </p>
              ) : null}
              </section>
          ) : null}

          {data.canMarkDelivered && !data.delivered ? <MarkDelivered token={data.token} /> : null}
        </div>
      </div>

      <div className="mt-5 text-center">
        <Link
          href={`/track?order=${order.order_no}`}
          className="text-[12px] text-neu-accent-strong hover:underline"
        >
          <Package className="mr-1 inline h-3.5 w-3.5" /> অর্ডার ট্র্যাক করুন
        </Link>
        <p className="mt-2 text-[10px] text-neu-faint">
          {data.store.name} · {data.store.phoneDisplay}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[12.5px]">
      <span className="text-neu-muted">{label}</span>
      <span className="font-semibold text-neu-ink">{value}</span>
    </div>
  );
}
