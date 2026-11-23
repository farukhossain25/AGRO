/**
 * Human-readable Bangla messages for the errors Supabase/Postgres actually
 * return.
 *
 * Why: `handleError()` used to replace every production failure with
 * "সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন". The owner saw "edit/add কাজ করে
 * না" while the real reason (missing GRANT, missing column, missing bucket)
 * only ever lived in a log nobody read. Every branch below names the broken
 * piece of infrastructure in Bangla, and the caller logs the raw error.
 */

type Mapped = { message: string; code: string; status: number };

/** Postgres/PostgREST error shapes we care about. */
type DbError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

export function dbErrorMessage(error: DbError | null | undefined): Mapped | null {
  const raw = String(error?.message ?? "");
  const code = String(error?.code ?? "");
  if (!raw && !code) return null;

  /* --- privileges: the class of bug that made the whole panel read-only --- */
  if (code === "42501" || /permission denied/i.test(raw)) {
    return {
      message:
        "ডেটাবেসে এই টেবিলে লেখার অনুমতি নেই (GRANT)। মালিককে জানান — /foisal/system-check পেজে বিস্তারিত দেখুন।",
      code: "DB_PERMISSION",
      status: 500,
    };
  }

  /* --- a column the code writes does not exist in the live table --- */
  if (
    code === "42703" ||
    code === "PGRST204" ||
    /column .* does not exist/i.test(raw) ||
    /could not find the '.*' column/i.test(raw)
  ) {
    const col = /'([^']+)' column/i.exec(raw)?.[1] ?? /column "([^"]+)"/.exec(raw)?.[1];
    return {
      message: col
        ? `ডেটাবেসে "${col}" কলামটি নেই — স্কিমা মিলছে না। /foisal/system-check দেখুন।`
        : "ডেটাবেসের কলাম মিলছে না — স্কিমা আপডেট দরকার। /foisal/system-check দেখুন।",
      code: "DB_COLUMN",
      status: 500,
    };
  }

  /* --- NOT NULL with no value --- */
  const nullCol = /null value in column "([^"]+)"/.exec(raw)?.[1];
  if (code === "23502" || nullCol) {
    return {
      message: nullCol
        ? `"${nullCol}" ঘরটি খালি রাখা যাবে না — মান দিন।`
        : "কিছু তথ্য খালি আছে, সব ঘর পূরণ করুন।",
      code: "DB_NOT_NULL",
      status: 422,
    };
  }

  /* --- duplicate key / unique violation --- */
  if (code === "23505" || /duplicate key value/i.test(raw)) {
    const field = /Key \(([^)]+)\)/.exec(raw)?.[1];
    return {
      message: field
        ? `এই ${field} আগেই ব্যবহার করা হয়েছে — অন্য একটি দিন।`
        : "একই তথ্য আগেই আছে — আলাদা মান দিন (যেমন slug বা কোড)।",
      code: "DB_DUPLICATE",
      status: 409,
    };
  }

  /* --- foreign key: something points at a row that is gone --- */
  if (code === "23503" || /violates foreign key/i.test(raw)) {
    return {
      message: "সম্পর্কিত রেকর্ড পাওয়া যায়নি (যেমন ক্যাটাগরি বা অর্ডার মুছে গেছে) — আবার বাছাই করুন।",
      code: "DB_FK",
      status: 422,
    };
  }

  /* --- check constraint: enum-ish columns --- */
  if (code === "23514" || /violates check constraint/i.test(raw)) {
    const name = /constraint "([^"]+)"/.exec(raw)?.[1];
    return {
      message: name
        ? `মানটি অনুমোদিত নয় (${name}) — অন্য মান বেছে নিন।`
        : "মানটি অনুমোদিত নয় — অন্য মান বেছে নিন।",
      code: "DB_CHECK",
      status: 422,
    };
  }

  /* --- storage --- */
  if (/bucket not found/i.test(raw)) {
    return {
      message: "স্টোরেজ বাকেট পাওয়া যায়নি — ছবি আপলোড বন্ধ আছে। /foisal/system-check দেখুন।",
      code: "STORAGE_BUCKET",
      status: 500,
    };
  }
  if (/exceeded the maximum allowed size/i.test(raw) || /payload too large/i.test(raw)) {
    return { message: "ফাইলটি অনেক বড় — ৫ MB এর নিচে ছবি দিন।", code: "STORAGE_SIZE", status: 413 };
  }
  if (/mime|content type|not supported/i.test(raw) && /image|file/i.test(raw)) {
    return { message: "ফাইলের ধরন সমর্থিত নয় — JPG, PNG বা WebP দিন।", code: "STORAGE_MIME", status: 415 };
  }

  return null;
}

/** Any error → { message (Bangla), status }. Unknown errors stay anonymous. */
export function describeError(error: unknown): { message: string; status: number; code?: string } {
  const e = error as DbError & Error & { status?: number; code?: string };
  const mapped = dbErrorMessage(e);
  if (mapped) return mapped;

  if (typeof e?.status === "number" && e.status >= 400 && e.status < 600) {
    return { message: e.message || "অনুরোধটি সম্পন্ন হয়নি", status: e.status, code: e.code };
  }
  return {
    message: "সার্ভারে সমস্যা হয়েছে — আবার চেষ্টা করুন। বিস্তারিত সার্ভার লগে আছে।",
    status: 500,
    code: e?.code,
  };
}
