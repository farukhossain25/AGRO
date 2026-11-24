/* ==========================================================================
   lib/store-info-model.ts — the storefront's contact block, pure data
   --------------------------------------------------------------------------
   Client-safe on purpose: no db(), no Supabase, no server-only env. Both the
   server reader (lib/site-settings.ts) and the client provider
   (lib/store-info.tsx) import from here, so the one definition of "what the
   customer can read about the shop" never drifts between the two bundles.

   These are the numbers that used to live only in lib/site.ts — the owner had
   to deploy new code to change a phone number, and the panel's "store" row was
   written by the form but never read by the site.
   ========================================================================== */

export type StoreSettings = {
  name: string;
  name_en: string;
  email: string;
  /** E.164-ish, used for tel: links. */
  phone: string;
  /** What the customer reads — Bangla digits, grouped. */
  phone_display: string;
  /** Digits only, for wa.me links. */
  whatsapp: string;
  address_bn: string;
  address_en: string;
  hours_bn: string;
  hours_en: string;
  /** Google Maps embed URL. */
  map_embed: string;
};

/** Mirrors lib/site.ts exactly, so an untouched install renders as before. */
export const defaultStoreSettings: StoreSettings = {
  name: "বিশ্বাস এগ্রো",
  name_en: "Biswas Agro",
  email: "hello@bishwasagro.com",
  phone: "+8801700000000",
  phone_display: "০১৭০০-০০০০০০",
  whatsapp: "8801700000000",
  address_bn: "হাউজ ১২, রোড ৭, ধানমন্ডি, ঢাকা ১২০৯, বাংলাদেশ",
  address_en: "House 12, Road 7, Dhanmondi, Dhaka 1209, Bangladesh",
  hours_bn: "প্রতিদিন সকাল ৭টা — রাত ১০টা",
  hours_en: "Every day, 7 am — 10 pm",
  map_embed: "https://www.google.com/maps?q=Dhanmondi%2C%20Dhaka%2C%20Bangladesh&output=embed",
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** `+880 1700-000000` → `০১৭০০-০০০০০০` (last 10 digits, Bangla numerals). */
export function prettyPhoneBn(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length < 7) return "";
  const grouped = local.length === 10 ? `${local.slice(0, 4)}-${local.slice(4)}` : local;
  return grouped.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/** A pasted "+880 1700-000000" still has to become a working `tel:` target. */
export function normalizePhone(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text.replace(/[^\d+]/g, "") || fallback;
}

/** wa.me wants digits only. */
export function normalizeWhatsapp(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return text || fallback;
}

export function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
