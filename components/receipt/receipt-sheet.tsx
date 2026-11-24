import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

/* ==========================================================================
   components/receipt/receipt-sheet.tsx — the ONE printed receipt
   --------------------------------------------------------------------------
   Both the admin's order receipt (/foisal/orders/[orderNo]/label) and the
   seller's packing slip (/seller/orders/[subNo]/receipt) render this exact
   component, so a seller and the panel can never hand out two different
   looking documents for the same order.

   Hierarchy on purpose:
     1. বিশ্বাস এগ্রো — the marketplace, the biggest thing on the paper. The
        customer receives this slip too, and they bought from the marketplace,
        not from an unknown farm.
     2. the vendor's name — clearly smaller, directly underneath, so the box
        still says who packed it.
     3. the order: numbers, recipient, products, money.
     4. the QR — order details, vendor and products behind it.

   Everything is inline-styled (no Tailwind) so the print output does not
   depend on which utility classes the page happened to load.
   ========================================================================== */

export type ReceiptLine = {
  name: string;
  qty: number;
  unit?: string | null;
  price: number;
};

export type ReceiptMoney = { label: string; value: string; muted?: boolean };
export type ReceiptMeta = { label: string; value: string; mono?: boolean };

export type ReceiptSheetData = {
  brand: { nameBn: string; nameEn: string; tagline?: string | null; domain?: string | null };
  /** the seller who packed this box — `null` when the receipt is marketplace-only */
  vendor: { name: string; detail?: string | null } | null;
  /** order / sub-order / date / status — up to three cells */
  meta: ReceiptMeta[];
  customer: { name: string; phone: string; address: string; note?: string | null };
  lines: ReceiptLine[];
  money: ReceiptMoney[];
  total: { label: string; value: string };
  /** one line: payment method + paid/pending + coupon */
  payment: string;
  qr: { svg: string; url: string; caption: string; hint?: string } | null;
  /** what the reader should do with the paper */
  footer: string;
  /** shown as a small chip in the header */
  kind: "vendor" | "order";
};

const C = {
  ink: "#0b0d0c",
  muted: "#5a655f",
  faint: "#8b948e",
  line: "#dfe5e1",
  soft: "#f5f8f6",
  brand: "#1f7a4d",
  brandDark: "#0d3b25",
  tint: "#eaf5ee",
  tintLine: "#bfe0cd",
};

const th: CSSProperties = {
  fontSize: 7,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#3f4b45",
  textAlign: "left",
  padding: "2px 4px",
  borderBottom: `1px solid ${C.line}`,
};

const td: CSSProperties = { fontSize: 8.5, padding: "2px 4px", verticalAlign: "top" };

export function ReceiptSheet({ data }: { data: ReceiptSheetData }) {
  const { brand, vendor } = data;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A6; margin: 4mm; }
          body { background: #fff !important; }
        }
        .rc-sheet {
          background: #fff;
          color: ${C.ink};
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
          border: 1px solid ${C.line};
          font-family: var(--font-hind), "Hind Siliguri", system-ui, sans-serif;
        }
        .rc-sheet table { width: 100%; border-collapse: collapse; }
      `}</style>

      <div className="rc-sheet">
        {/* ── brand band ─────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            padding: "9px 11px 8px",
            color: "#fff",
            background: `linear-gradient(135deg, ${C.brandDark} 0%, ${C.brand} 78%, #2c9a68 100%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            {/* the marketplace emblem — the same mark as the site header */}
            <Image
              src="/brand/logo-mark.webp"
              alt=""
              width={28}
              height={28}
              priority
              className="rounded-[7px] ring-1 ring-white/40"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* 1 — the marketplace, the biggest name on the paper */}
              <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.2 }}>
                {brand.nameBn}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                {brand.nameEn}
              </div>
              {brand.tagline ? (
                <div style={{ marginTop: 0, fontSize: 6.8, color: "rgba(255,255,255,0.72)" }}>
                  {brand.tagline}
                </div>
              ) : null}
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 99,
                  border: "1px solid rgba(255,255,255,0.4)",
                  fontSize: 6.5,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {data.kind === "vendor" ? "ভেন্ডর রসিদ" : "অর্ডার রসিদ"}
              </span>
            </div>
          </div>
        </div>

        {/* ── vendor — 2, deliberately smaller than the brand ────────── */}
        {vendor ? (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
              padding: "4px 11px 4px 10px",
              background: C.tint,
              borderLeft: `3px solid ${C.brand}`,
              borderBottom: `1px solid ${C.tintLine}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 6.5,
                  letterSpacing: 0.9,
                  textTransform: "uppercase",
                  color: "#4c7a62",
                  fontWeight: 700,
                }}
              >
                ভেন্ডর / Vendor
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.25 }}>{vendor.name}</div>
            </div>
            {vendor.detail ? (
              <div style={{ fontSize: 7, color: "#42604f", textAlign: "right", maxWidth: 150, lineHeight: 1.35 }}>
                {vendor.detail}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ padding: "8px 11px 5px" }}>
          {/* ── order numbers ────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {data.meta.map((m) => (
              <div key={m.label} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 6.5, letterSpacing: 0.6, textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    fontFamily: m.mono ? "ui-monospace, monospace" : "inherit",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── recipient ────────────────────────────────────────────── */}
          <div
            style={{
              border: `1px solid ${C.line}`,
              borderRadius: 5,
              padding: "5px 8px",
              marginBottom: 6,
              background: C.soft,
            }}
          >
            <div style={{ fontSize: 6.5, letterSpacing: 0.6, textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>
              প্রাপক / Recipient
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 1 }}>{data.customer.name}</div>
            <div style={{ fontSize: 8.5, color: "#33403a" }}>{data.customer.phone}</div>
            <div style={{ fontSize: 7.5, color: C.muted, marginTop: 1, whiteSpace: "pre-line", lineHeight: 1.35 }}>
              {data.customer.address}
            </div>
            {data.customer.note ? (
              <div style={{ marginTop: 2, fontSize: 7.5, color: "#8a5a00", background: "#fff7e0", border: "1px solid #f0dfa8", borderRadius: 3, padding: "2px 5px" }}>
                📝 {data.customer.note}
              </div>
            ) : null}
          </div>

          {/* ── products ─────────────────────────────────────────────── */}
          <table>
            <thead>
              <tr>
                <th style={th}>পণ্য</th>
                <th style={{ ...th, width: 38, textAlign: "center" }}>পরিমাণ</th>
                <th style={{ ...th, width: 40, textAlign: "right" }}>দাম</th>
                <th style={{ ...th, width: 46, textAlign: "right" }}>মোট</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr>
                  <td style={{ ...td, color: C.muted, fontStyle: "italic" }} colSpan={4}>
                    কোনো পণ্য নেই
                  </td>
                </tr>
              ) : (
                data.lines.map((line, i) => (
                  <tr key={`${line.name}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{line.name}</td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      {toBn(line.qty)}
                      {line.unit ? <span style={{ color: C.faint }}> {line.unit}</span> : null}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(line.price)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {money(line.qty * line.price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* ── money ────────────────────────────────────────────────── */}
          <div style={{ marginTop: 5, borderTop: `1px dashed ${C.line}`, paddingTop: 4 }}>
            {data.money.map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, padding: "1px 0" }}>
                <span style={{ color: row.muted ? C.faint : C.muted }}>{row.label}</span>
                <span style={{ color: row.muted ? C.faint : C.ink, fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 3,
                padding: "5px 9px",
                borderRadius: 5,
                color: "#fff",
                background: `linear-gradient(120deg, ${C.brandDark}, ${C.brand})`,
              }}
            >
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.2 }}>{data.total.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{data.total.value}</span>
            </div>

            <div style={{ fontSize: 7.5, color: C.muted, marginTop: 3 }}>{data.payment}</div>
          </div>

          {/* ── QR ───────────────────────────────────────────────────── */}
          {data.qr ? (
            <div style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 6 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  flexShrink: 0,
                  background: "#fff",
                  border: `1px solid ${C.line}`,
                  borderRadius: 4,
                  padding: 2,
                }}
                dangerouslySetInnerHTML={{ __html: data.qr.svg }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.brandDark }}>স্ক্যান করে অর্ডারের তথ্য</div>
                <div style={{ fontSize: 7.2, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>
                  {data.qr.caption}
                </div>
                {data.qr.hint ? (
                  <div style={{ fontSize: 6.5, color: C.faint, marginTop: 2, wordBreak: "break-all", lineHeight: 1.3 }}>{data.qr.url}</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── footer ───────────────────────────────────────────────── */}
          <div
            style={{
              marginTop: 5,
              paddingTop: 4,
              borderTop: `1px dashed ${C.line}`,
              fontSize: 6.6,
              lineHeight: 1.4,
              color: C.faint,
              textAlign: "center",
            }}
          >
            {data.footer}
            {brand.domain ? <span> · {brand.domain}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── tiny helpers (kept here so both receipts format money identically) ───── */

function money(n: number): string {
  return `৳${Number(n ?? 0).toLocaleString("en-IN")}`;
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function toBn(n: number): string {
  return String(Math.round(Number(n ?? 0))).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export type { ReactNode };
