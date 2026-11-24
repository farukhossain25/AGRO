"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  Eye,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   SellerReviewManager — the admin's view of a seller application
   --------------------------------------------------------------------------
   The seller fills the application form themselves (name, NID, address,
   payout details …). This screen therefore shows those answers read-only and
   lets the admin record only what is actually the admin's decision:

       status  →  pending | approved | rejected | suspended
       reason  →  required when the answer is no
       commission %  →  a commercial term, not part of the application

   Save PATCHes exactly those fields. It never echoes the row back, which is
   what used to break the endpoint (a display-only `contact` key reached
   Supabase and Postgres rejected the whole update).
   ========================================================================== */

type SellerStatus = "pending" | "approved" | "rejected" | "suspended";

export type SellerRow = {
  id: string;
  user_id: string | null;
  slug: string;
  farm_id: string | null;
  name_bn: string;
  phone: string;
  email: string | null;
  nid: string | null;
  farm_address_bn: string | null;
  division: string;
  district: string;
  upazila: string | null;
  product_types: string[];
  payout_method: string;
  payout_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  commission_percent: number;
  status: SellerStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
};

const STATUS: Record<SellerStatus, { label: string; tone: string }> = {
  pending: { label: "যাচাই চলছে", tone: "bg-amber-500/12 text-[#8a6a12]" },
  approved: { label: "অনুমোদিত", tone: "bg-leaf-600/15 text-leaf-700" },
  rejected: { label: "বাতিল", tone: "bg-red-500/12 text-[#c0392b]" },
  suspended: { label: "স্থগিত", tone: "bg-neu-sunken text-neu-muted" },
};

const PAYOUT_LABEL: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  bank: "ব্যাংক",
  sslcommerz: "SSLCommerz",
  cod: "ক্যাশ অন ডেলিভারি",
};

type Filter = "all" | SellerStatus;

export function SellerReviewManager({
  rows: initial,
  dbReady = true,
}: {
  rows: SellerRow[];
  dbReady?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<SellerStatus>("pending");
  const [reason, setReason] = useState("");
  const [commission, setCommission] = useState("10");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = rows.find((r) => r.id === openId) ?? null;

  const counts: Record<Filter, number> = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
  };

  const visible = (filter === "all" ? rows : rows.filter((r) => r.status === filter)).slice().sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );

  function open(row: SellerRow) {
    setOpenId(row.id);
    setStatus(row.status);
    setReason(row.rejection_reason ?? "");
    setCommission(String(row.commission_percent ?? 10));
    setFormError(null);
  }

  function close() {
    if (saving) return;
    setOpenId(null);
    setFormError(null);
  }

  async function save() {
    if (!selected) return;

    if ((status === "rejected" || status === "suspended") && !reason.trim()) {
      setFormError(status === "rejected" ? "বাতিলের কারণ লিখুন" : "স্থগিতের কারণ লিখুন");
      return;
    }
    const commissionNumber = Number(commission);
    if (!Number.isFinite(commissionNumber) || commissionNumber < 0 || commissionNumber > 100) {
      setFormError("কমিশন ০–১০০ এর মধ্যে দিন");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      /* Only the decision is sent — never the seller's own answers. */
      const res = await fetch("/api/foisal/sellers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status,
          rejection_reason: status === "rejected" || status === "suspended" ? reason.trim() : null,
          commission_percent: commissionNumber,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "সংরক্ষণ ব্যর্থ");

      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...json.data } : r)));
      toast.success(
        status === "approved"
          ? `${selected.name_bn} অনুমোদিত হয়েছে`
          : status === "rejected"
            ? `${selected.name_bn} বাতিল করা হয়েছে`
            : status === "suspended"
              ? `${selected.name_bn} স্থগিত করা হয়েছে`
              : "আবেদন আবার যাচাইয়ের জন্য পাঠানো হয়েছে"
      );
      setOpenId(null);
      router.refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-neu-ink">সেলার আবেদন</h1>
          <p className="text-[12px] text-neu-muted">
            {toBn(rows.length)}টি আবেদন · {toBn(counts.pending)}টি অপেক্ষমাণ · {toBn(counts.approved)}টি অনুমোদিত
          </p>
        </div>
        <p className="flex items-center gap-1.5 rounded-full bg-neu-accent/10 px-3 py-1.5 text-[11.5px] font-medium text-neu-accent-strong">
          <Lock className="h-3.5 w-3.5" />
          সেলারের তথ্য শুধু পড়া যায় — সিদ্ধান্ত নেওয়া ছাড়া কিছু বদলানো যায় না
        </p>
      </div>

      {!dbReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-[#8a6a12]">
          ডেটাবেস সংযুক্ত নেই — শুধুমাত্র পড়া যাচ্ছে। সিদ্ধান্ত সংরক্ষণ করতে ডেটাবেস চালু করুন।
        </p>
      ) : null}

      {/* ── filter chips ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "pending", label: "অপেক্ষমাণ", n: counts.pending },
            { key: "approved", label: "অনুমোদিত", n: counts.approved },
            { key: "rejected", label: "বাতিল", n: counts.rejected },
            { key: "suspended", label: "স্থগিত", n: counts.suspended },
            { key: "all", label: "সব", n: counts.all },
          ] as { key: Filter; label: string; n: number }[]
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`chip ${filter === f.key ? "chip-active" : ""}`}
          >
            {f.label}
            <span className="rounded-full bg-neu-sunken px-1.5 text-[10px] font-bold text-neu-ink">
              {toBn(f.n)}
            </span>
          </button>
        ))}
      </div>

      {/* ── table ─────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-neu-accent/10 text-neu-accent-strong">
            <Store className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-neu-ink">কোনো আবেদন নেই</p>
          <p className="mt-1 text-[12.5px] text-neu-muted">এই স্টেটাসে কোনো সেলার আবেদন নেই।</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-neu-line/60 text-[10.5px] uppercase tracking-wider text-neu-faint">
                  <th className="px-4 py-3 font-semibold">স্টোর</th>
                  <th className="px-4 py-3 font-semibold">যোগাযোগ</th>
                  <th className="px-4 py-3 font-semibold">অবস্থান</th>
                  <th className="px-4 py-3 font-semibold">পণ্য</th>
                  <th className="px-4 py-3 font-semibold">স্টেটাস</th>
                  <th className="px-4 py-3 font-semibold">আবেদন</th>
                  <th className="px-4 py-3 text-right font-semibold">কাজ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-neu-line/40 last:border-0 hover:bg-neu-bg/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neu-ink">{r.name_bn}</p>
                      <p className="font-mono text-[10.5px] text-neu-faint">/market/{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neu-ink">{r.phone}</p>
                      {r.email ? <p className="truncate text-[11px] text-neu-muted">{r.email}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-neu-muted">
                      {r.district}
                      {r.upazila ? <span className="text-neu-faint"> · {r.upazila}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {r.product_types.slice(0, 3).map((p) => (
                          <span key={p} className="badge !bg-neu-sunken/70 !text-neu-muted">{p}</span>
                        ))}
                        {r.product_types.length > 3 ? (
                          <span className="badge !bg-neu-sunken/70 !text-neu-muted">+{toBn(r.product_types.length - 3)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-neu-muted">
                      {formatDateBn(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => open(r)}
                        className="btn-ghost btn-sm !border-neu-accent/25 !text-neu-accent-strong"
                      >
                        <Eye className="h-3.5 w-3.5" /> রিভিউ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── review modal ──────────────────────────────────────────────── */}
      {selected ? (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name_bn} আবেদন রিভিউ`}
        >
          <div className="card my-6 w-full max-w-3xl overflow-hidden">
            {/* modal header */}
            <div className="flex items-start justify-between gap-3 border-b border-neu-line/60 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-bold text-neu-ink">{selected.name_bn}</h2>
                  <span className={`badge ${STATUS[selected.status].tone}`}>{STATUS[selected.status].label}</span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-neu-muted">
                  <span className="font-mono">/market/{selected.slug}</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDateBn(selected.created_at)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="বন্ধ করুন"
                className="neu-icon-btn shrink-0"
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1.15fr_1fr]">
              {/* ── what the seller submitted (read-only) ── */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-neu-faint">
                  <FileText className="h-3.5 w-3.5" />
                  সেলারের দেওয়া তথ্য
                </p>
                <dl className="neu-inset-sm divide-y divide-neu-line/50 rounded-2xl text-[12.5px]">
                  <Detail icon={<Store className="h-3.5 w-3.5" />} label="স্টোরের নাম" value={selected.name_bn} />
                  <Detail icon={<Phone className="h-3.5 w-3.5" />} label="মোবাইল" value={selected.phone} mono />
                  <Detail icon={<Mail className="h-3.5 w-3.5" />} label="ইমেইল" value={selected.email ?? "—"} />
                  <Detail icon={<FileText className="h-3.5 w-3.5" />} label="NID" value={selected.nid ?? "—"} mono />
                  <Detail
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label="বিভাগ / জেলা / উপজেলা"
                    value={`${selected.division} · ${selected.district}${selected.upazila ? ` · ${selected.upazila}` : ""}`}
                  />
                  <Detail icon={<Building2 className="h-3.5 w-3.5" />} label="খামারের ঠিকানা" value={selected.farm_address_bn ?? "—"} />
                  <Detail
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    label="পেমেন্ট মাধ্যম"
                    value={
                      selected.payout_method === "bank" && selected.bank_name
                        ? `${PAYOUT_LABEL.bank} · ${selected.bank_name}`
                        : PAYOUT_LABEL[selected.payout_method] ?? selected.payout_method
                    }
                  />
                  <Detail
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    label="পেমেন্ট নম্বর"
                    value={selected.payout_number ?? selected.bank_account ?? "—"}
                    mono
                  />
                  {selected.approved_at ? (
                    <Detail
                      icon={<BadgeCheck className="h-3.5 w-3.5" />}
                      label="অনুমোদনের তারিখ"
                      value={formatDateBn(selected.approved_at)}
                    />
                  ) : null}
                  {selected.rejection_reason ? (
                    <Detail
                      icon={<X className="h-3.5 w-3.5" />}
                      label="আগের সিদ্ধান্তের কারণ"
                      value={selected.rejection_reason}
                    />
                  ) : null}
                </dl>

                <p className="mt-2.5 flex flex-wrap gap-1">
                  {selected.product_types.map((p) => (
                    <span key={p} className="badge !bg-neu-accent/10 !text-neu-accent-strong">{p}</span>
                  ))}
                </p>

                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-neu-faint">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  এই তথ্য সেলার নিজেই ফর্মে দিয়েছেন — এখান থেকে বদলানো যায় না। ভুল থাকলে সেলারকে নতুন করে
                  আবেদন করতে বলুন।
                </p>
              </div>

              {/* ── the decision ── */}
              <div className="flex flex-col">
                <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-neu-faint">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  অ্যাডমিনের সিদ্ধান্ত
                </p>

                <div className="space-y-3.5">
                  <label>
                    <span className="label">স্টেটাস *</span>
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value as SellerStatus);
                        setFormError(null);
                      }}
                      className="input"
                    >
                      <option value="pending">যাচাই চলছে (pending)</option>
                      <option value="approved">অনুমোদন (approved)</option>
                      <option value="rejected">বাতিল (rejected)</option>
                      <option value="suspended">স্থগিত (suspended)</option>
                    </select>
                  </label>

                  {status === "rejected" || status === "suspended" ? (
                    <label>
                      <span className="label">
                        {status === "rejected" ? "বাতিলের কারণ *" : "স্থগিতের কারণ *"}
                      </span>
                      <textarea
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setFormError(null);
                        }}
                        className="input min-h-[84px] resize-y"
                        placeholder="সেলার এই কারণটি দেখতে পাবেন — যেমন: NID যাচাই হয়নি"
                      />
                    </label>
                  ) : null}

                  <label>
                    <span className="label">কমিশন (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      className="input"
                    />
                    <span className="mt-1 block text-[11px] text-neu-faint">
                      প্রতি বিক্রিতে সেলারের কমিশন — অ্যাডমিনের সিদ্ধান্ত, আবেদনের অংশ নয়।
                    </span>
                  </label>
                </div>

                {formError ? (
                  <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-[12px] font-medium text-[#c0392b]">
                    {formError}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-col gap-2 pt-4">
                  <button type="button" onClick={save} disabled={saving || !dbReady} className="btn-primary w-full">
                    {saving ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        সংরক্ষণ হচ্ছে…
                      </>
                    ) : (
                      <>
                        <BadgeCheck className="h-4 w-4" />
                        {status === "approved"
                          ? "অনুমোদন সংরক্ষণ করুন"
                          : status === "rejected"
                            ? "বাতিল সংরক্ষণ করুন"
                            : status === "suspended"
                              ? "স্থগিত সংরক্ষণ করুন"
                              : "সংরক্ষণ করুন"}
                      </>
                    )}
                  </button>
                  <button type="button" onClick={close} disabled={saving} className="btn-ghost btn-sm">
                    বাতিল
                  </button>
                  {selected.status === "approved" ? (
                    <Link
                      href={`/market/${selected.slug}`}
                      target="_blank"
                      className="flex items-center justify-center gap-1 text-[11.5px] font-medium text-neu-accent-strong hover:underline"
                    >
                      স্টোরটি দেখুন <ChevronRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5">
      <span className="mt-0.5 text-neu-accent">{icon}</span>
      <dt className="w-[38%] shrink-0 text-[11px] text-neu-faint">{label}</dt>
      <dd className={`min-w-0 flex-1 text-neu-ink ${mono ? "font-mono text-[11.5px]" : "text-[12.5px]"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}
