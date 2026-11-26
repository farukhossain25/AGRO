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

/**
 * `+880 1700-000000` → `০১৭০০-০০০০০০`, i.e. the number exactly as it is dialled
 * inside Bangladesh, in Bangla numerals.
 *
 * The leading ০ matters. A stored number is international (`+8801712…`), so
 * the last ten digits are `1712345678`; printing those directly produced
 * `১৭১২-৩৪৫৬৭৮`, which is missing the trunk 0 that every Bangladeshi number
 * starts with. That is the number customers read off the site and type into a
 * phone — it has to be the one that actually connects.
 *
 * A number that is already local (`01712345678`) is left alone: it starts with
 * 0, so the trunk prefix is only added when it is missing.
 */
export function prettyPhoneBn(raw: string): string {
  /* Bangla numerals first: `\d` in JS is ASCII-only, so a maintainer pasting
     `০১৭০০-০০০০০০` into the display field used to produce an empty string and
     the site fell back to the default number. */
  const digits = String(raw ?? "")
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/\D/g, "");

  /* Strip the country code. `8801712345678` and `+8801712345678` both become
     `1712345678`; a local `01712345678` is already in the right shape. */
  let local = digits;
  if (local.startsWith("880") && local.length > 10) local = local.slice(-10);
  else if (local.length > 11) local = local.slice(-11);

  if (local.length < 7) return "";

  /* Add the trunk 0 back when the stored form is the 10-digit subscriber
     number. Without this the printed number is one digit short. */
  if (local.length === 10 && !local.startsWith("0")) local = `0${local}`;

  const grouped =
    local.length === 11 ? `${local.slice(0, 5)}-${local.slice(5)}` : local;
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
