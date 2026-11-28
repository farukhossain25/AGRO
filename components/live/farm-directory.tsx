"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, Map as MapIcon, Mountain, Video } from "lucide-react";
import type { Farm } from "@/lib/types";
import { liveBadgeParts } from "@/lib/live-counts";

/* Leaflet and MapLibre both need `window`, so they are client-only chunks. */
const FarmMap = dynamic(() => import("@/components/maps/farm-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const FarmMap3D = dynamic(() => import("@/components/maps/farm-map-3d"), {
  ssr: false,
  loading: () => <MapSkeleton label="৩ডি টেরেইন লোড হচ্ছে…" />,
});

const TYPE_LABEL: Record<string, string> = {
  vegetables: "শাকসবজি",
  dairy: "দুগ্ধ",
  poultry: "মুরগি ও ডিম",
  fish: "মাছ",
  fruits: "ফল",
};

export function FarmDirectory({ farms }: { farms: Farm[] }) {
  const [view, setView] = useState<"grid" | "map" | "3d">("grid");
  const [activeId, setActiveId] = useState<string | null>(null);

  const cameraFarms = useMemo(() => farms.map((f) => f.id), [farms]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              { id: "grid", label: "কার্ড", icon: LayoutGrid },
              { id: "map", label: "ম্যাপ", icon: MapIcon },
              { id: "3d", label: "৩ডি", icon: Mountain },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                view === id ? "bg-mint text-white" : "text-sand-100/60 hover:text-sand-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <p className="hidden text-[11.5px] text-sand-100/40 sm:block">
          {(() => {
            const cams = farms.reduce((n, f) => n + (f.online_cameras ?? 0), 0);
            const tv = farms.reduce((n, f) => n + (f.tv_online ?? 0), 0);
            const parts: string[] = [];
            if (cams) parts.push(`${bn(cams)}টি ক্যামেরা অনলাইন`);
            if (tv) parts.push(`${bn(tv)}টি টিভি চ্যানেল চলছে`);
            return parts.length ? parts.join(" · ") : "এখন কোনো ভিডিও অনলাইন নেই";
          })()}
        </p>
      </div>

      {view === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farms.map((farm) => (
            <article
              key={farm.id}
              className="group card overflow-hidden transition hover:-translate-y-0.5 hover:border-leaf-600/40"
            >
              <Link href={`/live/farms/${farm.slug}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={farm.cover || "/images/hero/farm.jpg"}
                    alt={farm.name_bn}
                    fill
                    sizes="(max-width:768px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-scrim/95 via-scrim/25 to-transparent" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    <Video className="h-2.5 w-2.5" />
                    {(() => {
                      const parts = liveBadgeParts(farm, bn);
                      return parts.length ? parts.join(" · ") : "অফলাইন";
                    })()}
                  </span>
                  <div className="absolute inset-x-3 bottom-3">
                    <div className="flex items-center gap-2">
                      {farm.logo ? (
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-white/80">
                          <Image src={farm.logo} alt="" fill sizes="32px" className="object-contain p-px" />
                        </span>
                      ) : null}
                      <h2 className="text-[15px] font-bold text-white drop-shadow">{farm.name_bn}</h2>
                    </div>
                    <p className="text-[11.5px] text-white/60">
                      {TYPE_LABEL[farm.type]} · {farm.upazila ? `${farm.upazila}, ` : ""}
                      {farm.district}
                    </p>
                  </div>
                </div>
              </Link>

              <div className="p-4">
                <div className="flex items-center gap-2">
                  {farm.owner_photo && (
                    <Image
                      src={farm.owner_photo}
                      alt={farm.owner_name_bn ?? ""}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-mint/30"
                    />
                  )}
                  <p className="text-[12px] text-sand-100/60">
                    <span className="text-sand-100/40">কৃষক:</span>{" "}
                    {farm.owner_name_bn ?? "দলীয় খামার"}
                  </p>
                </div>

                <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-sand-100/55">
                  {farm.description_bn}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {(farm.certifications ?? []).slice(0, 2).map((c) => (
                    <span key={c} className="rounded-full bg-leaf-600/15 px-2 py-0.5 text-[10px] text-leaf-700">
                      ✓ {c}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/live/farms/${farm.slug}`} className="btn-primary btn-sm flex-1">
                    খামার দেখুন
                  </Link>
                  <Link
                    href={`/live/farms/${farm.slug}#cameras`}
                    className="btn-ghost btn-sm shrink-0"
                    aria-label="লাইভ ক্যামেরা"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {view === "map" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <FarmMap farms={farms} cameraFarms={cameraFarms} activeFarmId={activeId} onSelect={setActiveId} height={480} />
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {farms.map((farm) => (
              <button
                key={farm.id}
                type="button"
                onMouseEnter={() => setActiveId(farm.id)}
                onClick={() => setActiveId(farm.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  activeId === farm.id
                    ? "border-mint/50 bg-mint/10"
                    : "border-white/8 bg-white/[0.02] hover:border-mint/25"
                }`}
              >
                <p className="text-[13px] font-semibold text-neu-ink">{farm.name_bn}</p>
                <p className="mt-0.5 text-[11px] text-sand-100/50">
                  {farm.district} · {(() => {
                    const cams = farm.online_cameras ?? 0;
                    const tv = farm.tv_online ?? 0;
                    const parts: string[] = [];
                    if (cams) parts.push(`${bn(cams)} লাইভ ক্যামেরা`);
                    if (tv) parts.push(`${bn(tv)} টিভি চ্যানেল`);
                    return parts.length ? parts.join(", ") : "এখন লাইভ নেই";
                  })()}
                </p>
                <Link
                  href={`/live/farms/${farm.slug}`}
                  className="mt-1 inline-block text-[11px] font-medium text-mint hover:underline"
                >
                  বিস্তারিত →
                </Link>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "3d" && (
        <div className="space-y-4">
          <FarmMap3D farms={farms} activeFarmId={activeId} onSelect={setActiveId} height={480} />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {farms.map((farm) => (
              <button
                key={farm.id}
                type="button"
                onClick={() => setActiveId(farm.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                  activeId === farm.id
                    ? "border-mint/60 bg-mint/15 text-mint"
                    : "border-white/10 text-sand-100/60 hover:border-mint/35"
                }`}
              >
                {farm.name_bn}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-sand-100/40">
            💡 ম্যাপ টেনে ঘোরান, স্ক্রল করে জুম করুন। প্রতিটি ব্লকের উচ্চতা খামারের ধরন অনুযায়ী — ডেইরি সবচেয়ে উঁচু।
          </p>
        </div>
      )}
    </div>
  );
}

function MapSkeleton({ label = "ম্যাপ লোড হচ্ছে…" }: { label?: string }) {
  return (
    <div className="grid h-[420px] place-items-center rounded-2xl border border-white/8 bg-ink-800">
      <div className="flex flex-col items-center gap-2">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-mint/25 border-t-mint" />
        <p className="text-[11px] text-sand-100/40">{label}</p>
      </div>
    </div>
  );
}

function bn(n: number): string {
  return String(n ?? 0).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
