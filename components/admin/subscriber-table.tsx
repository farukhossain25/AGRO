"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/lib/toast";
import { formatDateBn, money, toBn } from "@/lib/format";
import type { Subscription } from "@/lib/types";

const statusLabel: Record<string, string> = { active: "সক্রিয়", paused: "বিরতিতে", cancelled: "বাতিল" };
const statusTone: Record<string, string> = {
  active: "bg-leaf-600/20 text-leaf-200",
  paused: "bg-amber-500/15 text-amber-300",
  cancelled: "bg-red-500/15 text-red-300",
};

export function SubscriberTable({ initial, dbReady }: { initial: Subscription[]; dbReady: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter ? rows.filter((r) => r.status === filter) : rows),
    [rows, filter]
  );

  const mrr = rows.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.price_monthly), 0);

  async function setStatus(id: string, status: "active" | "paused" | "cancelled") {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("আপডেট ব্যর্থ");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(`সাবস্ক্রিপশন ${statusLabel[status]}`);
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

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

      <div className="flex gap-1.5">
        <button onClick={() => setFilter("")} className={`chip ${!filter ? "chip-active" : ""}`}>সব ({toBn(rows.length)})</button>
        {(["active", "paused", "cancelled"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip ${filter === s ? "chip-active" : ""}`}>
            {statusLabel[s]} ({toBn(rows.filter((r) => r.status === s).length)})
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-sand-100/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">সাব নং</th>
                <th className="px-2 py-2.5 font-medium">কাস্টমার</th>
                <th className="px-2 py-2.5 font-medium">প্যাকেজ</th>
                <th className="px-2 py-2.5 font-medium">সদস্য</th>
                <th className="px-2 py-2.5 font-medium">শুরু</th>
                <th className="px-2 py-2.5 font-medium">স্টেটাস</th>
                <th className="px-3 py-2.5 text-right font-medium">মাসিক</th>
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
                    >
                      {Object.entries(statusLabel).map(([k, v]) => (
                        <option key={k} value={k} className="bg-ink-800 text-sand-100">{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{money(Number(r.price_monthly), true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <p className="py-10 text-center text-[12px] text-sand-100/40">কোনো সাবস্ক্রিপশন নেই</p> : null}
      </div>
    </div>
  );
}
