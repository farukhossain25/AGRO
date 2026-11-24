"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CheckCircle2, Download, Printer, QrCode, Search, X, XCircle } from "lucide-react";
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

const PAYMENT_LABEL: Record<string, { label: string; tone: string }> = {
  paid: { label: "পরিশোধিত", tone: "bg-leaf-600/20 text-leaf-700" },
  pending: { label: "বাকি", tone: "bg-amber-500/15 text-amber-300" },
  failed: { label: "বাতিল", tone: "bg-red-500/15 text-red-300" },
  refunded: { label: "রিফান্ডড", tone: "bg-sky-500/15 text-sky-300" },
};
const paymentBadge = (status: string) => PAYMENT_LABEL[status] ?? PAYMENT_LABEL.pending;

export function OrderManager({ initial, dbReady }: { initial: Order[]; dbReady: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [orders, setOrders] = useState(initial);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* Why an order is being cancelled: "cancel" (admin decision) or
     "reject_payment" (the reported TrxID did not check out). */
  const [cancelling, setCancelling] = useState<{ order: Order; mode: "cancel" | "reject_payment" } | null>(null);
  const [reason, setReason] = useState("");

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

  function requestStatus(order: Order, status: string) {
    // Cancelling is never a one-click action: the reason is what the customer
    // and every seller in the order will read.
    if (status === "cancelled") {
      setReason("");
      setCancelling({ order, mode: "cancel" });
      return;
    }
    void updateStatus(order, status);
  }

  async function updateStatus(order: Order, status: string, cancel_reason?: string) {
    setBusy(order.id);
    try {
      const res = await fetch("/api/foisal/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status, ...(cancel_reason ? { cancel_reason } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "আপডেট ব্যর্থ");
      applyPatch(order.id, { status: status as Order["status"], ...(json.data?.cancel_reason ? { cancel_reason: json.data.cancel_reason } : {}) });
      toast.success(status === "cancelled" ? "অর্ডার বাতিল — সেলার হিসাব ও স্টক ঠিক করা হয়েছে" : "স্টেটাস আপডেট হয়েছে", order.order_no);
      router.refresh();
    } catch (err) {
      toast.error("আপডেট ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /* Reject a reported payment: marks it failed, cancels the order, voids the
     sellers' sub-orders, restores stock and tells both sides. */
  async function confirmCancel() {
    if (!cancelling) return;
    const { order, mode } = cancelling;
    setBusy(order.id);
    try {
      const res = await fetch("/api/foisal/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "reject_payment"
            ? { id: order.id, action: "reject_payment", cancel_reason: reason.trim() || undefined }
            : { id: order.id, status: "cancelled", cancel_reason: reason.trim() || undefined }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "ব্যর্থ");
      applyPatch(order.id, {
        status: "cancelled",
        ...(mode === "reject_payment" ? { payment_status: "failed" as const } : {}),
        ...(json.data?.cancel_reason ? { cancel_reason: json.data.cancel_reason } : {}),
      });
      toast.success(
        mode === "reject_payment" ? "পেমেন্ট বাতিল ও অর্ডার বাতিল — সেলার হিসাব ও স্টক ঠিক করা হয়েছে" : "অর্ডার বাতিল — সেলার হিসাব ও স্টক ঠিক করা হয়েছে",
        order.order_no
      );
      setCancelling(null);
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function applyPatch(id: string, patch: Partial<Order>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  async function markPaid(order: Order) {
    setBusy(order.id);
    try {
      const res = await fetch("/api/foisal/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, payment_status: "paid" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? "আপডেট ব্যর্থ");
      applyPatch(order.id, { payment_status: "paid" });
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
          {/* min-width makes the wrapper actually scroll instead of crushing
              the order number into one character per line on a phone */}
          <table className="w-full min-w-[760px] text-left text-[12px]">
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
                    <span className={`badge !text-[9px] ${paymentBadge(o.payment_status).tone}`}>
                      {paymentBadge(o.payment_status).label}
                    </span>
                    {o.payment_ref ? (
                      <p className="mt-0.5 max-w-[140px] truncate font-mono text-[9px] text-sand-100/40" title={o.payment_ref}>
                        {o.payment_ref.split(" | ")[0]}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[9px] uppercase text-sand-100/30">{o.payment_method}</p>
                    )}
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={o.status}
                      onChange={(e) => requestStatus(o, e.target.value)}
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

      {/* cancel / reject-payment dialog */}
      {cancelling ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink-950/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmCancel();
            }}
            className="card w-full max-w-md p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-neu-ink">
                  {cancelling.mode === "reject_payment" ? "পেমেন্ট বাতিল ও অর্ডার বাতিল" : "অর্ডার বাতিল"}
                </h2>
                <p className="mt-0.5 font-mono text-[11px] text-neu-muted">{cancelling.order.order_no}</p>
              </div>
              <button type="button" onClick={() => setCancelling(null)} className="neu-icon-btn" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            {cancelling.mode === "reject_payment" && cancelling.order.payment_ref ? (
              <p className="mt-3 rounded-lg bg-neu-inset/60 px-3 py-2 text-[11.5px] text-neu-muted">
                রিপোর্ট করা TrxID: <span className="font-mono text-neu-ink">{cancelling.order.payment_ref}</span>
              </p>
            ) : null}

            <label className="mt-3 block">
              <span className="label">কারণ (গ্রাহক ও সংশ্লিষ্ট সেলার দেখবেন)</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input resize-none"
                placeholder={cancelling.mode === "reject_payment" ? "যেমন: bKash-এ এই TrxID পাওয়া যায়নি" : "যেমন: পণ্য স্টকে নেই"}
                maxLength={300}
              />
            </label>

            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              এতে সেলারদের সাব-অর্ডার বাতিল হবে (বিক্রয় থেকে বাদ), স্টক ফিরে আসবে, কুপনের ব্যবহার ফেরত যাবে এবং
              গ্রাহক ও সেলার নোটিফিকেশন পাবেন।
            </div>

            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={busy === cancelling.order.id} className="btn-danger flex-1">
                {busy === cancelling.order.id ? "হচ্ছে…" : cancelling.mode === "reject_payment" ? "পেমেন্ট বাতিল + অর্ডার বাতিল" : "অর্ডার বাতিল করুন"}
              </button>
              <button type="button" onClick={() => setCancelling(null)} className="btn-ghost">
                ফিরে যান
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
                <span className={`badge !text-[9px] ${paymentBadge(selected.payment_status).tone}`}>
                  {paymentBadge(selected.payment_status).label}
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

            {selected.status === "cancelled" ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-[12px] text-red-200">
                <Ban className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">অর্ডার বাতিল</p>
                  <p className="mt-0.5 text-red-200/80">{selected.cancel_reason ?? "কারণ লেখা হয়নি"}</p>
                  <p className="mt-1 text-[10.5px] text-red-200/60">সেলারদের সাব-অর্ডার বাতিল, স্টক ফেরত ও নোটিফিকেশন পাঠানো হয়েছে।</p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              {selected.payment_status !== "paid" && selected.status !== "cancelled" ? (
                <button
                  onClick={() => markPaid(selected)}
                  disabled={busy === selected.id}
                  className="btn-primary btn-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> ভেরিফাই করুন (পরিশোধিত)
                </button>
              ) : null}
              {selected.payment_status === "paid" ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-leaf-600/15 px-3 py-1.5 text-[11px] font-semibold text-leaf-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> পরিশোধিত
                </span>
              ) : null}
              {selected.payment_status === "failed" ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-[11px] font-semibold text-red-300">
                  <XCircle className="h-3.5 w-3.5" /> পেমেন্ট বাতিল
                </span>
              ) : null}
              {selected.status !== "cancelled" ? (
                <button
                  onClick={() => {
                    setReason("");
                    setCancelling({ order: selected, mode: "reject_payment" });
                  }}
                  disabled={busy === selected.id}
                  className="btn-ghost btn-sm !border-red-500/30 !text-red-300 hover:!bg-red-500/10"
                >
                  <XCircle className="h-3.5 w-3.5" /> {selected.payment_ref ? "পেমেন্ট বাতিল (ভুল/ফেক TrxID)" : "অর্ডার বাতিল"}
                </button>
              ) : null}
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
