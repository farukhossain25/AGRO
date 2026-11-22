"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-850/60">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
            >
              <span className="text-[13.5px] font-semibold leading-snug">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-leaf-300 transition ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {isOpen ? (
              <div className="animate-fade-in px-4 pb-4 text-[12.5px] leading-7 text-sand-100/65">{item.a}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
