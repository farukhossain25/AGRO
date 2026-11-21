import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { currentUser } from "@/lib/api";
import { buildLabel, paymentLabelBn } from "@/lib/parcels";
import { site } from "@/lib/site";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "শিপিং লেবেল", robots: { index: false } };

/**
 * A6 shipping label, laid out for thermal printers (100×150mm) and for
 * 4-up A4 sheets. Print CSS hides the app chrome.
 */
export default async function LabelPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin") redirect("/");

  const { orderNo } = await params;
  const result = await buildLabel(orderNo).catch(() => null);
  if (!result) notFound();

  const { parcel, token } = result;
  const qr = await import("qrcode");

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bishwasagro.com";
  const scanUrl = `${base.replace(/\/$/, "")}/p/${token}`;
  const svg = await qr.toString(scanUrl, {
    type: "svg",
    margin: 0,
    width: 150,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-[13px] text-sand-100/60 hover:text-mint"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> অর্ডারে ফিরে যান
        </Link>
        <PrintButton />
      </div>

      <style>{`
        @media print {
          @page { size: A6; margin: 4mm; }
          body { background: #fff !important; }
          .print\\:hidden { display: none !important; }
        }
        .label-sheet {
          background: #fff;
          color: #0b0d0c;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #d5d9d6;
          font-family: var(--font-hind), "Hind Siliguri", system-ui, sans-serif;
        }
      `}</style>

      <div className="label-sheet">
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#1f7a4d",
            color: "#fff",
            padding: "10px 14px",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>বিশ্বাস এগ্রো</div>
            <div style={{ fontSize: 8.5, opacity: 0.8 }}>Farm to Family · {site.domain}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 8, opacity: 0.75, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Order
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{parcel.order_no}</div>
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", gap: 12, padding: "12px 14px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Row label="গ্রাহক" value={parcel.customer_name} bold />
            <Row label="ফোন" value={parcel.phone} mono />
            <Row
              label="ঠিকানা"
              value={`${parcel.address}\n${parcel.upazila}, ${parcel.district}${parcel.division ? `, ${parcel.division}` : ""}`}
            />
            {parcel.delivery_note && (
              <div
                style={{
                  marginTop: 6,
                  padding: "4px 6px",
                  background: "#fff7e0",
                  border: "1px solid #f0dfa8",
                  borderRadius: 4,
                  fontSize: 8.5,
                }}
              >
                📝 {parcel.delivery_note}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Chip label="পণ্য" value={`${parcel.item_count}টি`} />
              <Chip
                label={parcel.payment_status === "paid" ? "পরিশোধিত" : "COD"}
                value={`৳${Number(parcel.total).toLocaleString("en-IN")}`}
                accent={parcel.payment_status !== "paid"}
              />
            </div>
          </div>

          {/* QR */}
          <div style={{ width: 108, textAlign: "center", flexShrink: 0 }}>
            <div
              style={{ width: 104, height: 104, border: "1px solid #e2e6e3", borderRadius: 4, padding: 2 }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <div style={{ fontSize: 7, color: "#5a655f", marginTop: 3, lineHeight: 1.3 }}>
              স্ক্যান করে ডেলিভারি কনফার্ম করুন
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px dashed #c9d0cc",
            padding: "7px 14px",
            fontSize: 8,
            color: "#5a655f",
          }}
        >
          <span>{paymentLabelBn[parcel.payment_method] ?? parcel.payment_method}</span>
          <span>{parcel.sources.join(" · ") || "বিশ্বাস এগ্রো"}</span>
          <span>{new Date(parcel.created_at).toLocaleDateString("en-GB")}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-[11.5px] text-sand-100/40 print:hidden">
        🖨️ প্রিন্ট করতে Ctrl/Cmd + P · থার্মাল প্রিন্টারে ১০০×১৫০মিমি সিলেক্ট করুন
      </p>
      <p className="mt-1 break-all text-center text-[10px] text-sand-100/25 print:hidden">{scanUrl}</p>

      <div className="mt-5 flex items-center justify-center gap-3 print:hidden">
        <Printer className="h-4 w-4 text-sand-100/30" />
        <span className="text-[11.5px] text-sand-100/40">
          একই লেবেল একাধিকবার প্রিন্ট করলে QR একই থাকে — সমস্যা নেই।
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 9, marginBottom: 4 }}>
      <span style={{ width: 40, flexShrink: 0, color: "#6a746e" }}>{label}</span>
      <span
        style={{
          flex: 1,
          fontWeight: bold ? 700 : 500,
          fontFamily: mono ? "monospace" : "inherit",
          whiteSpace: "pre-line",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        border: `1px solid ${accent ? "#e8b44a" : "#d5d9d6"}`,
        background: accent ? "#fff8e6" : "#f6f8f7",
        borderRadius: 4,
        padding: "3px 6px",
      }}
    >
      <div style={{ fontSize: 7, color: "#6a746e", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
