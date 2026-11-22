"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Heart } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { money } from "@/lib/format";
import { readRecentlyFull, pushRecent, type RecentItem } from "./track-view";

/* ==========================================================================
   RecentlyViewed — "সম্প্রতি দেখা পণ্য" (section E)
   --------------------------------------------------------------------------
   Guests: read from localStorage (written by TrackView).
   Signed-in: the server list wins so it follows the user across devices.
   Also renders a compact wishlist toggle on each card.
   ========================================================================== */

export function RecentlyViewed({
  excludeId,
  currentProduct,
}: {
  excludeId?: string;
  currentProduct?: RecentItem;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // guests: local list (seeded with the product we're on right now)
      const local = readRecentlyFull().filter((p) => p.id !== excludeId);

      setItems(local.slice(0, 8));

      // signed-in: upgrade to the server list
      try {
        const res = await fetch("/api/recently-viewed", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const server = (json?.data?.items ?? []) as RecentItem[];
        if (cancelled || !Array.isArray(server) || !server.length) return;

        const filtered = server.filter((p) => p.id !== excludeId);
        setItems(filtered.slice(0, 8));

        // mirror into localStorage so the guest view stays warm
        for (const p of filtered.slice(0, 8)) pushRecent(p);
      } catch {
        /* offline → keep the local list */
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [excludeId, currentProduct]);

  if (items.length < 2) return null;

  return (
    <section className="mt-12" aria-labelledby="recent-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="recent-heading" className="flex items-center gap-2 text-[15px] font-bold">
          <Clock className="h-4 w-4 text-leaf-300" />
          {t("সম্প্রতি দেখা পণ্য", "Recently viewed")}
        </h2>
        <Link href="/account/wishlist" className="text-[11.5px] text-leaf-300 hover:underline">
          {t("পছন্দের তালিকা", "Wishlist")} →
        </Link>
      </div>

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

/* ------------------------------------------------------- wishlist toggle */
export function WishlistButton({
  productId,
  initial = false,
  compact = false,
}: {
  productId: string;
  initial?: boolean;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    const optimistic = !saved;
    setSaved(optimistic);

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (res.status === 401) {
        setSaved(!optimistic);
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message);
      setSaved(Boolean(json?.data?.saved));
    } catch {
      setSaved(!optimistic);
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label={t("পছন্দের তালিকায় যোগ", "Toggle wishlist")}
        aria-pressed={saved}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
      >
        <Heart className={`h-3.5 w-3.5 ${saved ? "fill-red-400 text-red-400" : ""}`} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={saved}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition ${
        saved
          ? "border-red-400/40 bg-red-500/10 text-red-200"
          : "border-white/15 text-sand-100/70 hover:border-white/30"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${saved ? "fill-red-400 text-red-400" : ""}`} />
      {saved ? t("সংরক্ষিত", "Saved") : t("পছন্দের তালিকা", "Wishlist")}
    </button>
  );
}
