"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { SectionHeader } from "@/components/ui";

/* ==========================================================================
   WhyChooseUs — "পাঁচটি কারণ, যেগুলো আমাদের আলাদা করে"
   --------------------------------------------------------------------------
   Five cards stacked in a grid is a wall of equal-weight text: a visitor reads
   the first one and skips the rest, so four good reasons are wasted.

   Instead: ONE reason is open (a real card with its body copy), and the other
   four sit beneath it as one-line rows that expand on tap — an accordion where
   the "open" card is simply the one whose row is expanded. Same content, a
   fifth of the height, and the reason the owner wants to lead with is always
   the one on screen.

   The summary row stays visible when open (only the body collapses), so a user
   can move between reasons without scrolling back up to find the header.
   ========================================================================== */

type Item = { icon: string; titleBn: string; titleEn: string; bodyBn: string; bodyEn: string };

export function WhyChooseUs({ items }: { items: Item[] }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(0);

  if (!items.length) return null;

  return (
    <section className="section container-x" aria-labelledby="why-heading">
      <SectionHeader
        eyebrow="কেন বিশ্বাস এগ্রো"
        align="center"
        title={<span id="why-heading">পাঁচটি কারণ, যেগুলো আমাদের আলাদা করে</span>}
        subtitle="আমরা শুধু পণ্য বিক্রি করি না — প্রতিটি খাবারের পেছনের কৃষক, মাঠ ও প্রক্রিয়ার দায়িত্ব নিই।"
      />

      <div className="mx-auto max-w-3xl">
        {items.map((item, i) => {
          const isOpen = i === open;
          const panelId = `why-panel-${i}`;
          const buttonId = `why-button-${i}`;

          return (
            <article
              key={item.titleBn}
              className={`overflow-hidden rounded-2xl border transition-colors ${
                isOpen
                  ? "border-neu-accent/30 bg-neu-raised shadow-sm"
                  : "border-neu-line/50 bg-neu-surface/40"
              } ${i > 0 ? "mt-2" : ""}`}
            >
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base transition-colors ${
                      isOpen ? "bg-leaf-600/20" : "bg-neu-sunken/60"
                    }`}
                    aria-hidden
                  >
                    {item.icon}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[14.5px] font-semibold ${
                        isOpen ? "text-neu-ink" : "text-neu-ink/75"
                      }`}
                    >
                      {t(item.titleBn, item.titleEn)}
                    </span>
                    {/* When closed, a one-line teaser tells the reader what is
                        behind the row — otherwise four collapsed rows look
                        like a table of contents with nothing to read. */}
                    {!isOpen && (
                      <span className="mt-0.5 block truncate text-[12px] text-neu-muted/70">
                        {t(item.bodyBn, item.bodyEn)}
                      </span>
                    )}
                  </span>

                  <ChevronDown
                    aria-hidden
                    className={`h-4 w-4 shrink-0 text-neu-faint transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-neu-accent-strong" : ""
                    }`}
                  />
                </button>
              </h3>

              {/* grid-rows trick: animates height without measuring anything and
                  without a layout jump — the same mechanism the footer uses */}
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 pl-16 text-[13px] leading-relaxed text-neu-muted sm:pr-10">
                    {t(item.bodyBn, item.bodyEn)}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
