"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, Mountain } from "lucide-react";
import type { Farm } from "@/lib/types";

const FarmMap = dynamic(() => import("@/components/maps/farm-map"), { ssr: false });
const FarmMap3D = dynamic(() => import("@/components/maps/farm-map-3d"), { ssr: false });

export function FarmDetailMap({ farm, height = 320 }: { farm: Farm; height?: number }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setMode("2d")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
            mode === "2d" ? "bg-mint text-green-950" : "text-sand-100/60"
          }`}
        >
          <LayoutGrid className="h-3 w-3" /> ২ডি ম্যাপ
        </button>
        <button
          type="button"
          onClick={() => setMode("3d")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
            mode === "3d" ? "bg-mint text-green-950" : "text-sand-100/60"
          }`}
        >
          <Mountain className="h-3 w-3" /> ৩ডি টেরেইন
        </button>
      </div>

      {mode === "2d" ? (
        <FarmMap farms={[farm]} cameraFarms={[farm.id]} height={height} zoom={13} />
      ) : (
        <FarmMap3D farms={[farm]} height={height} />
      )}
    </div>
  );
}
