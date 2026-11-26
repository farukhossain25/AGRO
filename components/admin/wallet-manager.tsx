"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Wallet as WalletIcon } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   ওয়ালেট ও রেফারেল — admin
   --------------------------------------------------------------------------
   Read: every account with a balance, plus the code it shares.
   Write: one manual adjustment (credit or debit) with a note. The arithmetic
   happens in `wallet_apply()`, never here — this form only says how much and
   why. Money that moved by mistake is corrected with a second adjustment: the
   ledger is append-only, so there is always a history to point at.
   ========================================================================== */

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  wallet_balance: number;
  wallet_earned: number;
  wallet_spent: number;
  referral_code: string | null;
};

export function WalletManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const toast = useToast();

  const [rows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.full_name, r.phone, r.email, r.referral_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [q, rows]);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.wallet_balance ?? 0), 0),
    [rows]
  );

  function open(row: Row, sign: 1 | -1) {
    setTarget(row);
    setAmount("");
    setNote(sign === 1 ? "" : "");
    setSign(sign);
  }

  const [sign, setSign] = useState<1 | -1>(1);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const value = Math.abs(Number(amount));
    if (!value) {
      toast.error("অঙ্ক দিন", "শূন্যের বেশি একটি সংখ্যা লিখুন");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/foisal/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: target.id, amount: sign * value, note_bn: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "সেভ হয়নি");
      toast.success(
        sign === 1 ? "ব্যালেন্স বাড়ানো হয়েছে" : "ব্যালেন্স কমানো হয়েছে",
        `${target.full_name ?? target.phone ?? "অ্যাকাউন্ট"} — নতুন ব্যালেন্স ${money(Number(json.data?.balance ?? 0), true)}`
      );
      setTarget(null);
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <WalletIcon className="h-5 w-5 text-leaf-400" /> ওয়ালেট ও রেফারেল
        </h1>
        <p className="text-[12px] text-sand-100/45">
          {toBn(rows.length)}টি অ্যাকাউন্ট · মোট ব্যালেন্স {money(total, true)} · এক অর্ডারে সর্বোচ্চ{" "}
          {toBn(30)}% ব্যবহারযোগ্য (সেটিংস থেকে বদলান)
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
        <Search className="h-4 w-4 shrink-0 text-sand-100/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-transparent py-2.5 text-[12.5px] outline-none"
          placeholder="নাম, ফোন, ইমেইল বা রেফারেল কোড"
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead>
            <tr className="border-b border-white/10 text-left text-sand-100/45">
              <th className="px-3 py-2">অ্যাকাউন্ট</th>
              <th className="px-3 py-2">রেফারেল কোড</th>
              <th className="px-3 py-2">ব্যালেন্স</th>
              <th className="px-3 py-2">আয় / খরচ</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium text-sand-100/90">{r.full_name || "নাম নেই"}</p>
                  <p className="text-[10.5px] text-sand-100/40">{r.phone || r.email || "—"}</p>
                </td>
                <td className="px-3 py-2 font-mono text-[11.5px] text-leaf-300">
                  {r.referral_code || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">
                  {money(Number(r.wallet_balance ?? 0), true)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-[11px] text-sand-100/50">
                  ↑{money(Number(r.wallet_earned ?? 0), true)} · ↓
                  {money(Number(r.wallet_spent ?? 0), true)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => open(r, 1)}
                    className="rounded p-1.5 text-leaf-300 hover:bg-leaf-500/10"
                    aria-label="ক্রেডিট"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => open(r, -1)}
                    className="rounded p-1.5 text-red-300 hover:bg-red-500/10"
                    aria-label="ডেবিট"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো অ্যাকাউন্ট পাওয়া যায়নি</p>
        ) : null}
      </div>

      {target ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-3 backdrop-blur-sm sm:p-6">
          <form onSubmit={save} className="card my-10 w-full max-w-md p-5">
            <h2 className="text-[15px] font-bold">
              {sign === 1 ? "ব্যালেন্স বাড়ান" : "ব্যালেন্স কমান"} — {target.full_name || target.phone}
            </h2>
            <p className="mt-1 text-[11.5px] text-sand-100/45">
              বর্তমান ব্যালেন্স {money(Number(target.wallet_balance ?? 0), true)}। প্রতিটি সমন্বয় লেজারে লেখা থাকবে।
            </p>

            <label className="mt-4 block">
              <span className="label">অঙ্ক (৳)</span>
              <input
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                autoFocus
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="label">কারণ (বাধ্যতামূলক নয়)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input"
                placeholder={sign === 1 ? "যেমন: ক্যাম্পেইন বোনাস" : "যেমন: ভুল বোনাস ফেরত"}
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setTarget(null)} className="btn-ghost btn-sm">
                বাতিল
              </button>
              <button
                type="submit"
                className={`btn-sm ${sign === 1 ? "btn-primary" : "bg-red-600 text-white"}`}
                disabled={saving}
              >
                {saving ? <Spinner className="h-4 w-4" /> : null}
                {sign === 1 ? "যোগ করুন" : "কমান"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
