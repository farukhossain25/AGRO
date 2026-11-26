"use client";

import { useMemo, useState } from "react";
import { Edit3, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";
import type { Subscription } from "@/lib/types";

/* ==========================================================================
   Running monthly food subscriptions
   --------------------------------------------------------------------------
   WHAT THE OWNER ASKED FOR
     "add / edit / remove" — a status dropdown alone cannot fix a wrong phone
     number, a wrong address or a family that grew from ৪ to ৬.

   WHAT IS SAFE TO DELETE
     A subscription is the record of what a family was promised (and the basis
     for the referral credit they were paid). Cancelling is the normal ending
     and keeps the history; a hard delete is only for a row created by mistake,
     so it sits behind a typed confirmation and the API audits the whole row.

   EDITING
     Only the fields that describe the *current arrangement* are editable —
     customer, address, members, monthly price, start date. Plan identity
     (`plan_id`, `package_name`) is not: changing it in place would silently
     turn a ৳২,৪০০ plan into a ৳৪,০০০ one without the customer agreeing. Use
     cancel + new subscription for that.
   ========================================================================== */

const statusLabel: Record<string, string> = { active: "সক্রিয়", paused: "বিরতিতে", cancelled: "বাতিল" };
const statusTone: Record<string, string> = {
  active: "bg-leaf-600/20 text-leaf-700",
  paused: "bg-amber-500/15 text-amber-300",
  cancelled: "bg-red-500/15 text-red-300",
};

type Draft = {
  id: string;
  customer_name: string;
  phone: string;
  division: string;
  district: string;
  upazila: string;
  address: string;
  members: number;
  price_monthly: number;
  start_date: string;
};

function draftOf(r: Subscription): Draft {
  return {
    id: r.id,
    customer_name: r.customer_name ?? "",
    phone: r.phone ?? "",
    division: r.division ?? "",
    district: r.district ?? "",
    upazila: r.upazila ?? "",
    address: r.address ?? "",
    members: Number(r.members ?? 1),
    price_monthly: Number(r.price_monthly ?? 0),
    start_date: (r.start_date ?? "").slice(0, 10),
  };
}

export function SubscriberTable({ initial, dbReady }: { initial: Subscription[]; dbReady: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter ? rows.filter((r) => r.status === filter) : rows),
    [rows, filter]
  );

  const mrr = rows.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.price_monthly), 0);

  async function setStatus(id: string, status: "active" | "paused" | "cancelled") {
    setBusy(id);
    try {
      const res = await fetch("/api/foisal/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "আপডেট ব্যর্থ");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                cancelled_at: status === "cancelled" ? new Date().toISOString() : r.cancelled_at,
              }
            : r
        )
      );
      toast.success(`সাবস্ক্রিপশন ${statusLabel[status]}`);
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    if (draft.customer_name.trim().length < 2) return toast.error("নাম দিন");
    if (!/^0\d{9,10}$/.test(draft.phone.trim())) return toast.error("ফোন নম্বর ০ দিয়ে শুরু, ১০-১১ ডিজিট");

    setSaving(true);
    try {
      const res = await fetch("/api/foisal/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          customer_name: draft.customer_name.trim(),
          phone: draft.phone.trim(),
          division: draft.division.trim(),
          district: draft.district.trim(),
          upazila: draft.upazila.trim(),
          address: draft.address.trim(),
          members: draft.members,
          price_monthly: draft.price_monthly,
          start_date: draft.start_date || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "সেভ ব্যর্থ");
      const saved = json.data?.subscription as Subscription | undefined;
      if (saved) setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setDraft(null);
      toast.success("সাবস্ক্রিপশন আপডেট হয়েছে");
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/foisal/subscriptions?id=${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "মুছে ফেলা যায়নি");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmId(null);
      toast.success("সাবস্ক্রিপশন মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">সাবস্ক্রিপশন</h1>
        <p className="text-[12px] text-sand-100/45">
          {toBn(rows.filter((r) => r.status === "active").length)}টি সক্রিয় · মাসিক আয় {money(mrr, true)}
        </p>
      </div>

      {!dbReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — সাবস্ক্রিপশন লোড হয়নি।
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter("")} className={`chip ${!filter ? "chip-active" : ""}`}>সব ({toBn(rows.length)})</button>
        {(["active", "paused", "cancelled"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip ${filter === s ? "chip-active" : ""}`}>
            {statusLabel[s]} ({toBn(rows.filter((r) => r.status === s).length)})
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">সাব নং</th>
                <th className="px-2 py-2.5 font-medium">কাস্টমার</th>
                <th className="px-2 py-2.5 font-medium">প্যাকেজ</th>
                <th className="px-2 py-2.5 font-medium">সদস্য</th>
                <th className="px-2 py-2.5 font-medium">শুরু</th>
                <th className="px-2 py-2.5 font-medium">স্টেটাস</th>
                <th className="px-2 py-2.5 text-right font-medium">মাসিক</th>
                <th className="px-3 py-2.5 text-right font-medium">কাজ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-mono text-[10.5px] text-leaf-200">{r.sub_no}</td>
                  <td className="px-2 py-2.5">
                    <p className="truncate">{r.customer_name}</p>
                    <p className="text-[9.5px] text-sand-100/30">{r.phone}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="truncate">{r.package_name}</p>
                    <p className="text-[9.5px] text-sand-100/30">{r.district}</p>
                  </td>
                  <td className="px-2 py-2.5">{toBn(r.members)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[11px]">{formatDateBn(r.start_date)}</td>
                  <td className="px-2 py-2.5">
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value as "active" | "paused" | "cancelled")}
                      disabled={busy === r.id}
                      className={`input !w-auto !rounded-lg !border-0 !px-2 !py-1 !text-[10px] ${statusTone[r.status]}`}
                      aria-label={`${r.customer_name} — স্টেটাস`}
                    >
                      {Object.entries(statusLabel).map(([k, v]) => (
                        <option key={k} value={k} className="bg-ink-800 text-sand-100">{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold">{money(Number(r.price_monthly), true)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button
                      onClick={() => setDraft(draftOf(r))}
                      className="rounded p-1.5 hover:bg-white/10"
                      aria-label={`${r.customer_name} — সম্পাদনা`}
                      title="সম্পাদনা"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmId(r.id)}
                      className="rounded p-1.5 text-red-300 hover:bg-red-500/10"
                      aria-label={`${r.customer_name} — মুছুন`}
                      title="মুছুন"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো সাবস্ক্রিপশন নেই</p> : null}
      </div>

      {/* ── edit ─────────────────────────────────────────────────────── */}
      {draft ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="সাবস্ক্রিপশন সম্পাদনা">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-ink-850 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold">সাবস্ক্রিপশন সম্পাদনা</h2>
              <button onClick={() => setDraft(null)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="বন্ধ">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">কাস্টমারের নাম *</span>
                <input value={draft.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="input" />
              </label>
              <label>
                <span className="label">ফোন *</span>
                <input value={draft.phone} onChange={(e) => set("phone", e.target.value)} className="input" inputMode="tel" />
              </label>
              <label>
                <span className="label">সদস্য সংখ্যা</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.members}
                  onChange={(e) => set("members", Math.max(1, Number(e.target.value) || 1))}
                  className="input"
                />
              </label>
              <label>
                <span className="label">বিভাগ</span>
                <input value={draft.division} onChange={(e) => set("division", e.target.value)} className="input" />
              </label>
              <label>
                <span className="label">জেলা</span>
                <input value={draft.district} onChange={(e) => set("district", e.target.value)} className="input" />
              </label>
              <label>
                <span className="label">উপজেলা</span>
                <input value={draft.upazila} onChange={(e) => set("upazila", e.target.value)} className="input" />
              </label>
              <label>
                <span className="label">মাসিক দাম (৳)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.price_monthly}
                  onChange={(e) => set("price_monthly", Math.max(0, Number(e.target.value) || 0))}
                  className="input"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="label">ঠিকানা</span>
                <textarea
                  rows={2}
                  value={draft.address}
                  onChange={(e) => set("address", e.target.value)}
                  className="input resize-none"
                />
              </label>
              <label>
                <span className="label">শুরুর তারিখ</span>
                <input type="date" value={draft.start_date} onChange={(e) => set("start_date", e.target.value)} className="input" />
              </label>
              <p className="self-end text-[10.5px] leading-relaxed text-sand-100/40">
                প্যাকেজ বদলাতে হলে এই সাবস্ক্রিপশনটি বাতিল করে নতুনটি নিন — পুরোনোটির ইতিহাস অক্ষত থাকবে।
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => void save()} disabled={saving} className="btn-primary flex-1">
                {saving ? <Spinner /> : null} সংরক্ষণ
              </button>
              <button onClick={() => setDraft(null)} className="btn-ghost">বাতিল</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── delete confirmation ──────────────────────────────────────── */}
      {confirmId ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="সাবস্ক্রিপশন মুছুন">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/25 bg-ink-850 p-5">
            <h2 className="text-[15px] font-bold text-red-200">স্থায়ীভাবে মুছে ফেলবেন?</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-sand-100/60">
              সাবস্ক্রিপশনটি ডেটাবেস থেকে মুছে যাবে — ফেরানো যাবে না। সাধারণত কাস্টমার বন্ধ করতে চাইলে
              স্টেটাস <span className="font-semibold text-sand-100">“বাতিল”</span> করাই যথেষ্ট; ইতিহাস থেকে যায়।
              শুধু ভুল করে তৈরি হওয়া সাবস্ক্রিপশন মুছুন।
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void remove(confirmId)}
                disabled={busy === confirmId}
                className="flex-1 rounded-xl bg-red-500/90 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-red-500"
              >
                {busy === confirmId ? <Spinner /> : null} হ্যাঁ, মুছে ফেলুন
              </button>
              <button onClick={() => setConfirmId(null)} className="btn-ghost">বাতিল</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
