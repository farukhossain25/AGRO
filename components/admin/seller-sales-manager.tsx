"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Search,
  Wallet,
  ChevronDown,
  ChevronUp,
  Package,
  Clock,
  Truck,
  XCircle,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { orderStatusLabelBn } from "@/lib/sellers";
import { sellerStatusLabelBn } from "@/lib/sellers";
import { toBn } from "@/lib/format";
import type { SellerSalesRow } from "@/lib/seller-sales";

const money = (n: number) => `৳${toBn(Math.round(Number(n || 0)).toLocaleString("en-US"))}`;
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });

const STATUS_TONE: Record<string, string> = {
  delivered: "bg-leaf-600/20 text-leaf-700",
  shipped: "bg-sky-500/15 text-sky-300",
  packing: "bg-amber-500/15 text-amber-300",
  received: "bg-amber-500/15 text-amber-300",
  cancelled: "bg-red-500/15 text-red-300",
};

export function SellerSalesManager({ rows, dbReady }: { rows: SellerSalesRow[]; dbReady: boolean }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name_bn.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.phone ?? "").includes(query.trim())
    );
  }, [rows, query]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (t, r) => ({
          sold: t.sold + r.sold,
          soldAmount: t.soldAmount + r.soldAmount,
          pending: t.pending + r.pending,
          payable: t.payable + r.payable,
          pendingAmount: t.pendingAmount + r.pendingAmount,
          owed: t.owed + r.owed,
          paidOut: t.paidOut + r.paidOut,
        }),
        { sold: 0, soldAmount: 0, pending: 0, payable: 0, pendingAmount: 0, owed: 0, paidOut: 0 }
      ),
    [filtered]
  );

  function exportCsv() {
    const head = ["সেলার", "স্টোর", "ফোন", "কমিশন %", "বিক্রয় (ডেলিভারি)", "বিক্রয়ের পরিমাণ", "পেন্ডিং অর্ডার", "প্রদেয় (এখন দেয়া যাবে)", "পেন্ডিং পরিমাণ", "পরিশোধিত", "লাইভ পণ্য", "পেন্ডিং পণ্য"];
    const lines = filtered.map((r) => [
      r.name_bn,
      r.slug,
      r.phone ?? "",
      String(r.commission_percent),
      String(r.sold),
      String(Math.round(r.soldAmount)),
      String(r.pending),
      String(Math.round(r.payable)),
      String(Math.round(r.pendingAmount)),
      String(Math.round(r.paidOut)),
      String(r.liveProducts),
      String(r.pendingProducts),
    ]);
    const csv = [head, ...lines]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seller-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV ডাউনলোড হয়েছে", `${filtered.length} জন সেলার`);
  }

  if (!dbReady) {
    return (
      <div className="card p-6 text-[12.5px] text-neu-muted">
        ডেটাবেস সংযোগ নেই — সেলার বিক্রয়ের তথ্য দেখানো যাচ্ছে না।
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-extrabold tracking-tight text-neu-ink">সেলার বিক্রয় ও পেমেন্ট</h1>
          <p className="mt-0.5 text-[12px] text-neu-muted">
            প্রতিটি সেলার কত বিক্রি করেছে, কতটি অর্ডার পেন্ডিং এ আছে এবং অ্যাডমিনের কাছে তার কত টাকা পাওনা/বাকি।
          </p>
        </div>
        <button onClick={exportCsv} className="btn-ghost btn-sm" disabled={!filtered.length}>
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Package} label="মোট বিক্রয়" value={`${toBn(totals.sold)} অর্ডার`} sub={money(totals.soldAmount)} />
        <Stat icon={Clock} label="পেন্ডিং অর্ডার" value={`${toBn(totals.pending)} অর্ডার`} sub={money(totals.pendingAmount)} subLabel="বন্দী অর্থ" />
        <Stat icon={Wallet} label="সেলারদের পাওনা" value={money(totals.payable)} sub={`মোট আয় ${money(totals.owed)}`} />
        <Stat icon={Truck} label="পরিশোধিত" value={money(totals.paidOut)} sub={`${toBn(filtered.length)} সেলার`} />
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neu-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-10"
          placeholder="সেলারের নাম, স্টোর বা ফোন দিয়ে খুঁজুন…"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-[12.5px] text-neu-muted">কোনো সেলার পাওয়া যায়নি</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-neu-line bg-neu-sunken/50 text-[10.5px] uppercase tracking-wider text-neu-muted">
                  <th className="px-4 py-3 font-semibold">সেলার</th>
                  <th className="px-3 py-3 text-right font-semibold">বিক্রয়</th>
                  <th className="px-3 py-3 text-right font-semibold">পেন্ডিং</th>
                  <th className="px-3 py-3 text-right font-semibold">প্রদেয়</th>
                  <th className="px-3 py-3 text-right font-semibold">বন্দী</th>
                  <th className="px-3 py-3 text-right font-semibold">লাইভ পণ্য</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const expanded = open === r.id;
                  return (
                    <tr key={r.id} className="border-b border-neu-line/60 last:border-0">
                      <td className="px-4 py-3.5">
                        <button onClick={() => setOpen(expanded ? null : r.id)} className="flex w-full items-start gap-3 text-left">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neu-raised text-[13px] font-bold text-neu-ink neu-shadow-raised-xs">
                            {r.name_bn.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-neu-ink">{r.name_bn}</p>
                            <p className="truncate text-[10.5px] text-neu-muted">
                              {r.slug} · {r.phone}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <p className="font-semibold text-neu-ink">{toBn(r.sold)}</p>
                        <p className="text-[10.5px] text-neu-muted">{money(r.soldAmount)}</p>
      </td>
                      <td className="px-3 py-3.5 text-right">
                        <p className="font-semibold text-amber-600">{toBn(r.pending)}</p>
                        <p className="text-[10.5px] text-neu-muted">{money(r.pendingAmount)}</p>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <p className="font-bold text-leaf-700">{money(r.payable)}</p>
                        <p className="text-[10.5px] text-neu-muted">
                          {r.owed > 0 ? `আয় ${money(r.owed)}` : ""}
                          {r.paidOut > 0 ? ` · দেওয়া ${money(r.paidOut)}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <p className="font-semibold text-neu-ink">{money(r.pendingAmount)}</p>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <p className="font-semibold text-neu-ink">{toBn(r.liveProducts)}</p>
                        {r.pendingProducts > 0 ? (
                          <p className="text-[10.5px] text-amber-600">{toBn(r.pendingProducts)} পেন্ডিং</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3.5 text-right">
                        {expanded ? <ChevronUp className="ml-auto h-4 w-4 text-neu-muted" /> : <ChevronDown className="ml-auto h-4 w-4 text-neu-muted" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* detail panel for the expanded seller */}
      {open ? (
        <SellerDetail
          row={filtered.find((r) => r.id === open) ?? null}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  subLabel,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub?: string;
  subLabel?: string;
}) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neu-raised neu-shadow-raised-xs">
        <Icon className="h-4 w-4 text-neu-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-neu-muted">{label}</p>
        <p className="mt-0.5 truncate text-[16px] font-extrabold text-neu-ink">{value}</p>
        {sub ? (
          <p className="truncate text-[10.5px] text-neu-muted">
            {subLabel ? `${subLabel}: ` : ""}
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SellerDetail({ row, onClose }: { row: SellerSalesRow | null; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!row) return null;
  // Narrowed copy: TS does not keep the null-check inside the closure below.
  const seller = row;

  /* Payments worth resetting: anything sold, anything pending, or a payout
     already recorded. A seller with none of these has nothing to wipe. */
  const hasPayments = row.sold + row.pending > 0 || row.paidOut > 0;

  async function resetPayments() {
    setBusy(true);
    try {
      const res = await fetch("/api/foisal/seller-payments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: seller.id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        data?: { removed?: Record<string, number> };
      } | null;
      if (!res.ok || !json?.ok) {
        toast.error(json?.message ?? "রিসেট করা যায়নি");
        return;
      }
      const removed = json.data?.removed ?? {};
      toast.success(
        `রিসেট হয়েছে — সাব-অর্ডার ${toBn(removed.sub_orders ?? 0)}টি, আইটেম ${toBn(
          removed.order_items ?? 0
        )}টি, পেআউট ${toBn(removed.seller_payouts ?? 0)}টি মুছে ফেলা হয়েছে। পণ্য অক্ষত আছে।`
      );
      setConfirming(false);
      onClose();
      router.refresh();
    } catch {
      toast.error("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-950/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold text-neu-ink">{row.name_bn}</h2>
            <p className="mt-0.5 text-[11.5px] text-neu-muted">
              {row.slug} · {row.phone} · কমিশন {toBn(row.commission_percent)}%
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasPayments ? (
              <button
                onClick={() => setConfirming(true)}
                className="btn btn-sm min-h-[36px] border border-red-200 bg-red-50 px-2.5 text-[11.5px] font-semibold text-red-600 transition hover:bg-red-100"
                title="এই সেলারের পেমেন্ট/অর্ডার রেকর্ড মুছে ফেলুন — পণ্য থাকবে"
              >
                <RotateCcw className="h-3.5 w-3.5" /> পেমেন্ট রিসেট
              </button>
            ) : null}
            <button onClick={onClose} className="neu-icon-btn" aria-label="বন্ধ">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="neu-inset-sm rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-neu-muted">বিক্রয়</p>
            <p className="mt-0.5 text-[15px] font-bold text-neu-ink">{toBn(row.sold)}</p>
            <p className="text-[10.5px] text-neu-muted">{money(row.soldAmount)}</p>
          </div>
          <div className="neu-inset-sm rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-neu-muted">পেন্ডিং</p>
            <p className="mt-0.5 text-[15px] font-bold text-amber-600">{toBn(row.pending)}</p>
            <p className="text-[10.5px] text-neu-muted">{money(row.pendingAmount)}</p>
          </div>
          <div className="neu-inset-sm rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-neu-muted">প্রদেয়</p>
            <p className="mt-0.5 text-[15px] font-bold text-leaf-700">{money(row.payable)}</p>
            <p className="text-[10.5px] text-neu-muted">আয় {money(row.owed)}</p>
          </div>
          <div className="neu-inset-sm rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-neu-muted">পরিশোধিত</p>
            <p className="mt-0.5 text-[15px] font-bold text-neu-ink">{money(row.paidOut)}</p>
            <p className="text-[10.5px] text-neu-muted">{row.payout_method ? `${row.payout_method} ${row.payout_number ?? ""}` : "পদ্ধতি নেই"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`chip ${row.status === "approved" ? "chip-active" : ""}`}>{sellerStatusLabelBn[row.status] ?? row.status}</span>
          <span className="chip">লাইভ পণ্য {toBn(row.liveProducts)}</span>
          {row.pendingProducts > 0 ? <span className="chip text-amber-600">পেন্ডিং পণ্য {toBn(row.pendingProducts)}</span> : null}
        </div>

        <h3 className="mt-4 text-[12.5px] font-bold text-neu-ink">সাম্প্রতিক অর্ডার</h3>
        {row.sub_orders.length === 0 ? (
          <p className="mt-1 text-[11.5px] text-neu-muted">কোনো অর্ডার নেই</p>
        ) : (
          <ul className="mt-1.5 divide-y divide-neu-line/70">
            {row.sub_orders.map((o) => (
              <li key={o.sub_no} className="flex items-center justify-between gap-2 py-2 text-[11.5px]">
                <div className="min-w-0">
                  <p className="truncate font-mono text-neu-muted">{o.sub_no}</p>
                  <p className="text-[10.5px] text-neu-muted">{when(o.created_at)}</p>
                </div>
                <span className={`badge ${STATUS_TONE[o.status] ?? ""}`}>{orderStatusLabelBn[o.status] ?? o.status}</span>
                <span className="w-20 shrink-0 text-right font-semibold text-neu-ink">{money(o.seller_earning)}</span>
      </li>
            ))}
          </ul>
        )}

        {confirming ? <ResetConfirm row={row} busy={busy} onCancel={() => setConfirming(false)} onConfirm={resetPayments} /> : null}

        <h3 className="mt-4 text-[12.5px] font-bold text-neu-ink">পণ্যসমূহ</h3>
        {row.products.length === 0 ? (
          <p className="mt-1 text-[11.5px] text-neu-muted">কোনো পণ্য নেই</p>
        ) : (
          <ul className="mt-1.5 divide-y divide-neu-line/70">
            {row.products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-[11.5px]">
                <div className="min-w-0">
                  <p className="truncate text-neu-ink">{p.name_bn}</p>
                  <p className="text-[10.5px] text-neu-muted">স্টক {toBn(p.stock)}</p>
                </div>
                <span
                  className={`badge ${
                    p.approval_status === "approved" && p.is_active
                      ? "bg-leaf-600/15 text-leaf-700"
                      : p.approval_status === "pending"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-neu-sunken text-neu-muted"
                  }`}
                >
                  {p.approval_status === "approved" && p.is_active ? "লাইভ" : p.approval_status === "pending" ? "অনুমোদন বাকি" : "বন্ধ"}
                </span>
                <span className="w-20 shrink-0 text-right font-semibold text-neu-ink">{money(p.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The confirmation for a destructive action: it spells out what disappears and,
   just as clearly, what does not. The seller's products are the whole point of
   the request, so they are named in the "stays" column, not implied.
   -------------------------------------------------------------------------- */
function ResetConfirm({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: SellerSalesRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-title"
    >
      <div className="card w-full max-w-md p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="reset-title" className="text-[15px] font-extrabold text-neu-ink">
              {row.name_bn} — পেমেন্ট রিসেট?
            </h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-neu-muted">
              এটি ফিরিয়ে আনা যাবে না। শুধু চালিয়ে যান যদি এই সেলারের বিক্রয়/পেমেন্ট রেকর্ড
              নতুন করে শুরু করতে চান।
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-red-200/70 bg-red-50/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">মুছে যাবে</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] text-neu-ink">
              <li>· {toBn(row.sold + row.pending)}টি সাব-অর্ডার ও তার আইটেম</li>
              <li>· {money(row.payable)} প্রদেয় ও কমিশন রেকর্ড</li>
              <li>· {money(row.paidOut)} পরিশোধিত পেআউট</li>
            </ul>
          </div>
          <div className="rounded-xl border border-leaf-600/20 bg-leaf-600/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-leaf-700">থেকে যাবে</p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] text-neu-ink">
              <li>· {toBn(row.liveProducts)}টি লাইভ পণ্য</li>
              <li>· সেলারের প্রোফাইল, খামার ও রিভিউ</li>
              <li>· স্টক ও পণ্যের দাম</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-ghost btn-sm min-h-[40px]" disabled={busy}>
            বাতিল
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="btn btn-danger btn-sm min-h-[40px] min-w-[130px]"
          >
            {busy ? "মুছে ফেলা হচ্ছে…" : "হ্যাঁ, রিসেট করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}
