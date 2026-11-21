"use client";

import { useEffect } from "react";

/* ==========================================================================
   TrackView — records a product view for "Recently viewed" (section E)
   --------------------------------------------------------------------------
   Sends one request per product page:
     • signed-in → POST /api/recently-viewed (DB, cross-device)
     • guest     → localStorage list (max 12)
   Renders nothing.
   ========================================================================== */

const KEY = "ba_recent";
const MAX = 12;

export type RecentItem = {
  id: string;
  slug: string;
  name_bn: string;
  name_en?: string | null;
  price: number;
  compare_price?: number | null;
  image: string | null;
  unit?: string;
  stock?: number;
  rating?: number;
  review_count?: number;
};

export function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = readRecent().filter((slug) => slug !== item.slug);
    const next = [item.slug, ...current].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));

    // keep the full objects so the strip can render without a fetch
    const bag = readRecentlyFull().filter((p) => p.slug !== item.slug);
    window.localStorage.setItem(`${KEY}_full`, JSON.stringify([item, ...bag].slice(0, MAX)));
  } catch {
    /* private mode */
  }
}

export function readRecentlyFull(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${KEY}_full`);
    const parsed = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TrackView({
  productId,
  item,
}: {
  productId: string;
  /** pass the product so guests can render the strip without a round-trip */
  item?: RecentItem;
}) {
  useEffect(() => {
    if (item) pushRecent(item);

    // Signed-in users get the server copy too (fire-and-forget).
    const controller = new AbortController();
    fetch("/api/recently-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
      signal: controller.signal,
    }).catch(() => undefined);

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  return null;
}
