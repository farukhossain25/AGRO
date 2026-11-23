"use client";

import { useEffect, useRef, useState } from "react";
import { Quote, Star } from "lucide-react";

/* ==========================================================================
   AuthShowcase — the living part of the /login brand panel
   --------------------------------------------------------------------------
   Two small pieces of motion that pure CSS cannot do:

     • AuthStats  — numbers count up once, when the panel scrolls into view
     • AuthQuote  — one customer sentence every 7s, cross-faded

   Both are decoration: the server renders the final values, so a visitor with
   JavaScript disabled (or reduced motion) still sees the real numbers and the
   first quote.
   ========================================================================== */

const STATS = [
  { value: 12400, suffix: "+", label: "পরিবার নিয়মিত" },
  { value: 47, suffix: "", label: "নিজস্ব খামার" },
  { value: 24, suffix: " ঘণ্টা", label: "ঢাকায় ডেলিভারি" },
] as const;

function formatBn(value: number) {
  return new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(value);
}

export function AuthStats() {
  /* starts at 0 so the SSR markup never paints the final number first — the
     block is still fading in (.auth-rise), so nobody sees the zeros */
  const [progress, setProgress] = useState(0);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const duration = 1100;

      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        // easeOutCubic keeps the last digits from feeling mechanical
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(host);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="grid grid-cols-3 gap-3">
      {STATS.map((stat, i) => (
        <div
          key={stat.label}
          className="auth-rise rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 backdrop-blur-md"
          style={{ ["--d" as string]: `${220 + i * 90}ms` }}
        >
          <p className="text-[15px] font-bold leading-none text-white tabular-nums">
            {formatBn(Math.round(stat.value * progress))}
            <span className="text-[11px] font-medium text-leaf-300">{stat.suffix}</span>
          </p>
          <p className="mt-1 text-[10.5px] leading-tight text-sand-100/50">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

const QUOTES = [
  { body: "সকালে তোলা শাক সন্ধ্যায় হাতে পেয়েছি — বাজারের চেয়ে অনেক তাজা।", name: "নুসরাত জাহান", place: "ধানমন্ডি, ঢাকা" },
  { body: "লাইভ ক্যামেরায় খামার দেখে অর্ডার করি, তাই আস্থা তৈরি হয়েছে।", name: "মাহবুব হাসান", place: "উত্তরা, ঢাকা" },
  { body: "তেল ও ঘি একদম খাঁটি, তিন মাস ধরে প্রতি মাসে নিচ্ছি।", name: "সাবরিনা আক্তার", place: "চট্টগ্রাম" },
] as const;

export function AuthQuote() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // no auto-rotation for visitors who asked for less motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % QUOTES.length), 7000);
    return () => clearInterval(timer);
  }, []);

  const quote = QUOTES[index];

  return (
    <figure className="auth-rise rounded-2xl border border-white/10 bg-black/25 p-3.5 backdrop-blur-md" style={{ ["--d" as string]: "520ms" }}>
      <div className="flex items-center gap-1 text-leaf-300" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-3 w-3 fill-current" />
        ))}
      </div>
      <div key={index} className="auth-enter mt-2">
        <blockquote className="flex gap-1.5 text-[12px] leading-relaxed text-sand-100/80">
          <Quote className="mt-0.5 h-3 w-3 shrink-0 text-leaf-400/70" aria-hidden />
          <span>{quote.body}</span>
        </blockquote>
        <figcaption className="mt-2 text-[10.5px] text-sand-100/45">
          <span className="font-semibold text-sand-100/70">{quote.name}</span> · {quote.place}
        </figcaption>
      </div>
    </figure>
  );
}
