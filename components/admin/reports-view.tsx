"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money, toBn } from "@/lib/format";

type Row = { id: string; total: number; status: string; created_at: string };
type Period = "daily" | "weekly" | "monthly";

function bucketKey(date: Date, period: Period): string {
  const d = new Date(date);
  if (period === "daily") return d.toISOString().slice(0, 10);
  if (period === "weekly") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(d.setDate(diff));
    return `সপ্তাহ ${monday.toISOString().slice(0, 10)}`;
  }
  return d.toISOString().slice(0, 7);
}

export function ReportsView({ orders, dbReady }: { orders: Row[]; dbReady: boolean }) {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>("daily");

  const buckets = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const key = bucketKey(new Date(o.created_at), period);
      const current = map.get(key) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(o.total);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 30);
  }, [orders, period]);

  const totals = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((s, o) => s + Number(o.total), 0);
    return {
      revenue,
      count: valid.length,
      avg: valid.length ? revenue / valid.length : 0,
      cancelled: orders.length - valid.length,
    };
  }, [orders]);

  const maxRevenue = Math.max(1, ...buckets.map(([, v]) => v.revenue));

  function exportCsv() {
    const header = ["Period", "Orders", "Revenue (BDT)", "Avg order"];
    const rows = buckets.map(([key, v]) => [key, v.count, v.revenue.toFixed(2), (v.revenue / v.count).toFixed(2)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("রিপোর্ট ডাউনলোড হয়েছে");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">বিক্রয় রিপোর্ট</h1>
          <p className="text-[12px] text-sand-100/45">গত ৯০ দিনের ডেটা</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost btn-sm" disabled={!buckets.length}>
          <Download className="h-4 w-4" /> CSV ডাউনলোড
        </button>
      </div>

      {!dbReady || !orders.length ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          রিপোর্ট দেখাতে অর্ডার ডেটা দরকার। ডেটাবেস সংযুক্ত হলে এখানে বাস্তব বিক্রয় দেখাবে।
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "মোট বিক্রয়", value: money(totals.revenue, true) },
          { label: "অর্ডার", value: toBn(totals.count) },
          { label: "গড় অর্ডার মূল্য", value: money(totals.avg, true) },
          { label: "বাতিল", value: toBn(totals.cancelled) },
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[10.5px] text-sand-100/45">{c.label}</p>
            <p className="mt-1 text-lg font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`chip ${period === p ? "chip-active" : ""}`}>
            {p === "daily" ? "দৈনিক" : p === "weekly" ? "সাপ্তাহিক" : "মাসিক"}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-[13.5px] font-bold">বিক্রয় প্রবণতা</h2>
        {buckets.length ? (
          <ul className="space-y-2">
            {buckets.map(([key, v]) => (
              <li key={key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[10.5px] text-sand-100/50">{key}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-leaf-700 to-leaf-400"
                    style={{ width: `${Math.max(3, (v.revenue / maxRevenue) * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[10.5px] font-semibold text-leaf-200">
                  {money(v.revenue, true)}
                </span>
                <span className="w-8 shrink-0 text-right text-[10px] text-sand-100/35">{toBn(v.count)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-[12px] text-sand-100/40">ডেটা নেই</p>
        )}
      </div>
    </div>
  );
}
