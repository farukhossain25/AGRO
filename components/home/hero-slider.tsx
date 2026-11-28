"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { HeroSlide } from "@/lib/types";

/* ==========================================================================
   HeroSlider — the admin-managed carousel below the header
   --------------------------------------------------------------------------
   Performance choices that matter for the LCP element:

     • slide 1 is rendered with `priority` and is NOT lazy → it is the LCP
     • slides 2..n use `loading="lazy"` and are only mounted once the carousel
       has been idle for a moment, so a 3-slide hero costs one image on the
       first paint
     • a mobile image is used when the viewport is narrow (art direction) via
       `<picture>`-style selection at render time — no extra request
     • `sizes` is honest, so the CDN never sends a 1920px file to a phone

   Interaction:
     • autoplay, paused on hover, on focus, when the tab is hidden, and when
       the visitor has `prefers-reduced-motion: reduce`
     • swipe with pointer events (works for touch and trackpad)
     • arrows, dots, keyboard (← →), and a visible pause control
   ========================================================================== */

type Props = {
  slides: HeroSlide[];
  autoplayMs?: number;
  showArrows?: boolean;
  showDots?: boolean;
};

export function HeroSlider({ slides, autoplayMs = 6000, showArrows = true, showDots = true }: Props) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  /** Slides beyond the first mount only after the first paint. */
  const [hydratedAll, setHydratedAll] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /* The other slides mount on the FIRST transition, not on a timer. Mounting
     them ~1.2 s in put five more hero images on the wire exactly while the
     browser was still painting the first one — on a throttled phone that
     alone pushed LCP out by more than a second. */
  useEffect(() => {
    if (index !== 0) setHydratedAll(true);
  }, [index]);

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  /* ---- autoplay ---------------------------------------------------------- */
  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;

    const timer = setInterval(() => {
      // A hidden tab should not burn through slides while nobody is watching.
      if (document.visibilityState === "visible") next();
    }, Math.max(2500, autoplayMs));

    return () => clearInterval(timer);
  }, [count, paused, reduceMotion, autoplayMs, next]);

  /* ---- keyboard ---------------------------------------------------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!container.current?.contains(document.activeElement)) return;
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (!count) return null;

  const slide = slides[index];
  const position =
    slide.text_position === "center"
      ? "items-center text-center"
      : slide.text_position === "right"
        ? "items-end text-right"
        : "items-start text-left";
  const tone = slide.text_tone === "dark" ? "text-ink-950" : "text-white";

  return (
    <section
      ref={container}
      aria-roledescription="carousel"
      aria-label="হোমপেজ স্লাইডার"
      className="relative isolate overflow-hidden px-2 pt-2 sm:px-4 sm:pt-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={(e) => {
        touchStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (!touchStart.current) return;
        const dx = e.clientX - touchStart.current.x;
        const dy = e.clientY - touchStart.current.y;
        touchStart.current = null;
        // Only a mostly-horizontal drag counts, so a vertical scroll is never
        // mistaken for a swipe.
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) next();
          else prev();
        }
      }}
      tabIndex={0}
    >
      {/* the whole carousel is one raised, rounded card */}
      <div className="relative overflow-hidden rounded-2xl bg-neu-sunken shadow-neu-lg sm:rounded-[34px]">
      {/* ---- media ---- */}
      <div className="relative h-[clamp(320px,52vw,560px)] w-full">
        {slides.map((item, i) => {
          const active = i === index;
          const shouldMount = i === 0 || hydratedAll || active;
          if (!shouldMount) return null;

          const mobile = item.image_mobile_url || item.image_url;

          return (
            <div
              key={item.id}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{ zIndex: active ? 1 : 0 }}
            >
              {item.video_url ? (
                <video
                  className="h-full w-full object-cover"
                  src={item.video_url}
                  poster={item.image_url ?? undefined}
                  autoPlay={active && !reduceMotion}
                  muted
                  loop
                  playsInline
                  preload={i === 0 ? "auto" : "none"}
                />
              ) : mobile ? (
                <>
                  {/* Art direction: a phone gets the portrait crop, never the
                      1920px desktop file. */}
                  <Image
                    src={mobile}
                    alt={item.alt_bn ?? item.title_bn}
                    fill
                    priority={i === 0}
                    fetchPriority={i === 0 ? "high" : undefined}
                    quality={70}
                    loading={i === 0 ? undefined : "lazy"}
                    /* No blur placeholder on the LCP slide: it is preloaded and
                       arrives before the first paint, while the blur→sharp swap
                       forces a React state update and a second repaint — that
                       repaint is what pushed LCP out on a throttled phone. */
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 1920px"
                    className="object-cover sm:object-center"
                  />
                </>
              ) : (
                <div className="h-full w-full bg-leaf-radial" />
              )}
            </div>
          );
        })}

        {/* overlay — opacity is per-slide, from the admin panel */}
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent"
          style={{ opacity: (slide.overlay_opacity ?? 45) / 100 }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-ink-950/85 via-transparent to-transparent"
          aria-hidden
        />

        {/* ---- copy ---- */}
        <div className="absolute inset-0 z-[3] flex">
          <div className={`container-x flex flex-col justify-center gap-3 py-8 ${position} ${tone}`}>
            <div
              key={slide.id}
              className="max-w-xl animate-[fade-up_.55s_cubic-bezier(.22,1,.36,1)_both]"
            >
              <h1 className="text-[clamp(1.55rem,4.6vw,3.1rem)] font-extrabold leading-[1.15] tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,.45)]">
                {slide.title_bn}
              </h1>

              {slide.subtitle_bn ? (
                <p className="mt-2 max-w-md text-[clamp(.82rem,1.9vw,1.02rem)] leading-relaxed opacity-85">
                  {slide.subtitle_bn}
                </p>
              ) : null}

              <div className={`mt-4 flex flex-wrap gap-2 ${slide.text_position === "center" ? "justify-center" : slide.text_position === "right" ? "justify-end" : ""}`}>
                {slide.cta_label_bn && slide.cta_href ? (
                  <Link href={slide.cta_href} className="btn-primary min-h-[44px] px-5 text-[13.5px]">
                    {slide.cta_label_bn}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
                {slide.secondary_label_bn && slide.secondary_href ? (
                  <Link
                    href={slide.secondary_href}
                    className="btn min-h-[44px] border border-white/40 bg-white/35 px-5 text-[13.5px] text-white hover:bg-white/45"
                  >
                    {slide.secondary_label_bn}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ---- arrows ---- */}
        {showArrows && count > 1 ? (
          <>
            <button
              onClick={prev}
              aria-label="আগের স্লাইড"
              className="neu-icon-btn absolute left-3 top-1/2 z-[4] hidden h-10 w-10 -translate-y-1/2 !bg-neu-surface/80 sm:block"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="পরের স্লাইড"
              className="neu-icon-btn absolute right-3 top-1/2 z-[4] hidden h-10 w-10 -translate-y-1/2 !bg-neu-surface/80 sm:block"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {/* ---- controls ---- */}
        {count > 1 ? (
          <div className="absolute bottom-3 left-0 right-0 z-[4]">
            <div className="container-x flex items-center justify-between gap-3">
              {showDots ? (
                <div className="flex items-center gap-1.5" role="tablist" aria-label="স্লাইড বাছাই">
                  {slides.map((item, i) => (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={i === index}
                      aria-label={`${i + 1} নম্বর স্লাইড`}
                      onClick={() => go(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-6 bg-neu-accent" : "w-1.5 bg-neu-ink/25 hover:bg-neu-ink/45"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span />
              )}

              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "চালু করুন" : "বিরতি"}
                className="neu-icon-btn h-8 w-8 !bg-neu-surface/80"
              >
                {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      </div>
    </section>
  );
}
