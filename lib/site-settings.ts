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
    const { data } = await db().from("settings").select("value").eq("key", key).maybeSingle();
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
