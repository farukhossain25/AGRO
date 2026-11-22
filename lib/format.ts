export const BDT = "৳";

const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Convert ASCII digits in a string to Bangla numerals. */
export function toBn(value: string | number): string {
  return String(value).replace(/\d/g, (d) => bnDigits[Number(d)]);
}

/** Convert Bangla numerals back to ASCII (for parsing user input). */
export function toEn(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
}

/** 1250 → "১,২৫০" */
export function bnNumber(value: number, fractionDigits = 0): string {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return toBn(formatted);
}

/** 1250 → "৳১,২৫০" (Bangla mode) */
export function money(value: number | string | null | undefined, bangla = true): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  const safe = Number.isFinite(n) ? n : 0;
  const hasFraction = safe % 1 !== 0;
  return `${BDT}${bangla ? bnNumber(safe, hasFraction ? 2 : 0) : safe.toLocaleString("en-US")}`;
}

export function formatDateBn(value: string | Date | null | undefined, bangla = true): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(bangla ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeBn(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function relativeDaysBn(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  const diff = Math.floor((Date.now() - then) / 86_400_000);
  if (diff <= 0) return "আজ";
  if (diff === 1) return "গতকাল";
  return `${toBn(diff)} দিন আগে`;
}

/** Sanitise a string for safe file/slug usage. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function orderNumber(): string {
  const stamp = Date.now().toString().slice(-7);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `BA${stamp}${rand}`;
}

export function subNumber(): string {
  const stamp = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `BASUB${stamp}${rand}`;
}

/** Percentage discount rounded to integer. */
export function discountPercent(price: number, compare?: number | null): number {
  if (!compare || compare <= price) return 0;
  return Math.round(((compare - price) / compare) * 100);
}
