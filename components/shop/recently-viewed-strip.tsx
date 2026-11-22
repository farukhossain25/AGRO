"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { money } from "@/lib/format";
import { readRecentlyFull, type RecentItem } from "./track-view";

/** Client-only strip for pages that don't already have server data. */
export function RecentlyViewedStrip({ title = "সম্প্রতি দেখা পণ্য" }: { title?: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(readRecentlyFull().slice(0, 8));
  }, []);

  if (!items.length) return null;

  return (
    <section aria-labelledby="recent-strip">
      <h2 id="recent-strip" className="mb-3 flex items-center gap-2 text-[15px] font-bold">
        <Clock className="h-4 w-4 text-leaf-300" />
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.slug}`}
            className="group w-[140px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850/60 transition hover:border-leaf-500/40"
          >
            <div className="relative aspect-square bg-ink-800">
              {p.image ? (
                <Image
                  src={p.image}
                  alt={p.name_bn}
                  fill
                  sizes="140px"
                  className="object-cover transition group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <span className="grid h-full place-items-center text-2xl">🥬</span>
              )}
            </div>
            <div className="p-2">
              <p className="line-clamp-2 text-[11.5px] font-medium leading-snug">{p.name_bn}</p>
              <p className="mt-1 text-[12px] font-bold text-leaf-200">{money(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
