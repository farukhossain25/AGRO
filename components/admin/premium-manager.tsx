"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateTimeBn, money, toBn } from "@/lib/format";

/* ==========================================================================
   PremiumManager — approve / reject premium payments from the panel
   --------------------------------------------------------------------------
   Every premium purchase is a manual payment: the customer sends money to the
   bKash/Nagad number, reports the TrxID on /payment/<method>?sub=PS-…, and the
   row lands here as `pending`. This screen is the only place a plan becomes
   real:

     • অপেক্ষমাণ — the queue the owner asked for. Each card shows the money,
       the method, the reported TrxID + sender number, the customer and the
       plan. "যাচাই করে চালু করুন" activates the plan for the plan's own
       duration; "বাতিল" demands a reason (which the customer reads on their
       account page).

   Approving writes status=active + profile.role=premium; rejecting writes
   status=cancelled + cancel_reason and leaves no access behind. Both are
   audited and both notify the customer. Nothing here talks to a gateway —
   the owner's eyes on the TrxID are the verification step.
   ========================================================================== */

export type AdminPremiumSub = {
  id: string;
  sub_no: string;
  user_id: string;
  plan_name_bn: string;
  tier: string;
  amount: number;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  cancel_reason: string | null;
  reviewed_at?: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-leaf-600/20 text-leaf-700",
  grace: "bg-amber-500/15 text-amber-300",
  pending: "bg-sky-500/15 text-sky-300",
  expired: "bg-white/[0.07] text-sand-100/45",
  cancelled: "bg-red-500/15 text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  active: "সক্রিয়",
  grace: "গ্রেস পিরিয়ড",
  expired: "মেয়াদ শেষ",
  cancelled: "বাতিল",
};

/** What the customer reported: "TRX123 | 01712345678". */
function splitRef(ref: string | null): { trx: string; sender: string | null } {
  if (!ref) return { trx: "", sender: null };
  const [trx, ...rest] = ref.split(" | ");
  const sender = rest.join(" | ").trim();
  return { trx: trx.trim(), sender: sender || null };
}

const METHOD_LABEL: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  upay: "উপায়",
  bank: "ব্যাংক",
  sslcommerz: "কার্ড / SSLCommerz",
  cod: "ক্যাশ অন ডেলিভারি",
};

export function PremiumManager({ initial }: { initial: AdminPremiumSub[] }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();

  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"pending" | "active" | "cancelled" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  /* reject dialog state — the reason is mandatory, so it gets its own form */
  const [rejecting, setRejecting] = useState<AdminPremiumSub | null>(null);
  const [reason, setReason] = useState("");
  /* approve dialog: the owner can paste the TrxID they verified in the SMS */
  const [approving, setApproving] = useState<AdminPremiumSub | null>(null);
  const [reference, setReference] = useState("");

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "pending").length,
      active: rows.filter((r) => r.status === "active" || r.status === "grace").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "pending") list = list.filter((r) => r.status === "pending");
    else if (filter === "active") list = list.filter((r) => r.status === "active" || r.status === "grace");
    else if (filter === "cancelled") list = list.filter((r) => r.status === "cancelled");

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.sub_no, r.customer_name, r.customer_phone, r.payment_ref, r.plan_name_bn, r.payment_method]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    // pending first, then newest
    return [...list].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, filter, query]);

  function patchRow(id: string, patch: Partial<AdminPremiumSub>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function decide(
    sub: AdminPremiumSub,
    payload: { action: "approve"; reference?: string } | { action: "reject"; reason: string }
  ) {
    setBusy(sub.id);
    try {
      const res = await fetch("/api/foisal/premium-subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message ?? "ব্যর্থ হয়েছে");

      const saved = json?.data?.subscription ?? null;
      patchRow(sub.id, {
        status: payload.action === "approve" ? "active" : "cancelled",
        ...(saved?.expires_at ? { expires_at: saved.expires_at } : {}),
        ...(saved?.started_at ? { started_at: saved.started_at } : {}),
        ...(payload.action === "reject" ? { cancel_reason: payload.reason } : {}),
        ...(saved?.payment_ref ? { payment_ref: saved.payment_ref } : {}),
      });

      if (payload.action === "approve") {
        success(
          "প্রিমিয়াম চালু হয়েছে ✅",
          `${sub.sub_no} — গ্রাহক এখনই লাইভ ক্যামেরা দেখতে পারবেন`
        );
        setApproving(null);
      } else {
        success("পেমেন্ট বাতিল — গ্রাহক কারণসহ নোটিফিকেশন পাবেন", sub.sub_no);
        setRejecting(null);
      }
      setReason("");
      setReference("");
      router.refresh();
    } catch (err) {
      errorToast("কাজটি সম্পন্ন হয়নি", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      success("কপি হয়েছে", text);
    } catch {
      errorToast("কপি করা যায়নি", "হাতে লিখে নিন");
    }
  }

  return (
    <div className="space-y-4">
      {/* queue summary + filter */}
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            { key: "pending", label: "যাচাইয়ের অপেক্ষায়", value: counts.pending, tone: "text-sky-300" },
            { key: "active", label: "সক্রিয়", value: counts.active, tone: "text-leaf-200" },
            { key: "cancelled", label: "বাতিল", value: counts.cancelled, tone: "text-red-300" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`card p-3 text-left transition ${
              filter === t.key ? "ring-2 ring-neu-accent/40" : "hover:ring-1 hover:ring-neu-accent/20"
            }`}
          >
            <p className="text-[10.5px] uppercase tracking-wide text-sand-100/40">{t.label}</p>
            <p className={`mt-0.5 text-xl font-bold ${t.tone}`}>{toBn(t.value)}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="সাব নং, নাম, মোবাইল বা TrxID"
            className="input !pl-9"
            aria-label="খুঁজুন"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="input w-auto"
          aria-label="ফিল্টার"
        >
          <option value="pending">শুধু অপেক্ষমাণ</option>
          <option value="active">সক্রিয়</option>
          <option value="cancelled">বাতিল</option>
          <option value="all">সব</option>
        </select>
      </div>

      {/* pending hint */}
      {counts.pending > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#1b5878]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {toBn(counts.pending)}টি পেমেন্ট যাচাইয়ের অপেক্ষায়। বিকাশ/নগদ অ্যাপে TrxID ও টাকার পরিমাণ মিলিয়ে
            তারপর <b>চালু করুন</b> চাপুন — চালু করলেই গ্রাহকের অ্যাক্সেস সক্রিয় হবে; বাতিল করলে কারণ লিখে দিন,
            গ্রাহক সেটি নিজের অ্যাকাউন্টে দেখবেন।
          </span>
        </p>
      ) : null}

      {/* list */}
      {filtered.length === 0 ? (
        <div className="card px-4 py-10 text-center">
          <p className="text-2xl">🧾</p>
          <p className="mt-2 text-[13px] font-semibold text-neu-ink">
            {filter === "pending" ? "এখন কোনো পেমেন্ট যাচাইয়ের অপেক্ষায় নেই" : "এই তালিকায় কিছু নেই"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-sand-100/45">
            গ্রাহক প্ল্যান কিনলে, নির্দেশনা অনুযায়ী টাকা পাঠিয়ে TrxID জমা দিলে সেটি এখানে হাজির হবে।
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((s) => {
            const { trx, sender } = splitRef(s.payment_ref);
            const pending = s.status === "pending";
            return (
              <li key={s.id} className={`card overflow-hidden ${pending ? "border-sky-500/30" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neu-line/50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-mono text-[12px] font-semibold text-neu-ink">
                      {s.sub_no}
                      <button
                        type="button"
                        onClick={() => copy(s.sub_no)}
                        className="text-sand-100/35 transition hover:text-neu-ink"
                        aria-label="সাব নং কপি"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-sand-100/55">
                      {s.customer_name ?? "—"}
                      {s.customer_phone ? ` · ${s.customer_phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[s.status] ?? ""}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <span className="text-[15px] font-bold text-mint">{money(Number(s.amount), true)}</span>
                  </div>
                </div>

                <div className="grid gap-2 px-4 py-3 text-[11.5px] sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sand-100/60">
                    <Receipt className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{s.plan_name_bn}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sand-100/60">
                    <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>{METHOD_LABEL[s.payment_method ?? ""] ?? s.payment_method ?? "—"}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sand-100/60">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                    {trx ? (
                      <span className="min-w-0">
                        TrxID:{" "}
                        <button
                          type="button"
                          onClick={() => copy(trx)}
                          className="break-all font-mono font-semibold text-leaf-200 hover:underline"
                          title="কপি করুন"
                        >
                          {trx}
                        </button>
                        {sender ? (
                          <span className="mt-0.5 block text-[10.5px] text-sand-100/45">
                            প্রেরক: <span className="font-mono">{sender}</span>
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-amber-300/90">গ্রাহক এখনো TrxID জমা দেননি</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sand-100/60">
                    <Clock className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>{formatDateTimeBn(s.created_at)}</span>
                  </div>
                  {s.expires_at ? (
                    <div className="flex items-center gap-2 text-sand-100/50 sm:col-span-2">
                      <Smartphone className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span>
                        মেয়াদ {new Date(s.expires_at).toLocaleDateString("bn-BD")} পর্যন্ত
                        {s.reviewed_at ? ` · যাচাই ${formatDateTimeBn(s.reviewed_at)}` : ""}
                      </span>
                    </div>
                  ) : null}
                  {s.cancel_reason ? (
                    <p className="rounded-lg bg-red-500/8 px-2.5 py-1.5 text-[11px] leading-relaxed text-red-200 sm:col-span-2">
                      বাতিলের কারণ: {s.cancel_reason}
                    </p>
                  ) : null}
                </div>

                {pending ? (
                  <div className="flex flex-wrap gap-2 border-t border-neu-line/50 px-4 py-3">
                    <button
                      type="button"
                      disabled={busy === s.id}
                      onClick={() => {
                        setReference(trx);
                        setApproving(s);
                      }}
                      className="btn-primary btn-sm flex-1 whitespace-nowrap !px-2.5 text-[12px]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> যাচাই করে চালু করুন
                    </button>
                    <button
                      type="button"
                      disabled={busy === s.id}
                      onClick={() => {
                        setReason("");
                        setRejecting(s);
                      }}
                      className="btn-ghost btn-sm flex-1 whitespace-nowrap !border-red-500/35 !px-2.5 text-[12px] !text-red-300 hover:!bg-red-500/10"
                    >
                      <XCircle className="h-3.5 w-3.5" /> বাতিল করুন
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {counts.pending === 0 && filtered.length > 0 ? (
        <p className="text-center text-[11px] text-sand-100/35">
          <ChevronDown className="mx-auto mb-1 h-3.5 w-3.5" />
          সক্রিয় ও বাতিল হওয়া পেমেন্টের ইতিহাস উপরে ফিল্টার করে দেখুন
        </p>
      ) : null}

      {/* ── approve dialog ─────────────────────────────────────────── */}
      {approving ? (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-black/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <form
            className="w-full max-w-md rounded-t-xl border border-white/80 bg-neu-surface p-4 shadow-neu animate-pop sm:rounded-xl"
            onSubmit={(e) => {
              e.preventDefault();
              void decide(approving, {
                action: "approve",
                ...(reference.trim() ? { reference: reference.trim() } : {}),
              });
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-neu-ink">পেমেন্ট যাচাই করে প্ল্যান চালু</h2>
                <p className="mt-0.5 font-mono text-[11px] text-sand-100/50">{approving.sub_no}</p>
              </div>
              <button type="button" onClick={() => setApproving(null)} className="neu-icon-btn" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl bg-neu-inset-sm px-3.5 py-3 text-[11.5px] text-sand-100/60">
              <p className="flex justify-between gap-3">
                <span>গ্রাহক</span>
                <span className="text-right text-neu-ink">
                  {approving.customer_name ?? "—"}
                  {approving.customer_phone ? ` · ${approving.customer_phone}` : ""}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span>প্ল্যান</span>
                <span className="text-right text-neu-ink">{approving.plan_name_bn}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span>পরিমাণ</span>
                <span className="text-right font-semibold text-leaf-200">{money(Number(approving.amount), true)}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span>মাধ্যম</span>
                <span className="text-right text-neu-ink">
                  {METHOD_LABEL[approving.payment_method ?? ""] ?? approving.payment_method ?? "—"}
                </span>
              </p>
            </div>

            <label className="mt-3 block">
              <span className="label">
                TrxID <span className="font-normal opacity-70">(বিকাশ/নগদের মেসেজ থেকে — খালি রাখলে গ্রাহকের দেওয়াটাই থাকবে)</span>
              </span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="input font-mono"
                placeholder="যেমন: 8N7A2K4L9M"
                maxLength={160}
              />
            </label>

            <div className="mt-3 rounded-lg border border-leaf-600/25 bg-leaf-600/8 px-3 py-2 text-[11px] leading-relaxed text-leaf-700">
              চালু করলে গ্রাহকের অ্যাকাউন্টে প্ল্যানের পুরো মেয়াদ যোগ হবে এবং সাথে সাথেই লাইভ ক্যামেরার অ্যাক্সেস
              খুলে যাবে। গ্রাহক একটি নোটিফিকেশনও পাবেন।
            </div>

            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={busy === approving.id} className="btn-primary flex-1">
                {busy === approving.id ? "চালু হচ্ছে…" : "হ্যাঁ, চালু করুন"}
              </button>
              <button type="button" onClick={() => setApproving(null)} className="btn-ghost">
                ফিরে যান
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* ── reject dialog ──────────────────────────────────────────── */}
      {rejecting ? (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-black/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <form
            className="w-full max-w-md rounded-t-xl border border-white/80 bg-neu-surface p-4 shadow-neu animate-pop sm:rounded-xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 2) return;
              void decide(rejecting, { action: "reject", reason: reason.trim() });
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-neu-ink">পেমেন্ট বাতিল — কারণ লিখুন</h2>
                <p className="mt-0.5 font-mono text-[11px] text-sand-100/50">{rejecting.sub_no}</p>
              </div>
              <button type="button" onClick={() => setRejecting(null)} className="neu-icon-btn" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            {rejecting.payment_ref ? (
              <p className="mt-3 break-all rounded-lg bg-neu-inset-sm px-3 py-2 text-[11.5px] text-sand-100/60">
                গ্রাহকের দেওয়া: <span className="font-mono text-neu-ink">{rejecting.payment_ref}</span>
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-neu-inset-sm px-3 py-2 text-[11.5px] text-sand-100/60">
                গ্রাহক কোনো TrxID জমা দেননি।
              </p>
            )}

            <label className="mt-3 block">
              <span className="label">কারণ (গ্রাহক নিজের অ্যাকাউন্ট পেজে দেখবেন)</span>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input resize-none"
                placeholder="যেমন: বিকাশে এই TrxID-তে ৳৪৯৯ পাওয়া যায়নি — সঠিক TrxID দিন"
                maxLength={300}
              />
            </label>

            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              বাতিল করলে গ্রাহকের প্রিমিয়াম অ্যাক্সেস থাকবে না, প্ল্যানটি চালু হবে না, আর গ্রাহক কাজনসহ
              নোটিফিকেশন পাবেন। পরে সঠিক প্রমাণ পেলে গ্রাহক আবার পেমেন্ট করে নতুন সাবস্ক্রিপশন নিতে পারবেন।
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={busy === rejecting.id || reason.trim().length < 2}
                className="btn-danger flex-1"
              >
                {busy === rejecting.id ? "বাতিল হচ্ছে…" : "পেমেন্ট বাতিল করুন"}
              </button>
              <button type="button" onClick={() => setRejecting(null)} className="btn-ghost">
                ফিরে যান
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
