"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { SectionHeader, StarRating } from "@/components/ui";
import { ReviewForm } from "@/components/review-form";
import type { Review } from "@/lib/types";

export function Testimonials({ reviews }: { reviews: Review[] }) {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIndex((i) => (i + 1) % Math.max(1, reviews.length)), [reviews.length]);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + reviews.length) % Math.max(1, reviews.length)),
    [reviews.length]
  );

  useEffect(() => {
    if (paused || reviews.length < 2) return;
    const id = window.setInterval(next, 6000);
    return () => window.clearInterval(id);
  }, [next, paused, reviews.length]);

  if (!reviews.length) return null;
  const current = reviews[index];

  return (
    <section className="section container-x" aria-labelledby="reviews-heading">
      <SectionHeader
        eyebrow="গ্রাহকের মতামত"
        align="center"
        title={<span id="reviews-heading">যে কথা আমাদের গ্রাহকেরা বলেন</span>}
        subtitle="২,৪০০+ পরিবারের ভালোবাসা — এবং কিছু সৎ মতামত।"
      />

      <div
        className="relative mx-auto max-w-3xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-roledescription="carousel"
      >
        <div className="card relative overflow-hidden p-7 sm:p-10">
          <Quote className="absolute -right-2 -top-2 h-24 w-24 text-leaf-600/10" aria-hidden />
          <div key={current.id} className="animate-fade-in">
            <StarRating value={current.rating} size={16} />
            <blockquote className="mt-4 text-[15.5px] leading-[1.9] text-sand-100/85 sm:text-[17px]">
              “{current.comment}”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-600/25 text-sm font-bold text-leaf-700">
                {current.name_bn.slice(0, 1)}
              </span>
              <div>
                <p className="text-[13.5px] font-semibold">{current.name_bn}</p>
                <p className="text-[11.5px] text-sand-100/45">{current.location_bn}</p>
              </div>
            </figcaption>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={prev} className="btn-ghost !h-9 !w-9 !rounded-full !p-0" aria-label={t("আগের মতামত", "Previous review")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {reviews.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-leaf-400" : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
          <button onClick={next} className="btn-ghost !h-9 !w-9 !rounded-full !p-0" aria-label={t("পরের মতামত", "Next review")}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <ReviewForm productId={null} />
      </div>
    </section>
  );
}
