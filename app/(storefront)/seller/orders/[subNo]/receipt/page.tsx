import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/api";
import { getSellerByUser } from "@/lib/sellers";
import { ensureParcel, paymentLabelBn } from "@/lib/parcels";
import { qrSvg, scanUrlFor } from "@/lib/qr";
import { formatDateBn, money, toBn } from "@/lib/format";
import { defaultStoreSettings, getStoreSettings } from "@/lib/site-settings";
import { orderStatusLabelBn } from "@/lib/sellers";
import { ADMIN_BASE } from "@/lib/paths";
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
 * The seller's packing slip — printed and stuck on the box.
 *
 * The seller never saw a printable document for their own sub-order: the only
 * label was the admin shipping label, which is customer-first and says nothing
 * about what the seller is owed. This one is vendor-first:
 *
 *   vendor name · items · the seller's share of the discount · commission ·
 *   what the seller actually receives · a QR any phone can scan
 *
 * The discount lives on the order (not on the items), so each seller's share is
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
  const scanUrl = token ? scanUrlFor(`/p/${token}`) : "";
  const svg = token ? await qrSvg(scanUrl) : "";

  const lines = (items ?? []) as unknown as Item[];
  const orderSubtotal = Number(order.subtotal ?? 0);
  const subSubtotal = Number(sub.subtotal ?? 0);
  // Proportional share of the order-level discount, guarded against a zero subtotal.
  const discountShare =
    orderSubtotal > 0 ? Math.round((Number(order.discount ?? 0) * subSubtotal) / orderSubtotal) : 0;
  const commission = Number(sub.commission ?? 0);
  const earning = Number(sub.seller_earning ?? 0);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/seller"
          className="inline-flex items-center gap-1.5 text-[13px] text-sand-100/60 hover:text-mint"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> সেলার ড্যাশবোর্ড
        </Link>
        <PrintButton />
      </div>

      <style>{`
        @media print {
          @page { size: A6; margin: 4mm; }
          body { background: #fff !important; }
        }
        .slip {
          background: #fff;
          color: #0b0d0c;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          border: 1px solid #d5d9d6;
          font-family: var(--font-hind), "Hind Siliguri", system-ui, sans-serif;
        }
        .slip table { width: 100%; border-collapse: collapse; }
      `}</style>

      <div className="slip">
        {/* vendor header — the seller's name, not the marketplace's */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            background: "#1f7a4d",
            color: "#fff",
            padding: "10px 12px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 8, opacity: 0.8, letterSpacing: 0.4, textTransform: "uppercase" }}>
              বিক্রেতা / Vendor
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
              {(sellerRow as { name_bn?: string } | null)?.name_bn ?? sub.seller_name ?? store.name}
            </div>
            <div style={{ fontSize: 8, opacity: 0.85 }}>
              {store.name} · মার্কেটপ্লেস অর্ডার
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 8, opacity: 0.8 }}>তারিখ</div>
            <div style={{ fontSize: 10, fontWeight: 600 }}>
              {formatDateBn(order.created_at as string)}
            </div>
          </div>
        </div>

        <div style={{ padding: "10px 12px" }}>
          {/* numbers */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <Label>অর্ডার নম্বর</Label>
              <Value mono>{order.order_no}</Value>
            </div>
            <div style={{ flex: 1 }}>
              <Label>সাব-অর্ডার</Label>
              <Value mono>{sub.sub_no}</Value>
            </div>
            <div style={{ flex: 1 }}>
              <Label>স্টেটাস</Label>
              <Value>{orderStatusLabelBn[sub.status] ?? sub.status}</Value>
            </div>
          </div>

          {/* customer */}
          <div
            style={{
              border: "1px solid #e2e6e3",
              borderRadius: 4,
              padding: "6px 8px",
              marginBottom: 8,
              background: "#f7f9f8",
            }}
          >
            <Label>প্রাপক</Label>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{order.customer_name}</div>
            <div style={{ fontSize: 9 }}>{order.customer_phone}</div>
            <div style={{ fontSize: 8.5, color: "#4a544e", marginTop: 2, whiteSpace: "pre-line" }}>
              {`${order.address}\n${order.upazila}, ${order.district}${order.division ? `, ${order.division}` : ""}`}
            </div>
            {order.delivery_note ? (
              <div style={{ fontSize: 8.5, color: "#8a5a00", marginTop: 2 }}>📝 {order.delivery_note}</div>
            ) : null}
          </div>

          {/* items */}
          <table>
            <thead>
              <tr style={{ background: "#eef3f0" }}>
                <th style={th}>পণ্য</th>
                <th style={{ ...th, width: 34 }}>পরিমাণ</th>
                <th style={{ ...th, width: 42, textAlign: "right" }}>দাম</th>
                <th style={{ ...th, width: 48, textAlign: "right" }}>মোট</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((item, i) => {
                const qty = Number(item.quantity ?? 0);
                const price = Number(item.price ?? 0);
                return (
                  <tr key={i} style={{ borderTop: "1px solid #eef1ef" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{item.name_bn}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {toBn(qty)}
                      {item.unit ? <span style={{ color: "#6a746e" }}> {item.unit}</span> : null}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{money(price)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(qty * price)}</td>
                  </tr>
                );
              })}
              {lines.length === 0 ? (
                <tr>
                  <td style={td} colSpan={4}>
                    কোনো পণ্য নেই
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* money — what the seller is actually owed */}
          <div style={{ marginTop: 8, borderTop: "1px dashed #c9d0cc", paddingTop: 6 }}>
            <MoneyRow label="পণ্যের মোট" value={money(subSubtotal)} />
            <MoneyRow label="কুপন ছাড় (আপনার অংশ)" value={`− ${money(discountShare)}`} muted={discountShare === 0} />
            <MoneyRow label={`কমিশন (${toBn(subSubtotal > 0 ? Math.round((commission / subSubtotal) * 100) : 0)}%)`} value={`− ${money(commission)}`} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
                padding: "5px 8px",
                background: "#eaf5ee",
                border: "1px solid #bfe0cd",
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700 }}>আপনি পাবেন</span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{money(earning)}</span>
            </div>
            <div style={{ fontSize: 8, color: "#5a655f", marginTop: 3 }}>
              {paymentLabelBn[order.payment_method] ?? order.payment_method} ·{" "}
              {order.payment_status === "paid" ? "পরিশোধিত" : "পেমেন্ট বাকি"}
              {order.coupon_code ? ` · কুপন ${order.coupon_code}` : ""}
            </div>
          </div>

          {/* QR */}
          {svg ? (
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  flexShrink: 0,
                  border: "1px solid #e2e6e3",
                  borderRadius: 4,
                  padding: 2,
                  background: "#fff",
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700 }}>স্ক্যান করে অর্ডারের তথ্য</div>
                <div style={{ fontSize: 8, color: "#5a655f", marginTop: 2, lineHeight: 1.35 }}>
                  যেকোনো ফোনের ক্যামেরা বা QR স্ক্যানার দিয়ে স্ক্যান করলে অর্ডারের স্ট্যাটাস ও ডেলিভারি তথ্য দেখা যাবে।
                </div>
                <div style={{ fontSize: 7, color: "#7a857f", marginTop: 3, wordBreak: "break-all" }}>{scanUrl}</div>
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 8,
              paddingTop: 5,
              borderTop: "1px dashed #c9d0cc",
              fontSize: 7.5,
              color: "#6a746e",
              textAlign: "center",
            }}
          >
            এই রসিদটি পণ্যের বাক্সের ভেতরে/গায়ে লাগিয়ে দিন · {store.name} · {store.phone_display}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11.5px] text-sand-100/40 print:hidden">
        🖨️ A6 (১০৫×১৪৮মিমি) বা থার্মাল প্রিন্টারে প্রিন্ট করুন · QR-এর চারপাশের সাদা ফাঁক রাখুন
      </p>

      {isAdmin ? (
        <p className="mt-2 text-center text-[11px] text-sand-100/30 print:hidden">
          অ্যাডমিন হিসেবে দেখছেন · <Link href={`${ADMIN_BASE}/orders`} className="text-mint hover:underline">অর্ডার প্যানেলে ফিরে যান</Link>
        </p>
      ) : null}
    </div>
  );
}

const th: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 700,
  textAlign: "left",
  padding: "3px 4px",
  color: "#4a544e",
};

const td: React.CSSProperties = {
  fontSize: 9,
  padding: "3px 4px",
};

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 7.5, color: "#6a746e", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</div>;
}

function Value({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, fontFamily: mono ? "monospace" : "inherit" }}>{children}</div>
  );
}

function MoneyRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, padding: "1px 0" }}>
      <span style={{ color: muted ? "#9aa49e" : "#4a544e" }}>{label}</span>
      <span style={{ color: muted ? "#9aa49e" : "#0b0d0c", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
