"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeTable } from "@/lib/use-realtime";
import { supabaseConfigured } from "@/lib/supabase-browser";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Filter,
  ImageIcon,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateTimeBn, money, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";
import type { PaymentQueueRow } from "@/lib/types";
import { adminHref } from "@/lib/paths";

/* ==========================================================================
   PaymentConsole — the admin verification queue (section A.3)
   --------------------------------------------------------------------------
   Built around one idea: the admin's job is to compare two numbers and a
   TrxID, fast, and get it right. So the row already carries the verdict of
   both machine checks:

     amount_matches   ৳ expected vs ৳ submitted
     trx_collision    another payment already claims this TrxID

   Nothing here can approve by itself — every action posts to
   /api/foisal/payments, which re-checks `payments.verify` and re-runs the
   duplicate-TrxID guard inside `decidePayment()`.

   Live updates come from Supabase Realtime (migration 0010 puts `payments` on
   the supabase_realtime publication), so a new TrxID appears the moment it is
   submitted. Vercel's functions cannot hold a socket open, but the browser can,
   and Realtime applies RLS per subscriber — a manager sees exactly what the
   `payments_admin_read` policy allows. A slow poll (90 s, visible tab only)
   stays as a fallback for networks that block websockets.
   ========================================================================== */

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "যাচাই বাকি", className: "bg-amber-500/15 text-amber-300" },
  verified: { label: "ভেরিফাইড", className: "bg-leaf-600/20 text-leaf-200" },
  rejected: { label: "বাতিল", className: "bg-red-500/15 text-red-300" },
  needs_info: { label: "তথ্য দরকার", className: "bg-sky-500/15 text-sky-300" },
};

const POLL_MS = 90_000;

export function PaymentConsole({
  initial,
  methods,
  canVerify,
}: {
  initial: PaymentQueueRow[];
  methods: { code: string; name_bn: string }[];
  canVerify: boolean;
}) {
  const toast = useToast();

  const [rows, setRows] = useState<PaymentQueueRow[]>(initial);
  const [status, setStatus] = useState("pending");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRow, setOpenRow] = useState<PaymentQueueRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [sound, setSound] = useState(false);
  const [lastPending, setLastPending] = useState<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  /* ---------------------------------------------------------- data loading */

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const params = new URLSearchParams({ status, method });
        if (search.trim()) params.set("q", search.trim());

        const res = await fetch(`/api/foisal/payments?${params}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.message ?? "লোড করা যায়নি");
        setRows(json.data.rows as PaymentQueueRow[]);
      } catch (error) {
        if (!quiet) toast.error("তালিকা লোড হয়নি", (error as Error).message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [status, method, search, toast]
  );

  /* Debounce the search; re-query on filter change. */
  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 400 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method, search]);

  /* Realtime: any INSERT/UPDATE on `payments` re-fetches the visible page.
     The hook also installs the slow fallback poll, which is paused while the
     tab is hidden. */
  useRealtimeTable({
    table: "payments",
    enabled: Boolean(supabaseConfigured),
    pollMs: POLL_MS,
    onChange: () => {
      if (document.visibilityState === "visible") void load(true);
    },
  });

  /* New-pending chime. */
  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  useEffect(() => {
    if (lastPending === null) {
      setLastPending(pendingCount);
      return;
    }
    if (pendingCount > lastPending && sound) chime();
    setLastPending(pendingCount);
  }, [pendingCount, lastPending, sound]);

  function chime() {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioRef.current = audioRef.current ?? new Ctx();
      const ctx = audioRef.current;
      // Two short sine notes — audible without being startling in an office.
      [880, 1180].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + index * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.16 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.16);
        osc.stop(ctx.currentTime + index * 0.16 + 0.16);
      });
    } catch {
      /* audio is a nicety, never an error */
    }
  }

  /* ------------------------------------------------------------- decisions */

  async function decide(ids: string[], decision: "verified" | "rejected" | "needs_info", reason?: string) {
    if (!canVerify) {
      toast.error("অনুমতি নেই", "পেমেন্ট অনুমোদন শুধু অ্যাডমিন করতে পারেন");
      return;
    }

    setBusy(decision);
    try {
      const res = await fetch("/api/foisal/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, decision, reason, adminNote: reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? "ব্যর্থ");

      const { succeeded, failed, results } = json.data as {
        succeeded: number;
        failed: number;
        results: { id: string; ok: boolean; message?: string }[];
      };

      if (succeeded) {
        toast.success(
          decision === "verified" ? `${toBn(succeeded)}টি পেমেন্ট ভেরিফাইড ✅` : `${toBn(succeeded)}টি আপডেট হয়েছে`,
          results.find((r) => r.ok && r.message)?.message
        );
      }
      if (failed) {
        toast.error(
          `${toBn(failed)}টি ব্যর্থ`,
          results.find((r) => !r.ok)?.message ?? "কারণ জানা যায়নি"
        );
      }

      setSelected(new Set());
      setOpenRow(null);
      await load(true);
    } catch (error) {
      toast.error("কাজটি সম্পন্ন হয়নি", (error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function bulkApproveMatching() {
    const safe = rows.filter(
      (row) => row.status === "pending" && row.amount_matches && !row.trx_collision
    );
    if (!safe.length) {
      toast.error("নিরাপদ কোনো পেমেন্ট নেই", "পরিমাণ মেলেনি বা TrxID দ্বিগুণ — একে একে দেখুন");
      return;
    }
    await decide(safe.map((r) => r.id), "verified", "বাল্ক অনুমোদন — পরিমাণ ও TrxID মিলেছে");
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const dangerousCount = rows.filter((r) => r.status === "pending" && (!r.amount_matches || r.trx_collision)).length;

  return (
    <div className="space-y-3">
      {/* ---- header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            পেমেন্ট যাচাই
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                {toBn(pendingCount)} বাকি
              </span>
            ) : null}
          </h1>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            গ্রাহকের পাঠানো TrxID মিলিয়ে অনুমোদন দিন — অনুমোদনেই অর্ডার পরিশোধিত হয়
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setSound((s) => !s);
              if (!sound) chime();
            }}
            className={`rounded-xl border px-2.5 py-2 text-[11.5px] transition ${
              sound
                ? "border-leaf-500/50 bg-leaf-600/15 text-leaf-200"
                : "border-white/10 text-sand-100/50 hover:bg-white/[0.05]"
            }`}
            aria-pressed={sound}
          >
            {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => void load()}
            className="rounded-xl border border-white/10 px-2.5 py-2 text-sand-100/60 transition hover:bg-white/[0.05]"
            aria-label="রিফ্রেশ"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <a
            href="/api/foisal/payments?format=csv&days=30"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-2 text-[11.5px] text-sand-100/60 transition hover:bg-white/[0.05]"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </div>

      {/* ---- filters */}
      <div className="card space-y-2 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { value: "pending", label: "যাচাই বাকি" },
            { value: "verified", label: "ভেরিফাইড" },
            { value: "rejected", label: "বাতিল" },
            { value: "needs_info", label: "তথ্য দরকার" },
            { value: "all", label: "সব" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${
                status === tab.value
                  ? "bg-leaf-600/25 text-leaf-100"
                  : "bg-white/[0.04] text-sand-100/55 hover:bg-white/[0.08]"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-white/10" />

          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="appearance-none rounded-full bg-white/[0.04] py-1.5 pl-3 pr-7 text-[11.5px] text-sand-100/70 focus:outline-none"
            >
              <option value="all">সব মাধ্যম</option>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name_bn}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-sand-100/40" />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand-100/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="TrxID · ফোন · অর্ডার নম্বর · পেমেন্ট নম্বর"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-[12px] placeholder:text-sand-100/30 focus:border-leaf-500/60 focus:outline-none"
          />
        </div>
      </div>

      {/* ---- bulk bar */}
      {canVerify && rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
          <label className="flex items-center gap-2 text-[11.5px] text-sand-100/60">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
              }
              className="h-3.5 w-3.5 accent-leaf-500"
            />
            {selected.size > 0 ? `${toBn(selected.size)}টি বাছাই` : "সব বাছাই"}
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={bulkApproveMatching}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-leaf-600/25 px-2.5 py-1.5 text-[11.5px] font-semibold text-leaf-100 transition hover:bg-leaf-600/35 disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> মিলে যাওয়াগুলো অনুমোদন
              {dangerousCount > 0 ? (
                <span className="rounded-full bg-amber-500/25 px-1.5 text-[9.5px] text-amber-200">
                  {toBn(dangerousCount)} সন্দেহজনক বাদ
                </span>
              ) : null}
            </button>

            <button
              onClick={() => decide([...selected], "verified")}
              disabled={selected.size === 0 || Boolean(busy)}
              className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11.5px] transition hover:bg-white/[0.12] disabled:opacity-30"
            >
              বাছাইগুলো ভেরিফাই
            </button>
          </div>
        </div>
      ) : null}

      {/* ---- queue */}
      {loading && rows.length === 0 ? (
        <div className="grid place-items-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card grid place-items-center py-14 text-center">
          <Check className="mb-2 h-8 w-8 text-leaf-400/60" />
          <p className="text-[13px] font-semibold">এই ফিল্টারে কিছু নেই</p>
          <p className="mt-0.5 text-[11.5px] text-sand-100/40">
            {status === "pending" ? "সব পেমেন্ট যাচাই হয়ে গেছে 🎉" : "অন্য ফিল্টার দেখুন"}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const meta = STATUS_META[row.status] ?? STATUS_META.pending;
            const risky = row.status === "pending" && (!row.amount_matches || row.trx_collision);

            return (
              <li
                key={row.id}
                className={`card p-3 transition ${risky ? "border-amber-500/30" : ""}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  {canVerify && row.status === "pending" ? (
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-leaf-500"
                      aria-label="বাছাই"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span className="font-mono text-[10.5px] text-sand-100/40">{row.payment_no}</span>
                      <span className="text-[11.5px] font-semibold">{row.method_name_bn ?? row.method_code}</span>
                      {row.trx_collision ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-red-300">
                          <AlertTriangle className="h-2.5 w-2.5" /> TrxID দ্বিগুণ
                        </span>
                      ) : null}
                      {!row.amount_matches && row.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-300">
                          <AlertTriangle className="h-2.5 w-2.5" /> ৳ মেলেনি
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[13px] font-semibold">
                      {money(row.amount)}{" "}
                      <span className="text-[11px] font-normal text-sand-100/40">
                        / প্রত্যাশিত {money(row.expected_amount)}
                      </span>
                    </p>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-sand-100/50">
                      <span className="font-mono">{row.trx_id ?? "TrxID নেই"}</span>
                      <span className="text-sand-100/20">·</span>
                      <span>{row.sender_number ?? "—"}</span>
                      <span className="text-sand-100/20">·</span>
                      <span>{row.order_no ? `#${row.order_no}` : row.sub_no ?? ""}</span>
                      <span className="text-sand-100/20">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDateTimeBn(row.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setOpenRow(row)}
                      className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] transition hover:bg-white/[0.12]"
                    >
                      দেখুন
                    </button>
                    {canVerify && row.status !== "verified" ? (
                      <>
                        <button
                          onClick={() => decide([row.id], "verified")}
                          disabled={Boolean(busy)}
                          className="rounded-lg bg-leaf-600/25 px-2.5 py-1.5 text-[11px] font-semibold text-leaf-100 transition hover:bg-leaf-600/40 disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setOpenRow(row)}
                          className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[11px] text-red-300 transition hover:bg-red-500/25"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {openRow ? (
        <DetailPanel
          row={openRow}
          canVerify={canVerify}
          busy={Boolean(busy)}
          onClose={() => setOpenRow(null)}
          onDecide={decide}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- detail panel */

function DetailPanel({
  row,
  canVerify,
  busy,
  onClose,
  onDecide,
}: {
  row: PaymentQueueRow;
  canVerify: boolean;
  busy: boolean;
  onClose: () => void;
  onDecide: (ids: string[], decision: "verified" | "rejected" | "needs_info", reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"view" | "reject" | "info">("view");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);

  /* The bucket is private, so the image is fetched as a 60-second signed URL
     rather than rendered from a stored public link. */
  useEffect(() => {
    if (!row.screenshot_url) return;
    let cancelled = false;
    setLoadingProof(true);

    fetch(`/api/payments/upload-proof?path=${encodeURIComponent(row.screenshot_url)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok) setProofUrl(json.data.url);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoadingProof(false);
      });

    return () => {
      cancelled = true;
    };
  }, [row.screenshot_url]);

  const blocked = row.trx_collision || !row.amount_matches;

  return (
    <div className="fixed inset-0 z-[97]">
      <button className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} aria-label="বন্ধ" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-ink-900">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="font-mono text-[10.5px] text-sand-100/40">{row.payment_no}</p>
            <h2 className="text-[14px] font-bold">পেমেন্ট যাচাই</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-sand-100/50 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {/* verdict summary */}
          <div
            className={`rounded-xl p-3 ${
              blocked ? "bg-amber-500/10 ring-1 ring-amber-500/25" : "bg-leaf-600/10 ring-1 ring-leaf-600/25"
            }`}
          >
            <p className="flex items-center gap-1.5 text-[12px] font-semibold">
              {blocked ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> মিলিয়ে দেখুন
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-leaf-300" /> সব মিলে গেছে
                </>
              )}
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-sand-100/60">
              <li>
                পরিমাণ: {money(row.amount)} / {money(row.expected_amount)}{" "}
                {row.amount_matches ? "✅" : `❌ (পার্থক্য ${money(Math.abs(row.amount_delta))})`}
              </li>
              <li>TrxID: {row.trx_collision ? "❌ আগেই ব্যবহৃত" : "✅ নতুন"}</li>
            </ul>
          </div>

          <dl className="space-y-1.5 rounded-xl bg-white/[0.03] p-3 text-[11.5px]">
            <Row label="গ্রাহক" value={row.customer_name ?? "—"} />
            <Row label="ফোন" value={row.customer_phone ?? row.sender_number ?? "—"} mono />
            <Row label="প্রেরকের নম্বর" value={row.sender_number ?? "—"} mono />
            <Row label="TrxID" value={row.trx_id ?? "—"} mono />
            <Row label="মাধ্যম" value={row.method_name_bn ?? row.method_code} />
            <Row label="জমা" value={formatDateTimeBn(row.created_at)} />
            {row.paid_at ? <Row label="টাকা পাঠানোর সময়" value={formatDateTimeBn(row.paid_at)} /> : null}
            {row.order_no ? (
              <Row
                label="অর্ডার"
                value={
                  <Link href={adminHref("orders")} className="inline-flex items-center gap-1 text-leaf-200 hover:underline">
                    #{row.order_no} <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                }
              />
            ) : (
              <Row label="প্ল্যান" value={row.plan_name_bn ?? row.sub_no ?? "—"} />
            )}
            <Row label="প্রয়াস" value={`${toBn(row.attempt_no)}তম`} />
            {row.submitted_ip ? <Row label="IP" value={row.submitted_ip} mono /> : null}
          </dl>

          {/* screenshot */}
          <div>
            <p className="mb-1 text-[11.5px] font-medium text-sand-100/70">স্ক্রিনশট</p>
            {!row.screenshot_url ? (
              <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-[11px] text-sand-100/35">
                স্ক্রিনশট দেওয়া হয়নি
              </p>
            ) : loadingProof ? (
              <div className="grid h-40 place-items-center rounded-xl bg-white/[0.03]">
                <Loader2 className="h-4 w-4 animate-spin text-sand-100/40" />
              </div>
            ) : proofUrl ? (
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-white/[0.03]"
              >
                <Image src={proofUrl} alt="পেমেন্ট স্ক্রিনশট" fill sizes="360px" className="object-contain" unoptimized />
              </a>
            ) : (
              <p className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-3 text-[11px] text-red-300">
                <ImageIcon className="h-3.5 w-3.5" /> স্ক্রিনশট লোড করা যায়নি
              </p>
            )}
          </div>

          {row.reject_reason ? (
            <div className="rounded-xl bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
              <p className="font-semibold">বাতিলের কারণ</p>
              <p className="mt-0.5 text-red-200/80">{row.reject_reason}</p>
            </div>
          ) : null}

          {mode !== "view" ? (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "reject" ? "কারণ লিখুন (গ্রাহক দেখবেন)" : "কী তথ্য দরকার তা লিখুন"}
              className="inp min-h-[70px]"
              autoFocus
            />
          ) : null}
        </div>

        {canVerify ? (
          <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
            {mode === "view" ? (
              <>
                <button
                  onClick={() => onDecide([row.id], "verified")}
                  disabled={busy || row.status === "verified"}
                  className="btn-primary w-full rounded-xl py-2.5 text-[13px]"
                >
                  {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} অনুমোদন দিন
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("info")}
                    className="btn-ghost flex-1 rounded-xl py-2 text-[12px]"
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5" /> তথ্য চান
                  </button>
                  <button
                    onClick={() => setMode("reject")}
                    className="flex-1 rounded-xl bg-red-500/15 py-2 text-[12px] text-red-300 transition hover:bg-red-500/25"
                  >
                    <X className="h-3.5 w-3.5" /> বাতিল
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setMode("view")} className="btn-ghost flex-1 rounded-xl py-2 text-[12px]">
                  ফিরে যান
                </button>
                <button
                  onClick={() => void onDecide([row.id], mode === "reject" ? "rejected" : "needs_info", reason)}
                  disabled={busy || !reason.trim()}
                  className={`flex-1 rounded-xl py-2 text-[12px] font-semibold ${
                    mode === "reject" ? "bg-red-500/25 text-red-200" : "bg-sky-500/20 text-sky-200"
                  } disabled:opacity-40`}
                >
                  নিশ্চিত করুন
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-white/[0.06] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11.5px] text-amber-300">
              <BellRing className="h-3.5 w-3.5" /> অনুমোদন শুধু অ্যাডমিন করতে পারেন
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-sand-100/40">{label}</dt>
      <dd className={`min-w-0 text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
