import { cache } from "react";
import { db } from "./db";

/* ==========================================================================
   lib/site-settings.ts — the runtime side of /foisal/settings
   --------------------------------------------------------------------------
   `settings` rows are small JSON objects. Each reader below owns one row, merges
   it over a hard-coded default, and caches the result for the duration of a
   request. A missing row, an unreachable database or a half-typed value all
   fall back to the default rather than throwing — a settings screen must never
   be able to take the storefront down.

   Cached with React's `cache()` (per request, not per process) so a page that
   reads delivery rules in three places still issues one query, and an owner
   who saves a change sees it on the next render rather than after a restart.
   ========================================================================== */

/** Anything that arrives from JSON might be a string — coerce, don't trust. */
function num(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

async function readRow(key: string): Promise<Record<string, unknown>> {
  try {
    const { data } = await db().from("site_settings").select("value").eq("key", key).maybeSingle();
    return (data?.value ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------- delivery */

export type DeliverySettings = {
  /** Delivery inside Dhaka metro thanas. */
  inside_dhaka: number;
  /** Everywhere else. */
  outside_dhaka: number;
  /** Subtotal at or above this ships free. */
  free_over: number;
};

export const defaultDeliverySettings: DeliverySettings = {
  inside_dhaka: 60,
  outside_dhaka: 120,
  free_over: 1200,
};

/**
 * Delivery numbers from `settings.delivery`.
 *
 * `delivery_zones` still exists and still wins for a *named* district — a zone
 * row is a per-place override. These three values are the fallback that used to
 * be hard-coded (60 / 120 / 1200) and are what the owner edits in the panel.
 */
export const getDeliverySettings = cache(async (): Promise<DeliverySettings> => {
  const row = await readRow("delivery");
  return {
    inside_dhaka: num(row.inside_dhaka, defaultDeliverySettings.inside_dhaka),
    outside_dhaka: num(row.outside_dhaka, defaultDeliverySettings.outside_dhaka),
    free_over: num(row.free_over, defaultDeliverySettings.free_over),
  };
});

/* --------------------------------------------------------- store profile */

export type StoreSettings = {
  name: string;
  email: string;
  phone: string;
};

export const defaultStoreSettings: StoreSettings = {
  name: "বিশ্বাস এগ্রো",
  email: "hello@bishwasagro.com",
  phone: "+8801700000000",
};

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const row = await readRow("store");
  const str = (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;
  return {
    name: str(row.name, defaultStoreSettings.name),
    email: str(row.email, defaultStoreSettings.email),
    phone: str(row.phone, defaultStoreSettings.phone),
  };
});

/* --------------------------------------------------------------- seller */

export type SellerSettings = {
  auto_approve: boolean;
  default_commission_percent: number;
};

export const getSellerSettings = cache(async (): Promise<SellerSettings> => {
  const row = await readRow("seller");
  return {
    auto_approve: bool(row.auto_approve, false),
    default_commission_percent: num(row.default_commission_percent, 10),
  };
});

/* -------------------------------------------------------------- reviews */

export type ReviewSettings = {
  auto_publish: boolean;
  max_photos: number;
  edit_window_days: number;
  low_rating_threshold: number;
};

export const getReviewSettings = cache(async (): Promise<ReviewSettings> => {
  const row = await readRow("reviews");
  return {
    auto_publish: bool(row.auto_publish, true),
    max_photos: num(row.max_photos, 3),
    edit_window_days: num(row.edit_window_days, 7),
    low_rating_threshold: num(row.low_rating_threshold, 2),
  };
});

/* ------------------------------------------------------- announcement bar */
/**
 * The scrolling marquee above the header.
 *
 * One row (`settings.announcement`) holds every knob: whether the bar shows at
 * all, the messages in both languages, how long one loop takes and an optional
 * call-to-action link. Everything is optional — an empty message list means
 * "hide the bar", so an owner who clears the text never sees a stray strip.
 */
export type AnnouncementSettings = {
  enabled: boolean;
  messages_bn: string[];
  messages_en: string[];
  /** Seconds for one full loop. Bigger = slower. */
  speed: number;
  /** Optional CTA, e.g. "/products?sort=newest" + "নতুন পণ্য দেখুন". */
  link_url: string;
  link_label_bn: string;
  link_label_en: string;
  /** Hide on phones when the owner wants a calmer small screen. */
  show_mobile: boolean;
};

function textList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  // An explicitly emptied list is a decision: keep it empty.
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export const defaultAnnouncementSettings: AnnouncementSettings = {
  enabled: true,
  messages_bn: [
    "খামার থেকে সরাসরি আপনার পরিবারের খাবার টেবিলে",
    "সারা বাংলাদেশে ডেলিভারি · ঢাকায় ২৪ ঘণ্টায় পৌঁছে যাবে",
    "৳১২০০+ অর্ডারে ডেলিভারি ফ্রি",
  ],
  messages_en: [
    "Straight from the farm to your family table",
    "Nationwide delivery · 24-hour delivery inside Dhaka",
    "Free delivery on orders over ৳1200",
  ],
  speed: 38,
  link_url: "",
  link_label_bn: "",
  link_label_en: "",
  show_mobile: true,
};

export const getAnnouncementSettings = cache(async (): Promise<AnnouncementSettings> => {
  const row = await readRow("announcement");
  const d = defaultAnnouncementSettings;
  return {
    enabled: bool(row.enabled, d.enabled),
    messages_bn: textList(row.messages_bn, d.messages_bn),
    messages_en: textList(row.messages_en, d.messages_en),
    speed: Math.min(120, Math.max(8, num(row.speed, d.speed) || d.speed)),
    link_url: str(row.link_url, d.link_url),
    link_label_bn: str(row.link_label_bn, d.link_label_bn),
    link_label_en: str(row.link_label_en, d.link_label_en),
    show_mobile: bool(row.show_mobile, d.show_mobile),
  };
});
