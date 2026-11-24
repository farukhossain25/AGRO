"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Hand,
  LayoutGrid,
  Sparkles,
  Truck,
} from "lucide-react";

/* ==========================================================================
   LumenStudio — premium product-card carousel
   --------------------------------------------------------------------------
   Rendered in the same soft-UI (neumorphic) language as the rest of AGRO so
   the whole app reads as one designed product: pale blue-grey canvas, raised
   cards with the dual highlight/shadow pair, and one green accent reserved
   for primary actions. Purely presentational; no data deps. Icons are the
   local lucide set (the strict CSP blocks every external icon CDN).
   ========================================================================== */

type Kit = {
  name: string;
  desc: string;
  price: string;
  swatches: string[];
  active: number;
  device: "pro" | "air" | "core" | "mini";
  grain: 1 | 2 | 3;
};

const KITS: Kit[] = [
  {
    name: "Lumen Pro & Pro Max",
    desc: "Dual-module rigs for the pro studio canvas.",
    price: "$1,099",
    swatches: ["#2563eb", "#1d4ed8", "#1e40af"],
    active: 0,
    device: "pro",
    grain: 1,
  },
  {
    name: "Lumen Air",
    desc: "A featherweight panel for quick, clean builds.",
    price: "$649",
    swatches: ["#bae6fd", "#7dd3fc", "#38bdf8"],
    active: 1,
    device: "air",
    grain: 2,
  },
  {
    name: "Lumen Core",
    desc: "The compact core — lotus-focused, always ready.",
    price: "$399",
    swatches: ["#c4b5fd", "#a78bfa", "#8b5cf6"],
    active: 0,
    device: "core",
    grain: 3,
  },
  {
    name: "Lumen Mini",
    desc: "Pocket-sized module for on-the-go design.",
    price: "$199",
    swatches: ["#bbf7d0", "#6ee7b7", "#10b981"],
    active: 2,
    device: "mini",
    grain: 1,
  },
];

const GRAIN_1 = "radial-gradient(120% 90% at 18% 8%, #ffffff 0%, #eef2f8 42%, #dfe5ef 100%)";
const GRAIN_2 = "radial-gradient(120% 90% at 82% 12%, #ffffff 0%, #eef2f8 42%, #dfe5ef 100%)";
const GRAIN_3 = "radial-gradient(120% 90% at 50% 6%, #ffffff 0%, #eef2f8 50%, #dde4ee 100%)";
const GRAIN = { 1: GRAIN_1, 2: GRAIN_2, 3: GRAIN_3 } as const;

export function KitsCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function scrollByCards(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  return (
    <div className="min-h-dvh bg-neu-bg font-sans text-neu-ink" style={{ WebkitFontSmoothing: "antialiased" }}>
      {/* ───────────────────────── sticky nav ───────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-neu-line/60 bg-neu-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1180px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="neu-icon-btn h-7 w-7 rounded-[9px] bg-neu-accent-soft text-neu-accent-strong">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight text-neu-ink">
              Lumen<span className="text-neu-accent-strong">Studio</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              { label: "All Kits", active: true },
              { label: "Workflows" },
              { label: "Pricing" },
              { label: "Showcase" },
              { label: "Docs" },
            ].map((l) => (
              <a
                key={l.label}
                href="#"
                className={`text-[13.5px] font-medium transition-colors hover:text-neu-ink ${
                  l.active ? "text-neu-ink" : "text-neu-muted"
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="hidden text-[13.5px] font-semibold text-neu-muted transition-colors hover:text-neu-ink sm:block"
            >
              Sign in
            </a>
            <a href="#" className="btn-primary !px-4 !py-2 !text-[13px]">
              Start free
            </a>
          </div>
        </div>
      </header>

      {/* ───────────────────────── hero strip ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-neu-line/60 bg-neu-surface/60">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: GRAIN_3 }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1180px] px-6 pb-7 pt-12">
          <div className="flex items-center gap-2 text-neu-accent-strong">
            <LayoutGrid className="h-[14px] w-[14px]" />
            <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.16em" }}>
              Studio Kits 2026
            </span>
          </div>
          <div className="mt-3 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <h1 className="max-w-[640px] text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] md:text-[44px]">
              <span className="block text-neu-ink">All kits.</span>
              <span className="block text-neu-muted">Take your pick.</span>
            </h1>
            <p className="max-w-[360px] text-[14.5px] leading-relaxed text-neu-muted">
              Modular design hardware for the infinite canvas. Pick a kit, ship UI faster.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────── carousel section ───────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-6 py-10">
        {/* header row */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-neu-ink">Featured kits</h2>
            <p className="mt-1 text-[13px] text-neu-muted">Six builds, one canvas. Drag, or use the arrows.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="neu-pill hidden items-center gap-1.5 !py-1.5 text-[13px] text-neu-accent-strong sm:flex">
              <Hand className="h-4 w-4" />
              drag to explore
            </span>
            <button
              onClick={() => scrollByCards(-1)}
              aria-label="Previous"
              className="neu-icon-btn h-10 w-10 text-neu-muted hover:text-neu-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollByCards(1)}
              aria-label="Next"
              className="grid h-10 w-10 place-items-center rounded-full bg-neu-accent text-white shadow-neu-accent-sm transition hover:bg-neu-accent-strong active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* track */}
        <div className="relative">
          <div
            ref={trackRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollLeft / 320);
              setActive(Math.max(0, Math.min(KITS.length - 1, idx)));
            }}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {KITS.map((kit, i) => (
              <article
                key={kit.name}
                className={`card card-hover relative flex w-[300px] shrink-0 snap-start flex-col !rounded-[26px] p-6 ${
                  i === 0 ? "ring-1 ring-neu-accent/25" : ""
                }`}
              >
                {i === 0 && (
                  <span className="badge absolute right-5 top-5 bg-neu-accent-soft text-[10px] font-bold uppercase text-neu-accent-strong">
                    New
                  </span>
                )}
                <h3 className="text-[21px] font-extrabold leading-[1.12] tracking-[-0.01em] text-neu-ink">
                  {kit.name}
                </h3>

                {/* device tile */}
                <div
                  className="neu-inset-sm mt-5 grid h-[200px] place-items-center rounded-[20px]"
                  style={{ background: GRAIN[kit.grain] }}
                >
                  <DeviceMock device={kit.device} />
                </div>

                {/* swatches */}
                <div className="mt-5 flex items-center gap-2">
                  {kit.swatches.map((c, si) => (
                    <span
                      key={si}
                      className={`h-3 w-3 rounded-full ${si === kit.active ? "ring-2" : ""}`}
                      style={{
                        background: c,
                        boxShadow:
                          si === kit.active
                            ? `0 0 0 2px ${c === "#2563eb" ? "#dbe6ff" : c}33`
                            : "inset 1px 1px 2px rgba(48,57,67,.25)",
                      }}
                    />
                  ))}
                </div>

                <p className="mt-3 text-[12px] leading-snug text-neu-muted">{kit.desc}</p>

                {/* footer */}
                <div className="mt-4 flex items-end justify-between border-t border-neu-line/60 pt-5">
                  <div>
                    <p className="text-[12px] text-neu-muted">From</p>
                    <p className="text-[16px] font-bold text-neu-ink">{kit.price}</p>
                    <p className="text-[12px] font-medium text-neu-muted">/ kit</p>
                  </div>
                  <button
                    className={`rounded-full px-5 py-2.5 text-[13px] font-semibold transition ${
                      i === 0
                        ? "bg-neu-accent text-white shadow-neu-accent-sm hover:bg-neu-accent-strong active:scale-95"
                        : "border border-neu-accent/40 text-neu-accent-strong hover:bg-neu-accent-soft"
                    }`}
                  >
                    Buy
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* progress bar */}
        <div className="mt-6 flex items-center gap-4">
          <div className="neu-inset-xs relative h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-neu-accent transition-[width] duration-300"
              style={{ width: `${((active + 1) / KITS.length) * 100}%` }}
            />
          </div>
          <span className="text-[12px] font-medium text-neu-muted">
            <span className="font-bold text-neu-ink">{String(active + 1).padStart(2, "0")}</span> /{" "}
            {String(KITS.length).padStart(2, "0")}
          </span>
        </div>
      </section>

      {/* ───────────────────────── footer strip ───────────────────────── */}
      <footer className="border-t border-neu-line/60 bg-neu-surface/70">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-6 py-7 sm:flex-row">
          <span className="flex items-center gap-2 text-[13px] text-neu-muted">
            <Truck className="h-4 w-4 text-neu-accent-strong" />
            Free 2-day shipping on every kit. 30-day returns.
          </span>
          <a
            href="#"
            className="flex items-center gap-1 text-[13px] font-semibold text-neu-accent-strong transition-colors hover:text-neu-accent"
          >
            Compare all kits
            <ArrowRight className="h-[14px] w-[14px]" />
          </a>
        </div>
      </footer>

      <style>{`
        .device-shadow { filter: drop-shadow(0 18px 22px rgba(112, 123, 137, .22)); }
      `}</style>
    </div>
  );
}

/** Stylized CSS-only device mock, floated by a drop-shadow filter. */
function DeviceMock({ device }: { device: Kit["device"] }) {
  if (device === "pro") {
    return (
      <div className="device-shadow flex items-center gap-2.5">
        <div className="rounded-[18px] bg-gradient-to-b from-[#2563eb] to-[#1e40af] p-3">
          <div className="flex flex-col gap-1.5">
            <span className="h-2 w-8 rounded-full bg-white/25" />
            <span className="h-2 w-10 rounded-full bg-white/25" />
            <span className="h-2 w-6 rounded-full bg-white/25" />
          </div>
        </div>
        <div className="rounded-[9px] bg-gradient-to-b from-[#334155] to-[#475569] p-2.5">
          <div className="flex flex-col gap-1">
            <span className="h-1.5 w-6 rounded-full bg-white/25" />
            <span className="h-1.5 w-5 rounded-full bg-white/25" />
          </div>
        </div>
      </div>
    );
  }
  if (device === "air") {
    return (
      <div className="device-shadow w-[120px] rounded-[14px] bg-gradient-to-b from-sky-100 to-sky-300 p-3">
        <div className="flex flex-col gap-2">
          <span className="h-2 w-10 rounded-full bg-white/70" />
          <span className="h-2 w-8 rounded-full bg-white/70" />
          <span className="h-2 w-9 rounded-full bg-white/70" />
        </div>
      </div>
    );
  }
  if (device === "core") {
    return (
      <div className="device-shadow grid h-[96px] w-[96px] place-items-center rounded-[18px] bg-gradient-to-b from-violet-200 to-cobalt-100">
        <Flower2 className="h-10 w-10 text-violet-500" />
      </div>
    );
  }
  return (
    <div className="device-shadow flex flex-col items-center gap-2">
      <div className="rounded-[14px] bg-gradient-to-b from-emerald-200 to-emerald-400 p-3">
        <span className="block h-2 w-8 rounded-full bg-white/70" />
      </div>
      <span className="h-6 w-6 rounded-[9px] bg-emerald-500" />
    </div>
  );
}
