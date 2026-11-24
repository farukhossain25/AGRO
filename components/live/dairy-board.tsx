"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Video } from "lucide-react";
import type { Farm } from "@/lib/types";
import { LiveStreamLazy } from "./live-stream-lazy";

/* ==========================================================================
   DairyBoard — production numbers + the milking-parlour camera
   --------------------------------------------------------------------------
   Polls /api/farms/dairy every 45s so the "sold today" figure keeps up with
   real orders without needing websockets on a hobby deployment.
   ========================================================================== */

type BoardRow = {
  id: string;
  slug: string;
  name_bn: string;
  district: string;
  owner_name_bn: string | null;
  cows: number;
  litres_today: number;
  sold_today: number;
  remaining_today: number;
  percent_sold: number;
  note_bn: string;
  online_cameras: number;
  camera_count: number;
  updated_at: string;
};

type ApiPayload = {
  farms: BoardRow[];
  totals: { cows: number; litres_today: number; sold_today: number; remaining_today: number };
  generatedAt: string;
};

export function DairyBoard({ farms }: { farms: Farm[] }) {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [updated, setUpdated] = useState<string>(new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [activeFarm, setActiveFarm] = useState<string | null>(farms[0]?.id ?? null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/farms/dairy", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setRows((json.data as ApiPayload).farms);
        setUpdated((json.data as ApiPayload).generatedAt);
      }
    } catch {
      /* offline — the server-rendered fallback below keeps the page usable */
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 45_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const fallback: BoardRow[] = farms.map((f) => {
    const out = (f.daily_output ?? {}) as Record<string, number | string>;
    const litres = Number(out.litres_today ?? 0);
    const sold = Number(out.sold_today ?? 0);
    return {
      id: f.id,
      slug: f.slug,
      name_bn: f.name_bn,
      district: f.district,
      owner_name_bn: f.owner_name_bn,
      cows: Number(out.cows ?? 0),
      litres_today: litres,
      sold_today: sold,
      remaining_today: Math.max(0, litres - sold),
      percent_sold: litres ? Math.min(100, Math.round((sold / litres) * 100)) : 0,
      note_bn: String(out.note_bn ?? ""),
      online_cameras: f.online_cameras ?? 0,
      camera_count: f.camera_count ?? 0,
      updated_at: new Date().toISOString(),
    };
  });

  const board = rows.length ? rows : fallback;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] text-sand-100/40">
          শেষ হালনাগাদ: {new Date(updated).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-mint transition hover:opacity-80 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> রিফ্রেশ
        </button>
      </div>

      {board.map((row) => {
        const farm = farms.find((f) => f.id === row.id);
        const camera = farm?.cameras?.find((c) => c.status === "online") ?? farm?.cameras?.[0];
        const isActive = activeFarm === row.id;

        return (
          <article key={row.id} className="card overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
              {/* camera side */}
              <div className="p-3 sm:p-4">
                {camera ? (
                  isActive ? (
                    <LiveStreamLazy
                      cameraId={camera.id}
                      cameraName={`${row.name_bn} — ${camera.name_bn}`}
                      poster={camera.poster ?? farm?.cover ?? null}
                      eager
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveFarm(row.id)}
                      className="group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-white/10"
                    >
                      <span className="flex flex-col items-center gap-2 text-sand-100/60">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-mint/15 text-mint transition group-hover:scale-110">
                          <Video className="h-5 w-5" />
                        </span>
                        <span className="text-[12px]">ক্যামেরা চালু করতে ক্লিক করুন</span>
                        <span className="text-[10.5px] text-sand-100/35">{camera.name_bn}</span>
                      </span>
                    </button>
                  )
                ) : (
                  <div className="grid aspect-video place-items-center rounded-2xl bg-ink-800 text-[12px] text-sand-100/40">
                    এই খামারে ক্যামেরা নেই
                  </div>
                )}
              </div>

              {/* numbers */}
              <div className="border-t border-white/5 p-4 lg:border-l lg:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-bold text-neu-ink">{row.name_bn}</h2>
                    <p className="mt-0.5 text-[11.5px] text-sand-100/45">
                      {row.district} · {bn(row.cows)} গাভী · {bn(row.online_cameras)}/{bn(row.camera_count)} ক্যামেরা
                    </p>
                  </div>
                  <Link
                    href={`/live/farms/${row.slug}`}
                    className="shrink-0 text-[11px] font-medium text-mint hover:underline"
                  >
                    খামার →
                  </Link>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/[0.03] p-2.5">
                    <dt className="text-[10px] text-sand-100/40">আজ উৎপাদন</dt>
                    <dd className="mt-0.5 text-[15px] font-bold text-neu-ink">{bn(row.litres_today)}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2.5">
                    <dt className="text-[10px] text-sand-100/40">বিক্রি</dt>
                    <dd className="mt-0.5 text-[15px] font-bold text-mint">{bn(row.sold_today)}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2.5">
                    <dt className="text-[10px] text-sand-100/40">বাকি</dt>
                    <dd className="mt-0.5 text-[15px] font-bold text-amber-300">{bn(row.remaining_today)}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10.5px] text-sand-100/40">
                    <span>আজকের দুধের {bn(row.percent_sold)}% বিক্রি হয়েছে</span>
                    <span>{bn(row.litres_today)} লি.</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-leaf-600 to-mint transition-all duration-700"
                      style={{ width: `${row.percent_sold}%` }}
                    />
                  </div>
                </div>

                {row.note_bn && (
                  <p className="mt-3 rounded-lg bg-leaf-900/30 px-2.5 py-1.5 text-[11px] text-leaf-200/80">
                    🕐 {row.note_bn}
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function bn(n: number): string {
  return String(Math.round(n ?? 0)).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
