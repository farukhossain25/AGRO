import { db, isDbConfigured } from "./db";

/* ==========================================================================
   Login attempt tracking
   --------------------------------------------------------------------------
   The in-memory limiter in lib/api.ts is per-serverless-instance, so on Vercel
   an attacker gets `limit × instance_count` attempts. This uses the
   login_attempts table (0004) for durable, cross-instance brute-force defence.
   ========================================================================== */

export type AttemptScope = "admin-login" | "login" | "register" | "reset" | "mfa";

const WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_FAILURES = 5;

/** True when this identifier is currently locked out. */
export async function isLockedOut(identifier: string, scope: AttemptScope = "login"): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const { count } = await db()
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier.toLowerCase())
      .eq("scope", scope)
      .eq("ok", false)
      .gte("created_at", since);
    return (count ?? 0) >= MAX_FAILURES;
  } catch {
    // Never block login because the ledger is unreachable.
    return false;
  }
}

export async function recordAttempt(opts: {
  identifier: string;
  scope: AttemptScope;
  ok: boolean;
  ip?: string | null;
}): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await db().from("login_attempts").insert({
      identifier: opts.identifier.toLowerCase().slice(0, 200),
      scope: opts.scope,
      ok: opts.ok,
      ip: opts.ip?.slice(0, 60) ?? null,
    });
  } catch {
    /* best-effort */
  }
}

/** Remaining attempts before lockout (for a friendly "আর ২ বার বাকি" hint). */
export async function remainingAttempts(identifier: string, scope: AttemptScope = "login"): Promise<number> {
  if (!isDbConfigured()) return MAX_FAILURES;
  try {
    const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const { count } = await db()
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier.toLowerCase())
      .eq("scope", scope)
      .eq("ok", false)
      .gte("created_at", since);
    return Math.max(0, MAX_FAILURES - (count ?? 0));
  } catch {
    return MAX_FAILURES;
  }
}

export function clientIp(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    null
  );
}

/** Translate Supabase/Gotrue errors into actionable Bangla. */
export function authErrorBn(message: string | undefined, status?: number): string {
  const m = (message ?? "").toLowerCase();

  if (m.includes("invalid login credentials")) return "ইমেইল বা পাসওয়ার্ড সঠিক নয়";
  if (m.includes("email not confirmed")) return "ইমেইল এখনো যাচাই হয়নি — ইনবক্সে পাঠানো লিঙ্কে ক্লিক করুন";
  if (m.includes("user already registered")) return "এই ইমেইলে আগেই অ্যাকাউন্ট আছে — লগইন করুন";
  if (m.includes("password should be at least")) return "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে";
  if (m.includes("rate limit") || m.includes("too many")) return "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পর আবার দিন";
  if (m.includes("invalid email")) return "ইমেইল ঠিকানাটি সঠিক নয়";
  if (m.includes("user not found")) return "এই ইমেইলে কোনো অ্যাকাউন্ট নেই";
  if (m.includes("same password")) return "নতুন পাসওয়ার্ড আগেরটির মতো হতে পারবে না";
  if (m.includes("signups not allowed")) return "নতুন নিবন্ধন বন্ধ আছে — যোগাযোগ করুন";
  if (m.includes("email provider is disabled")) return "ইমেইল লগইন চালু নেই — Google দিয়ে চেষ্টা করুন";

  if (status === 429) return "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পর আবার দিন";
  if (status === 0 || m.includes("fetch failed")) {
    return "অথ সার্ভারে সংযোগ করা যাচ্ছে না — ইন্টারনেট ও Supabase কনফিগারেশন দেখুন";
  }

  return message?.slice(0, 180) || "লগইন করা যাচ্ছে না";
}
