import { db, isDbConfigured } from "./db";
import { normalizeRole } from "./session";
import type { UserRole } from "./types";

/* ==========================================================================
   Profiles — the app-level record of a signed-in person
   --------------------------------------------------------------------------
   `profiles.id` IS `auth.users.id`. There is no second identity table and no
   "legacy user" indirection any more: orders, addresses, wishlists and reviews
   all key off the Supabase auth user id, so the session, the profile row and
   every foreign key agree by construction.

   These helpers run server-side with the service key. They never decide who
   the caller is — callers must have already resolved the session through
   lib/supabase/server.ts.
   ========================================================================== */

export type ProfileRole = UserRole;

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: ProfileRole;
  language: "bn" | "en";
  theme: "dark" | "light";
  notifications: { email: boolean; push: boolean; sms: boolean };
  created_at: string;
  updated_at: string;
};

const DEFAULT_NOTIFICATIONS = { email: true, push: true, sms: false };

function shapeProfile(row: Record<string, unknown>): Profile {
  const rawNotif =
    (row.notifications as Record<string, unknown> | undefined) ??
    (row.notification_preferences as Record<string, unknown> | undefined) ??
    null;

  return {
    id: String(row.id),
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    role: normalizeRole(row.role),
    language: row.language === "en" ? "en" : "bn",
    theme: row.theme === "light" ? "light" : "dark",
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...((rawNotif as Partial<typeof DEFAULT_NOTIFICATIONS>) ?? {}),
    },
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/** Read one profile by auth user id. Returns null on "not found" or a DB blip. */
export async function getProfile(authId: string): Promise<Profile | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await db().from("profiles").select("*").eq("id", authId).maybeSingle();
    if (error || !data) return null;
    return shapeProfile(data as Record<string, unknown>);
  } catch (error) {
    console.warn("[profile] getProfile failed:", (error as Error)?.message);
    return null;
  }
}

/**
 * Kept under the old name so existing call sites (and their tests) do not
 * churn: `profiles.id` is the auth user id, so this is simply `getProfile`.
 */
export const getProfileByLegacyId = getProfile;

/** Apply an editable subset. Role, premium and seller fields are never writable here. */
export async function updateProfile(
  authId: string,
  patch: Partial<
    Pick<Profile, "full_name" | "phone" | "bio" | "avatar_url" | "language" | "theme" | "notifications">
  > & { onboarded?: boolean }
): Promise<Profile | null> {
  if (!isDbConfigured()) return null;

  const clean: Record<string, unknown> = {};
  if (patch.full_name !== undefined) clean.full_name = patch.full_name?.trim().slice(0, 80) || null;
  if (patch.phone !== undefined) clean.phone = patch.phone?.trim().slice(0, 20) || null;
  if (patch.bio !== undefined) clean.bio = patch.bio?.trim().slice(0, 400) || null;
  if (patch.avatar_url !== undefined) clean.avatar_url = patch.avatar_url || null;
  if (patch.language !== undefined) clean.language = patch.language === "en" ? "en" : "bn";
  if (patch.theme !== undefined) clean.theme = patch.theme === "light" ? "light" : "dark";
  if (patch.notifications !== undefined) clean.notification_preferences = patch.notifications;

  if (!Object.keys(clean).length) return getProfile(authId);

  const attempt = async (payload: Record<string, unknown>): Promise<Profile | null> => {
    const { data, error } = await db()
      .from("profiles")
      .update(payload)
      .eq("id", authId)
      .select("*")
      .maybeSingle();

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      // Older rows may use the other dialect name for the notification column.
      if (msg.includes("notification_preferences") && payload.notification_preferences !== undefined) {
        const values = payload.notification_preferences;
        const alt: Record<string, unknown> = { ...payload, notifications: values };
        delete alt.notification_preferences;
        const retry = await db().from("profiles").update(alt).eq("id", authId).select("*").maybeSingle();
        if (!retry.error && retry.data) return shapeProfile(retry.data as Record<string, unknown>);
      }
      if (msg.includes("does not exist") || msg.includes("could not find")) {
        // Drop columns this project does not have and retry once.
        const alt = { ...payload };
        for (const column of ["bio", "theme", "language", "avatar_url", "full_name", "phone"]) {
          if (msg.includes(column)) delete alt[column];
        }
        if (Object.keys(alt).length) {
          const retry = await db().from("profiles").update(alt).eq("id", authId).select("*").maybeSingle();
          if (!retry.error && retry.data) return shapeProfile(retry.data as Record<string, unknown>);
        }
      }
      console.warn("[profile] updateProfile failed:", error.message);
      return null;
    }
    if (!data) return null;
    return shapeProfile(data as Record<string, unknown>);
  };

  return attempt(clean);
}

/** Friendly Bangla label for a role, used by the header and admin tables. */
export const roleLabelBn: Record<ProfileRole, string> = {
  customer: "গ্রাহক",
  premium: "প্রিমিয়াম",
  seller: "সেলার",
  staff: "স্টাফ",
  manager: "ম্যানেজার",
  admin: "অ্যাডমিন",
};
