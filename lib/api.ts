import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { verifySession, sessionCookie, type SessionUser } from "./auth";
import { can, isStaffRole, type Permission } from "./permissions";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function fail(message: string, status = 400, errors?: Record<string, string>) {
  return NextResponse.json({ ok: false, message, errors }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return NextResponse.json(
      { ok: false, message: "তথ্যগুলো সঠিকভাবে পূরণ করুন", errors },
      { status: 422 }
    );
  }
  const raw = error instanceof Error ? error.message : String(error);
  const offline = /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up/i.test(raw);

  // Offline/DB-unreachable is an ops problem, not a code bug — log it quietly
  // and give the visitor an actionable Bangla message.
  if (offline) {
    console.warn("[api] database unreachable:", raw);
    return NextResponse.json(
      {
        ok: false,
        message: "ডেটাবেসে সংযোগ করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন অথবা আমাদের হটলাইনে কল করুন।",
        code: "DB_UNREACHABLE",
      },
      { status: 503 }
    );
  }

  // requireUser / requireStaff / requirePermission throw errors carrying a
  // status. Without this branch every guard failure became a 500, which hid the
  // real reason from the client and made the logs look like a code bug.
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) {
    return NextResponse.json(
      { ok: false, message: "এই কাজটি করতে আগে লগইন করুন", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  if (status === 403) {
    return NextResponse.json(
      { ok: false, message: "এই কাজের অনুমতি আপনার নেই", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  console.error("[api]", error);
  const message =
    process.env.NODE_ENV !== "production" ? raw : "সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন";
  return NextResponse.json({ ok: false, message }, { status: 500 });
}

/** Current logged-in user (customer or admin) from the httpOnly cookie. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(sessionCookie.name)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}

/**
 * Staff gate — staff, manager or admin. The panel is no longer admin-only: a
 * staff account may curate the catalogue. Individual screens still call
 * `requirePermission()` for the actions that matter (money, team, settings).
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || !isStaffRole(user.role)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = user ? 403 : 401;
    throw err;
  }
  return user;
}

/** Permission gate. Throws 401 when logged out, 403 when the role is too low. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (!can(user, permission)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number; permission?: string };
    err.status = 403;
    err.permission = permission;
    throw err;
  }
  return user;
}

/**
 * Strict admin gate. Kept for the handful of surfaces that are genuinely
 * admin-only (settings, destructive maintenance). Everything else uses
 * `requirePermission()` so managers and staff can do their jobs.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = user ? 403 : 401;
    throw err;
  }
  return user;
}

/* -------------------------------------------------------------- rate limiting */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Fixed-window in-memory rate limiter.
 * Good enough for a single Vercel region / small storefront. For multi-region
 * scale, swap the Map for Upstash Redis using the same signature.
 */
export function rateLimit(key: string, limit = 10, windowMs = 60_000): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/** Derive a stable client key from proxy headers. */
export function clientKey(req: Request, scope: string): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

/**
 * One-liner guard for API routes:
 *   const guard = limitGuard(req, "scope", 10, 60_000);
 *   if (guard) return guard;
 */
export function limitGuard(req: Request, scope: string, limit = 10, windowMs = 60_000) {
  const result = rateLimit(clientKey(req, scope), limit, windowMs);
  return result.ok ? null : tooMany(result.retryAfter);
}

export function tooMany(retryAfter: number) {
  return NextResponse.json(
    { ok: false, message: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/** Clean user text before storing (defence in depth — never trust client HTML). */
export function sanitizeText(input: unknown, max = 500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<\/?[^>]*>/g, "")
    .trim()
    .slice(0, max);
}
