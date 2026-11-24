"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, ShieldOff, Star } from "lucide-react";
import { useToast } from "@/lib/toast";
import { toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   SupplierQualityBoard — the panel’s quality board
   ========================================================================== */

export type QualityRow = {
  sellerId: string;
  slug: string;
  nameBn: string;
  status: string;
  reviewCount: number;
  avgRating: number;
  avgSellerRating: number;
  complaintCount: number;
  complaintRate: number;
  onTimeRate: number;
  qualityScore: number;
  lowRatingCount: number;
};

type Action = "warn" | "suspend" | "reinstate";

function scoreTone(score: number) {
  if (score >= 80) return "text-leaf-200";
  if (score >= 60) return "text-amber-300";
  return "text-red-300";
}

export function SupplierQualityBoard({
  initial,
  thresholds,
}: {
  initial: QualityRow[];
  thresholds: { warnBelow: number; suspendBelow: number; minReviews: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [sort, setSort] = useState<"score" | "reviews" | "complaints">("score");
  const [dialog, setDialog] = useState<{ row: QualityRow; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "reviews") return copy.sort((a, b) => b.reviewCount - a.reviewCount);
    if (sort === "complaints") return copy.sort((a, b) => b.complaintRate - a.complaintRate);
    return copy.sort((a, b) => a.qualityScore - b.qualityScore);
  }, [rows, sort]);

  async function submit() {
    if (!dialog) return;
    if (reason.trim().length < 5) {
      toast.error("কারণ লিখুন", "অন্তত ৫ অক্ষর");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/foisal/suppliers/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: dialog.row.sellerId,
          action: dialog.action,
          reason: reason.trim(),
        }),
      });

      const json = (await res.json()) as { ok?: boolean; message?: string; status?: string };
      if (!res.ok) throw new Error(json.message ?? "ব্যর্থ হয়েছে");

      setRows((prev) =>
        prev.map((row) =>
          row.sellerId === dialog.row.sellerId ? { ...row, status: json.status ?? row.status } : row
        )
      );

      toast.success(
        dialog.action === "warn"
          ? "সতর্কবার্তা পাঠানো হয়েছে"
          : dialog.action === "suspend"
            ? "সেলার স্থগিত করা হয়েছে"
            : "সেলার পুনরায় চালু হয়েছে"
      );

      setDialog(null);
      setReason("");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-bold text-sand-50">সেলার কোয়ালিটি স্কোর</h1>
          <p className="mt-0.5 text-[12px] text-sand-100/50">
            স্কোর = গড় রেটিং + অভিযোগের হার + সময়মতো ডেলিভারি ·{" "}
            {toBn(thresholds.warnBelow)}-এর নিচে সতর্কবার্তা, {toBn(thresholds.suspendBelow)}-এর নিচে
            স্থগিতাদেশের সুপারিশ
          </p>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="সাজান"
          className="input h-10 w-auto min-w-[150px] py-0 text-[16px] sm:text-[12.5px]"
        >
          <option value="score">স্কোর (কম → বেশি)</option>
          <option value="reviews">রিভিউ সংখ্যা</option>
          <option value="complaints">অভিযোগের হার</option>
        </select>
      </header>

      {sorted.length === 0 ? (
        <p className="card p-6 text-center text-[13px] text-sand-100/45">
          এখনো কোনো সেলারের কোয়ালিটি ডেটা নেই। রিভিউ ও ডেলিভারি শুরু হলে এখানে দেখা যাবে।
        </p>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((row) => {
            const needsAttention =
              row.reviewCount >= thresholds.minReviews && row.qualityScore < thresholds.warnBelow;

            return (
              <li
                key={row.sellerId}
                className={`card p-3.5 ${
                  needsAttention ? "border border-amber-400/25 bg-amber-500/[0.04]" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[14px] font-bold text-sand-50">{row.nameBn}</p>
                      {row.status === "suspended" ? (
                        <span className="badge bg-red-500/15 text-[10px] text-red-300">স্থগিত</span>
                      ) : row.status === "pending" ? (
                        <span className="badge bg-amber-500/15 text-[10px] text-amber-300">
                          অনুমোদনের অপেক্ষায়
                        </span>
                      ) : (
                        <span className="badge bg-leaf-600/15 text-[10px] text-leaf-700">সক্রিয়</span>
                      )}
                      {needsAttention ? (
                        <span className="badge bg-amber-500/20 text-[10px] text-amber-200">
                          <AlertTriangle className="mr-0.5 inline h-3 w-3" /> নজর দিন
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-sand-100/45">
                      {toBn(row.reviewCount)} রিভিউ · {toBn(row.lowRatingCount)}টি নিচু রেটিং ·{" "}
                      {toBn(row.complaintCount)} অভিযোগ
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`text-[22px] font-extrabold leading-none ${scoreTone(row.qualityScore)}`}>
                      {toBn(Math.round(row.qualityScore))}
                    </p>
                    <p className="text-[9.5px] uppercase tracking-wide text-sand-100/30">স্কোর / ১০০</p>
                  </div>
                </div>

                <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/[0.03] py-1.5">
                    <dt className="text-[9.5px] text-sand-100/35">গড় রেটিং</dt>
                    <dd className="mt-0.5 text-[12.5px] font-semibold text-sand-100/85">
                      <Star className="mr-0.5 inline h-3 w-3 fill-amber-400 text-amber-400" />
                      {toBn(row.avgRating.toFixed(1))}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] py-1.5">
                    <dt className="text-[9.5px] text-sand-100/35">অভিযোগের হার</dt>
                    <dd className="mt-0.5 text-[12.5px] font-semibold text-sand-100/85">
                      {toBn(Math.round(row.complaintRate * 100))}%
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] py-1.5">
                    <dt className="text-[9.5px] text-sand-100/35">সময়মতো</dt>
                    <dd className="mt-0.5 text-[12.5px] font-semibold text-leaf-200">
                      {toBn(Math.round(row.onTimeRate * 100))}%
                    </dd>
                  </div>
                </dl>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDialog({ row, action: "warn" })}
                    className="btn-ghost btn-sm min-h-[44px] text-amber-200"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> সতর্ক করুন
                  </button>

                  {row.status === "suspended" ? (
                    <button
                      type="button"
                      onClick={() => setDialog({ row, action: "reinstate" })}
                      className="btn-primary btn-sm min-h-[44px]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> চালু করুন
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDialog({ row, action: "suspend" })}
                      className="btn-ghost btn-sm min-h-[44px] text-red-300"
                    >
                      <ShieldOff className="h-3.5 w-3.5" /> স্থগিত করুন
                    </button>
                  )}

                  <a
                    href={`/market/${row.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm min-h-[44px]"
                  >
                    দোকান দেখুন
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* action dialog */}
      {dialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quality-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl neu-raised-lg border border-white/85 bg-neu-surface p-4">
            <h2 id="quality-dialog-title" className="text-[15px] font-bold text-sand-50">
              {dialog.action === "warn"
                ? "সতর্কবার্তা পাঠান"
                : dialog.action === "suspend"
                  ? "সেলার স্থগিত করুন"
                  : "সেলার পুনরায় চালু করুন"}{" "}
              — {dialog.row.nameBn}
            </h2>
            <p className="mt-1 text-[11.5px] text-sand-100/50">
              কারণটি সেলারের কাছে নোটিফিকেশন ও ইমেইলে যাবে এবং অডিট লগে সংরক্ষিত থাকবে।
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="কারণ লিখুন…"
              className="input mt-2.5 text-[16px] sm:text-[13px]"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="btn-primary btn-sm min-h-[44px]"
              >
                {busy ? <Spinner /> : null} নিশ্চিত করুন
              </button>
              <button
                type="button"
                onClick={() => {
                  setDialog(null);
                  setReason("");
                }}
                className="btn-ghost btn-sm min-h-[44px]"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
