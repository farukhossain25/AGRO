"use client";

import { useMemo, useState } from "react";
import { Video, Wifi, WifiOff, Wrench } from "lucide-react";
import type { Camera } from "@/lib/types";
import { LiveStreamLazy } from "./live-stream-lazy";
import { CloudPlayer } from "./cloud-player";

/* ==========================================================================
   FarmCameras — camera picker + player for a single farm
   ========================================================================== */

export function FarmCameras({
  cameras,
  farmName,
  cover,
}: {
  cameras: Camera[];
  farmName: string;
  cover?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(cameras[0]?.id ?? null);
  const [mode, setMode] = useState<"premium" | "trial" | "locked">("locked");

  const active = useMemo(() => cameras.find((c) => c.id === selected) ?? cameras[0], [cameras, selected]);

  if (!cameras.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
        <Video className="h-7 w-7 text-sand-100/25" />
        <p className="mt-3 text-sm text-sand-100/60">এই খামারে এখনো লাইভ ক্যামেরা নেই</p>
        <p className="mt-1 text-[11.5px] text-sand-100/35">শীঘ্রই যোগ করা হবে — নোটিফিকেশন চালু রাখুন</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
      <div>
        {/* A cloud-bridge camera (seller's own app keeps it online) uses the
            plain player; everything else keeps the VPS/token path. */}
        {active!.cloud_provider && active!.cloud_provider !== "none" ? (
          <CloudPlayer
            key={active!.id}
            cameraId={active!.id}
            cameraName={`${farmName} — ${active!.name_bn}`}
            poster={active!.poster ?? cover ?? null}
            onMode={setMode}
          />
        ) : (
          <LiveStreamLazy
            key={active!.id}
            cameraId={active!.id}
            cameraName={`${farmName} — ${active!.name_bn}`}
            poster={active!.poster ?? cover ?? null}
            onMode={setMode}
            /* the first camera on a farm page is the reason the visitor came */
            eager
          />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-sand-100/45">
          <StatusPill status={active!.status} />
          <span>জোন: {active!.zone_bn}</span>
          <span>সর্বোচ্চ {active!.max_viewers} দর্শক</span>
          {mode === "trial" && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300">
              ফ্রি ট্রায়াল চলছে
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {cameras.map((cam) => {
          const isActive = cam.id === active!.id;
          return (
            <button
              key={cam.id}
              type="button"
              onClick={() => setSelected(cam.id)}
              className={`flex w-44 shrink-0 items-start gap-2 rounded-xl border p-2.5 text-left transition lg:w-auto ${
                isActive
                  ? "border-mint/50 bg-mint/10"
                  : "border-white/8 bg-white/[0.02] hover:border-mint/25"
              }`}
            >
              <span className="mt-0.5">
                {cam.status === "online" ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                ) : cam.status === "maintenance" ? (
                  <Wrench className="h-3 w-3 text-amber-400" />
                ) : (
                  <WifiOff className="h-3 w-3 text-sand-100/30" />
                )}
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-[12px] font-semibold ${isActive ? "text-mint" : "text-white/85"}`}>
                  {cam.name_bn}
                </span>
                <span className="block text-[10.5px] text-sand-100/40">{cam.zone_bn}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Camera["status"] }) {
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1 text-red-300">
        <Wifi className="h-3 w-3" /> লাইভ
      </span>
    );
  }
  if (status === "maintenance") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-300">
        <Wrench className="h-3 w-3" /> রক্ষণাবেক্ষণ
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <WifiOff className="h-3 w-3" /> অফলাইন
    </span>
  );
}
