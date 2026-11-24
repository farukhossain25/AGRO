"use client";

import { useState } from "react";
import { Copy, Download, Loader2, Ticket } from "lucide-react";
import { useToast } from "@/lib/toast";

export type AccessCodeRow = {
  id?: string;
  code: string;
  status: string;
  plan_id: string | null;
  note?: string | null;
  expires_at: string | null;
  used_at?: string | null;
  issued_at?: string;
};

const STATUS_BN: Record<string, string> = {
  unused: "অব্যবহৃত",
  used: "ব্যবহৃত",
  revoked: "বাতিল",
  expired: "মেয়াদোত্তীর্ণ",
};

export function CodeManager({
  initial,
  plans,
  dbReady,
  counts,
}: {
  initial: AccessCodeRow[];
  plans: { id: string; label: string }[];
  dbReady: boolean;
  counts: { unused: number; used: number };
}) {
  const { success, error: errorToast } = useToast();
  const [rows, setRows] = useState<AccessCodeRow[]>(initial);
  const [count, setCount] = useState(20);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [validDays, setValidDays] = useState(180);
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/premium/codes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count, planId: planId || undefined, validDays }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("কোড তৈরি হয়নি", json?.message);
        return;
      }

      const codes: string[] = json.data.codes;
      setFresh(codes);
      setRows((prev) => [
        ...codes.map((code) => ({
          code,
          status: "unused",
          plan_id: planId || null,
          expires_at: new Date(Date.now() + validDays * 86_400_000).toISOString(),
        })),
        ...prev,
      ]);
      success(`${codes.length}টি কোড তৈরি হয়েছে`);
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    const list = (fresh.length ? fresh : rows.filter((r) => r.status === "unused").map((r) => r.code)).join("\n");
    try {
      await navigator.clipboard.writeText(list);
      success("কোড কপি হয়েছে", `${list.split("\n").length}টি কোড`);
    } catch {
      errorToast("কপি করা যায়নি");
    }
  };

  const csv = () => {
    const data = fresh.length
      ? fresh.map((c) => `"${c}","unused","",""`)
      : rows.map((r) => `"${r.code}","${r.status}","${r.expires_at ?? ""}","${r.used_at ?? ""}"`);
    const blob = new Blob([`code,status,expires_at,used_at\n${data.join("\n")}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">অ্যাক্সেস কোড</h1>
        <p className="text-[12px] text-sand-100/45">
          {counts.unused}টি অব্যবহৃত · {counts.used}টি ব্যবহৃত — দোকানে কার্ড হিসেবে বিক্রি করুন
        </p>
      </div>

      {!dbReady && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই।
        </p>
      )}

      {/* generator */}
      <div className="card space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-neu-ink">
          <Ticket className="h-3.5 w-3.5 text-mint" /> নতুন ব্যাচ তৈরি করুন
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="label text-[11px]">সংখ্যা</label>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="input py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label className="label text-[11px]">প্ল্যান</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="input py-2 text-[12.5px]">
              <option value="">— প্ল্যান ছাড়া —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-[11px]">কোডের মেয়াদ (দিন)</label>
            <input
              type="number"
              min={1}
              max={730}
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              className="input py-2 text-[12.5px]"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generate} disabled={loading || !dbReady} className="btn-primary btn-sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loading ? "তৈরি হচ্ছে…" : "কোড তৈরি করুন"}
          </button>
          <button type="button" onClick={copyAll} className="btn-ghost btn-sm">
            <Copy className="h-3.5 w-3.5" /> কপি
          </button>
          <button type="button" onClick={csv} className="btn-ghost btn-sm">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {fresh.length > 0 && (
          <div className="rounded-lg border border-mint/25 bg-leaf-900/25 p-3">
            <p className="mb-1.5 text-[11px] font-semibold text-mint">সদ্য তৈরি ({fresh.length}টি)</p>
            <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-sand-100/75 sm:grid-cols-3">
              {fresh.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">কোড</th>
                <th className="px-3 py-2.5 font-medium">স্টেটাস</th>
                <th className="px-3 py-2.5 font-medium">মেয়াদ</th>
                <th className="px-3 py-2.5 font-medium">ব্যবহৃত</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.slice(0, 200).map((r, i) => (
                <tr key={`${r.code}-${i}`} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-[11.5px]">{r.code}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        r.status === "unused"
                          ? "bg-leaf-600/20 text-leaf-700"
                          : r.status === "used"
                          ? "bg-white/[0.07] text-sand-100/50"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {STATUS_BN[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-sand-100/50">
                    {r.expires_at ? new Date(r.expires_at).toLocaleDateString("bn-BD") : "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-sand-100/50">
                    {r.used_at ? new Date(r.used_at).toLocaleDateString("bn-BD") : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-sand-100/40">
                    এখনো কোনো কোড তৈরি হয়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
