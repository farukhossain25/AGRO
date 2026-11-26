"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Gift, Link2, Share2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money, toBn } from "@/lib/format";
import { walletKindLabel, type WalletRow } from "@/lib/types-wallet";

/* ==========================================================================
   ওয়ালেট ও রেফারেল — গ্রাহকের পাতা
   --------------------------------------------------------------------------
   Three things live here because they are one story:

     1. the balance and what it can pay for (never more than `wallet_max_percent`
        of an order — the number on the card comes from the admin setting),
     2. the referral code to hand out, and
     3. the ledger, so every taka has a visible reason.

   The code box on top is for the invitee's side: someone who arrived without
   the link can still paste the code once.
   ========================================================================== */

type Props = {
  code: string | null;
  /** An influencer's own promo code + its public share token (may be null). */
  promo: { code: string; share_token: string | null; value: number; type: string } | null;
  balance: number;
  earned: number;
  spent: number;
  maxPercent: number;
  invited: number;
  commissionPercent: number;
  minOrder: number;
  enabled: boolean;
  alreadyReferred: boolean;
  ledger: WalletRow[];
};

export function WalletPanel({
  code,
  promo,
  balance,
  earned,
  spent,
  maxPercent,
  invited,
  commissionPercent,
  minOrder,
  enabled,
  alreadyReferred,
  ledger,
}: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [referred, setReferred] = useState(alreadyReferred);

  const link = useMemo(
    () => (code ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${code}` : ""),
    [code]
  );

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success("কপি হয়েছে");
    } catch {
      toast.error("কপি করা গেল না", "কোডটি হাতে লিখে নিন");
    }
  }

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "কোডটি নেওয়া গেল না");
      toast.success("রেফারেল যুক্ত হয়েছে", "বন্ধুর প্রথম অর্ডার ডেলিভারি হলে বোনাস জমা হবে");
      setReferred(true);
      setCodeInput("");
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setClaiming(false);
    }
  }

  /* What the balance can actually cover. Checkout enforces the same ceiling,
     so this number is a promise, not a preview. */
  const example = Math.min(balance, Math.round((1000 * maxPercent) / 100));

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------- balance */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] px-4 py-4">
          <div>
            <p className="text-[11.5px] text-sand-100/45">ব্যালেন্স</p>
            <p className="mt-1 text-[28px] font-bold leading-none">{money(balance, true)}</p>
            <p className="mt-2 text-[11px] text-sand-100/45">
              শুধু পণ্যের অর্ডারে ব্যবহার করা যাবে · এক অর্ডারে সর্বোচ্চ{" "}
              <b className="text-leaf-300">{toBn(maxPercent)}%</b>
              {balance > 0 ? ` (৳${toBn(1000)} অর্ডারে সর্বোচ্চ ${money(example, true)})` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right">
            <div>
              <p className="text-[11px] text-sand-100/40">মোট আয়</p>
              <p className="text-[13px] font-semibold text-leaf-300">{money(earned, true)}</p>
            </div>
            <div>
              <p className="text-[11px] text-sand-100/40">মোট খরচ</p>
              <p className="text-[13px] font-semibold">{money(spent, true)}</p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- referral */}
        {enabled && code ? (
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-leaf-400" />
              <h2 className="text-[13.5px] font-bold">বন্ধুকে রেফার করুন</h2>
            </div>
            <p className="text-[11.5px] leading-relaxed text-sand-100/50">
              আপনার কোড বা লিংক দিয়ে কেউ অ্যাকাউন্ট খুললে (প্রোডাক্ট শেয়ার
              লিংকও কাজ করে) তার <b>প্রতিটি</b> ডেলিভারি হওয়া অর্ডার থেকে{" "}
              <b className="text-leaf-300">{toBn(commissionPercent)}%</b> আপনার ওয়ালেটে জমা হবে
              {minOrder > 0 ? ` — ন্যূনতম অর্ডার ${money(minOrder, true)}` : ""}।
            </p>

            {/* An influencer also has a promo code of their own; the link is
                what they paste anywhere. */}
            {promo ? (
              <div className="rounded-xl border border-leaf-500/25 bg-leaf-500/[0.07] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-leaf-100/85">
                  আপনার প্রোমো কোড:{" "}
                  <span className="font-mono text-[12.5px] tracking-wider text-leaf-300">{promo.code}</span>
                  <span className="ml-1 text-sand-100/50">
                    ({promo.type === "percent" ? `${toBn(promo.value)}%` : money(promo.value, true)} ছাড়)
                  </span>
                </p>
                {promo.share_token ? (
                  <p className="mt-1 break-all font-mono text-[10.5px] text-sand-100/45">
                    শেয়ার লিংক: /?ref={promo.share_token}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-sand-100/35">আপনার কোড</p>
                  <p className="truncate font-mono text-[15px] font-bold tracking-[0.18em] text-leaf-300">
                    {code}
                  </p>
                </div>
                <button
                  onClick={() => copy(code, "code")}
                  className="ml-2 shrink-0 rounded-lg p-2 hover:bg-white/10"
                  aria-label="কোড কপি"
                >
                  {copied === "code" ? <Check className="h-4 w-4 text-leaf-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-sand-100/35">শেয়ার লিংক</p>
                  <p className="truncate text-[11.5px] text-sand-100/60">{link || "—"}</p>
                </div>
                <button
                  onClick={() => copy(link, "link")}
                  className="ml-2 shrink-0 rounded-lg p-2 hover:bg-white/10"
                  aria-label="লিংক কপি"
                >
                  {copied === "link" ? <Check className="h-4 w-4 text-leaf-400" /> : <Link2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `বিশ্বাস এগ্রো থেকে টাটকা কৃষিপণ্য নিন — আমার কোড ${code} ব্যবহার করে অর্ডার করুন। ${link}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-sm"
              >
                <Share2 className="h-3.5 w-3.5" /> হোয়াটসঅ্যাপে পাঠান
              </a>
              <span className="text-[11px] text-sand-100/40">
                এখন পর্যন্ত যুক্ত হয়েছে <b className="text-sand-100/70">{toBn(invited)}</b> জন
              </span>
            </div>

            {!referred ? (
              <form onSubmit={claim} className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className="input flex-1 font-mono tracking-widest"
                  placeholder="বন্ধুর কোড লিখুন"
                  maxLength={16}
                />
                <button type="submit" className="btn-primary btn-sm" disabled={claiming}>
                  যোগ করুন
                </button>
              </form>
            ) : (
              <p className="border-t border-white/[0.06] pt-3 text-[11px] text-sand-100/40">
                ✓ আপনি ইতিমধ্যে একজন বন্ধুর রেফারেল কোড ব্যবহার করেছেন।
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* ---------------------------------------------------------- ledger */}
      <div className="card overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[13.5px] font-bold">লেনদেন</h2>
          <p className="mt-0.5 text-[11px] text-sand-100/40">প্রতিটি জমা ও খরচের হিসাব</p>
        </div>

        {!ledger.length ? (
          <p className="py-10 text-center text-[12px] text-sand-100/40">
            এখনো কোনো লেনদেন নেই — বন্ধুকে রেফার করলে এখানে জমা দেখবেন।
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {ledger.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium">{walletKindLabel(row.kind)}</p>
                  <p className="truncate text-[10.5px] text-sand-100/40">
                    {row.note_bn || row.order_no || ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-[13px] font-semibold ${
                      Number(row.amount) >= 0 ? "text-leaf-300" : "text-sand-100/80"
                    }`}
                  >
                    {Number(row.amount) >= 0 ? "+" : "−"}
                    {money(Math.abs(Number(row.amount)), true)}
                  </p>
                  <p className="text-[10px] text-sand-100/35">{money(Number(row.balance_after), true)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
