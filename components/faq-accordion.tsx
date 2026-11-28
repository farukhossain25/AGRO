"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="card divide-y divide-neu-line/50 overflow-hidden !rounded-xl p-1.5">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 rounded-2xl px-3.5 py-3.5 text-left transition hover:bg-white/60"
            >
              <span className="flex-1 text-[13.5px] font-semibold leading-snug text-neu-ink">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-leaf-300 transition ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {isOpen ? (
              <div className="animate-fade-in px-3.5 pb-4 text-[12.5px] leading-7 text-neu-muted">{item.a}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
