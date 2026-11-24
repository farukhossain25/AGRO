"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Download, Printer, QrCode, Search, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateTimeBn, money, toBn } from "@/lib/format";
import type { Order } from "@/lib/types";
import { adminHref } from "@/lib/paths";

const statuses = [
  { key: "received", label: "গৃহীত", tone: "bg-white/[0.07] text-sand-100/70" },
  { key: "packing", label: "প্যাকিং", tone: "bg-amber-500/15 text-amber-300" },
  { key: "shipped", label: "ডেলিভারির পথে", tone: "bg-sky-500/15 text-sky-300" },
  { key: "delivered", label: "সম্পন্ন", tone: "bg-leaf-600/20 text-leaf-700" },
  { key: "cancelled", label: "বাতিল", tone: "bg-red-500/15 text-red-300" },
];

export function OrderManager({ initial, dbReady }: { initial: Order[]; dbReady: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [orders, setOrders] = useState(initial);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter) list = list.filter((o) => o.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.order_no.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.phone.includes(q)
      );
    }
    return list;
  }, [orders, query, statusFilter]);

  const counts = useMemo(
    () =>
      statuses.reduce<Record<string, number>>((acc, s) => {
        acc[s.key] = orders.filter((o) => o.status === s.key).length;
        return acc;
      }, {}),
    [orders]
  );

  async function updateStatus(order: Order, status: string) {
    setBusy(order.id);
    try {
      const res = await fetch("/api/foisal/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "আপডেট ব্যর্থ");
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: status as Order["status"] } : o)));
      toast.success("স্টেটাস আপডেট হয়েছে", order.order_no);
      router.refresh();
    } catch (err) {
      toast.error("আপডেট ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function markPaid(order: Order) {
    setBusy(order.id);
    try {
      const res = await fetch("/api/foisal/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, payment_status: "paid" }),
      });
      if (!res.ok) throw new Error("আপডেট ব্যর্থ");
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, payment_status: "paid" } : o)));
      toast.success(
        order.payment_ref ? `ভেরিফাই হয়েছে — TrxID: ${order.payment_ref}` : "পেমেন্ট পরিশোধিত হিসেবে চিহ্নিত",
        order.order_no
      );
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    const header = ["অর্ডার", "তারিখ", "কাস্টমার", "ফোন", "জেলা", "স্টেটাস", "পেমেন্ট", "সাবটোটাল", "ডেলিভারি", "ছাড়", "মোট"];
    const rows = filtered.map((o) => [
      o.order_no,
      new Date(o.created_at).toISOString(),
      o.customer_name,
      o.phone,
      o.district,
      o.status,
      o.payment_status,
      o.subtotal,
      o.delivery_charge,
      o.discount,
      o.total,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV ডাউনলোড হয়েছে");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">অর্ডার ব্যবস্থাপনা</h1>
          <p className="text-[12px] text-sand-100/45">{toBn(orders.length)}টি অর্ডার</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost btn-sm">
          <Download className="h-4 w-4" /> CSV রপ্তানি
        </button>
      </div>

      {!dbReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — অর্ডার লোড করা যাচ্ছে না।
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-52">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="অর্ডার নম্বর / নাম / ফোন"
            className="input !rounded-full !py-2.5 !pl-10 text-[12.5px]"
          />
        </label>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <button onClick={() => setStatusFilter("")} className={`chip shrink-0 ${!statusFilter ? "chip-active" : ""}`}>
            সব ({toBn(orders.length)})
          </button>
          {statuses.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`chip shrink-0 ${statusFilter === s.key ? "chip-active" : ""}`}
            >
              {s.label} ({toBn(counts[s.key] ?? 0)})
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">অর্ডার</th>
                <th className="px-2 py-2.5 font-medium">কাস্টমার</th>
                <th className="px-2 py-2.5 font-medium">এলাকা</th>
                <th className="px-2 py-2.5 font-medium">পেমেন্ট</th>
                <th className="px-2 py-2.5 font-medium">স্টেটাস</th>
                <th className="px-3 py-2.5 text-right font-medium">মোট</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-white/[0.02]" onClick={() => setSelected(o)}>
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-[11px] text-leaf-200">{o.order_no}</p>
                    <p className="text-[9.5px] text-sand-100/30">{formatDateTimeBn(o.created_at)}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="truncate">{o.customer_name}</p>
                    <p className="text-[9.5px] text-sand-100/30">{o.phone}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <p>{o.district}</p>
                    <p className="text-[9.5px] text-sand-100/30">{o.upazila}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`badge !text-[9px] ${o.payment_status === "paid" ? "bg-leaf-600/20 text-leaf-700" : "bg-amber-500/15 text-amber-300"}`}>
                      {o.payment_status === "paid" ? "পরিশোধিত" : "বাকি"}
                    </span>
                    <p className="mt-0.5 text-[9px] uppercase text-sand-100/30">{o.payment_method}</p>
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={o.status}
                      onChange={(e) => updateStatus(o, e.target.value)}
                      disabled={busy === o.id}
                      className="input !w-auto !rounded-lg !px-2 !py-1 !text-[10.5px]"
                    >
                      {statuses.map((s) => (
                        <option key={s.key} value={s.key} className="bg-ink-800">{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{money(Number(o.total), true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো অর্ডার পাওয়া যায়নি</p>
        ) : null}
      </div>

      {/* invoice drawer */}
      {selected ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6 print:bg-white print:p-0">
          <div className="card my-4 w-full max-w-lg p-5 print:border-0 print:bg-white print:text-black">
            <div className="flex items-center justify-between print:hidden">
              <h2 className="text-[15px] font-bold">অর্ডার বিস্তারিত</h2>
              <div className="flex gap-1">
                <button onClick={() => window.print()} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="প্রিন্ট">
                  <Printer className="h-4 w-4" />
                </button>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="বন্ধ">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 border-b border-white/[0.08] pb-3 print:border-black/20">
              <p className="text-[16px] font-bold">বিশ্বাস এগ্রো — ইনভয়েস</p>
              <p className="font-mono text-[11px]">{selected.order_no}</p>
              <p className="text-[10.5px] text-sand-100/45 print:text-black/60">{formatDateTimeBn(selected.created_at)}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
              <div>
                <p className="text-[9.5px] uppercase tracking-wider opacity-50">বিল টু</p>
                <p className="font-semibold">{selected.customer_name}</p>
                <p>{selected.phone}</p>
                {selected.email ? <p className="opacity-70">{selected.email}</p> : null}
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-wider opacity-50">ডেলিভারি ঠিকানা</p>
                <p>{selected.address}</p>
                <p>{selected.upazila}, {selected.district}, {selected.division}</p>
              </div>
            </div>

            {/* ── payment verification ─────────────────────────────────────── */}
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 print:border-black/15 print:bg-black/[0.02]">
              <div className="flex items-center justify-between">
                <p className="text-[9.5px] uppercase tracking-wider opacity-50">পেমেন্ট যাচাই</p>
                <span className={`badge !text-[9px] ${selected.payment_status === "paid" ? "bg-leaf-600/20 text-leaf-700" : "bg-amber-500/15 text-amber-300"}`}>
                  {selected.payment_status === "paid" ? "পরিশোধিত" : "বাকি"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                <span className="opacity-60">মাধ্যম</span>
                <span className="font-medium uppercase">{selected.payment_method}</span>
              </div>
              {selected.payment_ref ? (
                <>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <span className="opacity-60">TrxID</span>
                    <span className="break-all text-right font-mono text-[11px] text-leaf-200">{selected.payment_ref}</span>
                  </div>
                  {selected.payment_ref.includes(" | ") ? (
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="opacity-60">প্রেমিত নম্বর</span>
                      <span className="break-all text-right font-mono text-[11px]">{selected.payment_ref.split(" | ")[1]}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-[10.5px] italic opacity-50">
                  গ্রাহক TrxID জমা দেননি — টাকা পাওয়ার পর চিহ্নিত করুন
                </p>
              )}
            </div>

            <table className="mt-3 w-full text-[11.5px]">
              <thead className="border-y border-white/[0.08] text-[9.5px] uppercase tracking-wider opacity-50 print:border-black/20">
                <tr>
                  <th className="py-1.5 text-left font-medium">পণ্য</th>
                  <th className="py-1.5 text-center font-medium">পরিমাণ</th>
                  <th className="py-1.5 text-right font-medium">মূল্য</th>
                </tr>
              </thead>
              <tbody>
                {(selected.order_items ?? []).map((it) => (
                  <tr key={it.id} className="border-b border-white/[0.04] print:border-black/10">
                    <td className="py-1.5">{it.name_bn}</td>
                    <td className="py-1.5 text-center">{toBn(it.quantity)}</td>
                    <td className="py-1.5 text-right">{money(Number(it.price) * it.quantity, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 space-y-1 text-[11.5px]">
              <div className="flex justify-between">
                <span className="opacity-60">সাবটোটাল</span>
                <span>{money(Number(selected.subtotal), true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">ডেলিভারি</span>
                <span>{money(Number(selected.delivery_charge), true)}</span>
              </div>
              {Number(selected.discount) > 0 ? (
                <div className="flex justify-between">
                  <span className="opacity-60">ছাড় {selected.coupon_code ? `(${selected.coupon_code})` : ""}</span>
                  <span>−{money(Number(selected.discount), true)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-white/[0.08] pt-1.5 text-[13px] font-bold print:border-black/20">
                <span>সর্বমোট</span>
                <span>{money(Number(selected.total), true)}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              {selected.payment_status !== "paid" ? (
                <button
                  onClick={() => markPaid(selected)}
                  disabled={busy === selected.id}
                  className="btn-primary btn-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> ভেরিফাই করুন (পরিশোধিত)
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-leaf-600/15 px-3 py-1.5 text-[11px] font-semibold text-leaf-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> পরিশোধিত
                </span>
              )}
              <button onClick={() => window.print()} className="btn-ghost btn-sm">
                <Printer className="h-3.5 w-3.5" /> ইনভয়েস প্রিন্ট
              </button>
              <Link
                href={adminHref(`orders/${selected.order_no}/label`)}
                className="btn-primary btn-sm"
                target="_blank"
              >
                <QrCode className="h-3.5 w-3.5" /> শিপিং লেবেল + QR
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
