"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

type Check = {
  id: string;
  label: string;
  group: "env" | "db" | "auth" | "storage" | "realtime";
  status: "pass" | "fail" | "skip";
  detail: string;
  ms?: number;
};

type Report = { checks: Check[]; passed: number; failed: number; total: number; ranAt: string };

const GROUP_LABEL: Record<Check["group"], string> = {
  env: "এনভায়রনমেন্ট",
  db: "ডেটাবেজ",
  auth: "অনুমতি (RLS)",
  storage: "স্টোরেজ",
  realtime: "রিয়েলটাইম",
};

const GROUP_ORDER: Check["group"][] = ["env", "db", "auth", "storage", "realtime"];

export function SystemCheck() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyFailures, setOnlyFailures] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/foisal/system-check", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        setError(json?.message ?? "চেক চালানো যায়নি — আবার চেষ্টা করুন");
        return;
      }
      setReport(json.data as Report);
    } catch (err) {
      setError((err as Error).message || "নেটওয়ার্ক সমস্যা");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const grouped = useMemo(() => {
    const map = new Map<Check["group"], Check[]>();
    for (const group of GROUP_ORDER) map.set(group, []);
    for (const check of report?.checks ?? []) {
      if (onlyFailures && check.status !== "fail") continue;
      map.get(check.group)?.push(check);
    }
    return map;
  }, [report, onlyFailures]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="btn-primary btn-sm min-h-[40px]"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {busy ? "চেক চলছে…" : "আবার চেক করুন"}
        </button>

        <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-sand-100/60">
          <input
            type="checkbox"
            checked={onlyFailures}
            onChange={(e) => setOnlyFailures(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-leaf-500"
          />
          শুধু ব্যর্থগুলো দেখান
        </label>

        {report ? (
          <div className="ml-auto flex items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-500/30 bg-leaf-600/10 px-2.5 py-1 font-semibold text-leaf-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> {report.passed} পাস
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
                report.failed
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-white/10 bg-white/[0.04] text-sand-100/50"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" /> {report.failed} ব্যর্থ
            </span>
            <span className="hidden text-[11px] text-sand-100/35 sm:inline">
              {new Date(report.ranAt).toLocaleTimeString("bn-BD")}
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12.5px] leading-relaxed text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {GROUP_ORDER.map((group) => {
        const rows = grouped.get(group) ?? [];
        if (!rows.length) return null;
        const failures = rows.filter((r) => r.status === "fail").length;
        return (
          <section key={group} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/60">
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
              <h2 className="text-[13px] font-bold text-sand-100">{GROUP_LABEL[group]}</h2>
              <span className={`text-[11px] font-semibold ${failures ? "text-red-300" : "text-leaf-300"}`}>
                {failures ? `${failures} টি ব্যর্থ` : "সব ঠিক"}
              </span>
            </header>
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                  {row.status === "pass" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
                  ) : row.status === "fail" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-sand-100/90">{row.label}</p>
                    <p
                      className={`mt-0.5 break-words text-[11px] leading-relaxed ${
                        row.status === "fail" ? "text-red-200/80" : "text-sand-100/40"
                      }`}
                    >
                      {row.detail}
                      {typeof row.ms === "number" ? ` · ${row.ms}ms` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {!report && busy ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
