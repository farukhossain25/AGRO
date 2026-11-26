"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Wallet } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   রেফারেল কমিশন + ওয়ালেটের সীমা
   --------------------------------------------------------------------------
   WHY A LIVE PREVIEW OF THE MONEY
     "৩০%" tells nobody anything. Every control below prints what it means on
     a real ৳১,০০০ order, and the two numbers are shown together because they
     interact: the commission feeds the wallet, and `wallet_max_percent` is the
     ceiling on how much of the NEXT order that wallet may pay. An owner who
     sets 100% has effectively made every order free for a referrer, and the
     warning says so before it is saved.

   WHERE THESE VALUES ARE USED (no deploy needed)
     • commission_percent / commission_base / credit_on / min_order
         → credit_referral() in SQL 25, read at the moment an order is
           delivered (or paid, depending on credit_on)
     • wallet_max_percent
         → place_order() caps `wallet_used` at this % of the order total,
           and /api/wallet sends the same number to checkout so the slider
           and the transaction can never disagree
   ========================================================================== */

export type ReferralDraft = {
  enabled: boolean;
  commission_percent: number;
  commission_base: "subtotal" | "paid";
  credit_on: "delivered" | "paid";
  min_order: number;
  wallet_max_percent: number;
};

const SAMPLE_ORDER = 1000;

export function WalletSettingsForm({
  initial,
  holders,
  totalCredit,
}: {
  initial: ReferralDraft;
  holders: number;
  totalCredit: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ReferralDraft>(initial);
  const [saving, setSaving] = useState(false);

  /* The server is the truth after every save. `initial` arrives as a fresh
     object on each RSC refresh, so compare by VALUE (not by reference, and not
     by JSON.stringify, which would depend on the key order the server chose). */
  const serverKey = JSON.stringify(initial);
  const [seenKey, setSeenKey] = useState(serverKey);
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setForm(initial);
  }

  const same = (a: ReferralDraft, b: ReferralDraft) =>
    (Object.keys(a) as (keyof ReferralDraft)[]).every((k) => a[k] === b[k]);
  const dirty = !same(form, initial);

  const set = <K extends keyof ReferralDraft>(key: K, value: ReferralDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* What the two percentages mean in taka on a ৳১,০০০ order. */
  const commissionOnSample =
    Math.round(((SAMPLE_ORDER * form.commission_percent) / 100) * 100) / 100;
  const walletOnSample = Math.round(((SAMPLE_ORDER * form.wallet_max_percent) / 100) * 100) / 100;
  const cashOnSample = Math.max(0, SAMPLE_ORDER - walletOnSample);

  const walletTooHigh = form.wallet_max_percent > 50;

  async function save() {
    if (!Number.isFinite(form.commission_percent) || form.commission_percent < 0) {
      toast.error("কমিশন শতাংশ ঠিক নয়");
      return;
    }
    if (!Number.isFinite(form.wallet_max_percent) || form.wallet_max_percent < 0) {
      toast.error("ওয়ালেটের শতাংশ ঠিক নয়");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/foisal/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "referral", value: form }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? json?.error ?? "সেভ হয়নি");
      toast.success("সেভ হয়েছে", "পরের অর্ডার থেকেই নতুন হিসাব কার্যকর");
      router.refresh();
    } catch (err) {
      toast.error("সেভ হয়নি", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-bold">ওয়ালেটের সীমা ও কমিশন</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/50">
          কেউ আপনার লিংক দিয়ে খুললে তার প্রতিটি অর্ডার থেকে কত % কমিশন জমবে, আর সেই জমা টাকা
          থেকে একটি অর্ডারের সর্বোচ্চ কত % শোধ করা যাবে — দুটোই এখান থেকে। সেভ করলেই কার্যকর,
          ডিপ্লয় লাগে না।
        </p>
      </header>

      {/* live money picture */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-sand-100/40">
            কমিশন (৳১,০০০ অর্ডারে)
          </p>
          <p className="mt-1 text-lg font-bold text-leaf-300">{money(commissionOnSample, true)}</p>
          <p className="mt-0.5 text-[10.5px] text-sand-100/40">
            {form.commission_base === "subtotal" ? "পণ্যের দামের ওপর" : "গ্রাহক যে টাকা দিলেন তার ওপর"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-sand-100/40">
            ওয়ালেট দিয়ে সর্বোচ্চ (৳১,০০০-এ)
          </p>
          <p className="mt-1 text-lg font-bold text-leaf-300">{money(walletOnSample, true)}</p>
          <p className="mt-0.5 text-[10.5px] text-sand-100/40">
            বাকি {money(cashOnSample, true)} গ্রাহক দেবেন
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-sand-100/40">
            এখন ওয়ালেটে জমা আছে
          </p>
          <p className="mt-1 text-lg font-bold text-sand-100/80">{money(totalCredit, true)}</p>
          <p className="mt-0.5 text-[10.5px] text-sand-100/40">{toBn(holders)} জনের ব্যালেন্স</p>
        </div>
      </div>

      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[13.5px] font-bold">
          <Wallet className="h-4 w-4 text-leaf-300" /> কমিশন ও ওয়ালেট
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:col-span-2">
            <span>
              <span className="block text-[12.5px] font-semibold">রেফারেল চালু</span>
              <span className="mt-0.5 block text-[10.5px] leading-relaxed text-sand-100/40">
                বন্ধ করলে নতুন কেউ রেফার কোড নিতে পারবে না; আগের ব্যালেন্স ব্যবহারযোগ্য থাকবে।
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-leaf-500"
            />
          </label>

          <label>
            <span className="label">প্রতিটি অর্ডারে কমিশন (%)</span>
            <input
              type="number"
              min={0}
              max={50}
              step="0.5"
              value={form.commission_percent}
              onChange={(e) => set("commission_percent", Number(e.target.value))}
              className="input"
            />
            <span className="mt-1 block text-[10.5px] text-sand-100/40">
              ইনভাইট করা গ্রাহকের প্রতিটি অর্ডারেই — শুধু প্রথমটায় নয়।
            </span>
          </label>

          <label>
            <span className="label">একটি অর্ডারে ওয়ালেট সর্বোচ্চ (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="5"
              value={form.wallet_max_percent}
              onChange={(e) => set("wallet_max_percent", Number(e.target.value))}
              className="input"
            />
            <span className="mt-1 block text-[10.5px] text-sand-100/40">
              গ্রাহক এই শতাংশের বেশি ওয়ালেট থেকে দিতে পারবেন না।
            </span>
          </label>

          <label>
            <span className="label">কমিশন কীসের ওপর</span>
            <select
              value={form.commission_base}
              onChange={(e) => set("commission_base", e.target.value as ReferralDraft["commission_base"])}
              className="input"
            >
              <option value="subtotal" className="bg-ink-800">পণ্যের দামের ওপর (ডেলিভারি বাদ)</option>
              <option value="paid" className="bg-ink-800">গ্রাহক যে টাকা দিলেন তার ওপর</option>
            </select>
          </label>

          <label>
            <span className="label">বোনাস কখন জমা হবে</span>
            <select
              value={form.credit_on}
              onChange={(e) => set("credit_on", e.target.value as ReferralDraft["credit_on"])}
              className="input"
            >
              <option value="delivered" className="bg-ink-800">ডেলিভারি সম্পন্ন হলে</option>
              <option value="paid" className="bg-ink-800">পেমেন্ট নিশ্চিত হলে</option>
            </select>
          </label>

          <label>
            <span className="label">কমিশনের জন্য ন্যূনতম অর্ডার (৳)</span>
            <input
              type="number"
              min={0}
              value={form.min_order}
              onChange={(e) => set("min_order", Number(e.target.value))}
              className="input"
            />
            <span className="mt-1 block text-[10.5px] text-sand-100/40">
              এই টাকার কম অর্ডারে কমিশন জমা হবে না। ০ দিলে সব অর্ডারেই।
            </span>
          </label>
        </div>

        {walletTooHigh ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-100/85">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {toBn(form.wallet_max_percent)}% বেশি মনে হচ্ছে — ৳১,০০০ অর্ডারে গ্রাহক ওয়ালেট থেকে{" "}
              {money(walletOnSample, true)} দিতে পারবেন। সাধারণত ২০–৩০% রাখাই নিরাপদ, নাহলে
              রেফারার প্রায় বিনা পয়সায় অর্ডার পেতে পারেন।
            </span>
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={() => setForm(initial)} disabled={!dirty || saving} className="btn-ghost disabled:opacity-40">
            রিসেট
          </button>
          <button onClick={() => void save()} disabled={!dirty || saving} className="btn-primary disabled:opacity-50">
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            সেভ করুন
          </button>
        </div>
      </section>

      <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-sand-100/45">
        এই পাতার প্রতিটি পরিবর্তন <b>সাথে সাথে</b> কার্যকর হয় — চেকআউটের ওয়ালেট সীমা পরের পেজ
        লোডেই নতুন সংখ্যা দেখাবে, আর পরের ডেলিভারিতে কমিশন নতুন হিসাবে জমবে। প্রতিটি সেভ{" "}
        <b>অডিট লগে</b> ওঠে।
      </p>
    </div>
  );
}
