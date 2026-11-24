import type { UserRole } from "./types";

/* ==========================================================================
   lib/session.ts — the shape of "who is signed in"
   --------------------------------------------------------------------------
   Derived from the Supabase session + the caller's own `profiles` row. There
   is no app-minted JWT any more: the id is the Supabase auth user id, which is
   also `profiles.id`. Anything that needs a role reads it from the database,
   never from a token.
   ========================================================================== */

export type SessionUser = {
  /** auth.users.id === profiles.id */
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  /** profiles.is_seller — has a seller application (any status). Drives the
   *  "সেলার ড্যাশবোর্ড" entry in the header menu. */
  isSeller?: boolean;
};

const ROLES: readonly UserRole[] = ["customer", "premium", "seller", "staff", "manager", "admin"];

/** Fail closed: an unknown/absent role is a plain customer. */
export function normalizeRole(value: unknown): UserRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as UserRole)
    : "customer";
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

/**
 * Only same-site, path-shaped redirects are allowed (`/account`, `/checkout`).
 * `//evil.com`, `https://evil.com`, `/\evil.com` and control characters are all
 * rejected — this closes the open-redirect hole in `?next=`.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  const next = value.trim();
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  // never bounce straight back into another auth screen
  if (/^\/(login|reset-password|auth)(\/|$)/.test(next)) return fallback;
  return next;
}
