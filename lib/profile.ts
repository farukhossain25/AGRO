import { db, isDbConfigured } from "./db";
import type { UserRole } from "./types";
import type { SessionUser } from "./auth";

/* ==========================================================================
   Profiles — the bridge between Supabase Auth and the app's own users table
   --------------------------------------------------------------------------
   auth.users.id  →  profiles.id
   profiles.legacy_user_id  →  users.id   (what ba_session carries)

   Everything here runs server-side with the service role, so the RLS policies
   in 0004 protect direct browser access while these helpers do the privileged
   plumbing (linking, role checks, onboarding state).
   ========================================================================== */

export type ProfileRole = "customer" | "seller" | "premium" | "admin";

export type Profile = {
  id: string;
  legacy_user_id: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: ProfileRole;
  language: "bn" | "en";
  theme: "dark" | "light";
  notifications: { email: boolean; push: boolean; sms: boolean };
  onboarded: boolean;
  mfa_enrolled: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PROFILE_COLUMNS =
  "id, legacy_user_id, full_name, phone, avatar_url, bio, role, language, theme, notifications, onboarded, mfa_enrolled, last_seen_at, created_at, updated_at";

const DEFAULT_NOTIFICATIONS = { email: true, push: true, sms: false };

function shapeProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    legacy_user_id: (row.legacy_user_id as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    role: (row.role as ProfileRole) ?? "customer",
    language: row.language === "en" ? "en" : "bn",
    theme: row.theme === "light" ? "light" : "dark",
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...((row.notifications as Partial<typeof DEFAULT_NOTIFICATIONS>) ?? {}),
    },
    onboarded: Boolean(row.onboarded),
    mfa_enrolled: Boolean(row.mfa_enrolled),
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getProfile(authId: string): Promise<Profile | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await db()
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", authId)
      .maybeSingle();
    if (error || !data) return null;
    return shapeProfile(data);
  } catch {
    return null;
  }
}

export async function getProfileByLegacyId(legacyId: string): Promise<Profile | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await db()
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("legacy_user_id", legacyId)
      .maybeSingle();
    if (error || !data) return null;
    return shapeProfile(data);
  } catch {
    return null;
  }
}

/**
 * Guarantee a `users` row exists for this auth identity and that profiles
 * points at it. The DB trigger normally does this at signup; this covers users
 * created before 0004 was applied, and repairs a broken link.
 */
export async function ensureLinkedUser(auth: {
  id: string;
  email: string | null;
  meta?: Record<string, unknown>;
}): Promise<{ legacyUserId: string; profile: Profile } | null> {
  if (!isDbConfigured()) return null;
  const client = db();

  const email = auth.email?.toLowerCase() ?? null;
  const name =
    (auth.meta?.full_name as string | undefined) ??
    (auth.meta?.name as string | undefined) ??
    (email ? email.split("@")[0] : "গ্রাহক");
  const phone = (auth.meta?.phone as string | undefined) ?? null;
  const avatar = (auth.meta?.avatar_url as string | undefined) ?? null;

  let profile = await getProfile(auth.id);

  // 1. profile already linked → we're done
  if (profile?.legacy_user_id) {
    return { legacyUserId: profile.legacy_user_id, profile };
  }

  // 2. find an app user by email (the bcrypt era) and reuse it
  let legacyId: string | null = null;
  if (email) {
    const { data } = await client
      .from("users")
      .select("id, name, avatar, locale")
      .eq("email", email)
      .maybeSingle();
    legacyId = data?.id ?? null;
  }

  // 3. create one if there's nothing to adopt
  if (!legacyId) {
    const { data, error } = await client
      .from("users")
      .insert({ name, email, phone, role: "customer", avatar })
      .select("id")
      .single();
    if (error) {
      // race: another request created it a moment ago
      if (email) {
        const { data: again } = await client
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        legacyId = again?.id ?? null;
      }
      if (!legacyId) return null;
    } else {
      legacyId = data.id as string;
    }
  }

  // 4. upsert the profile pointing at it
  const { data: upserted, error: upsertError } = await client
    .from("profiles")
    .upsert(
      {
        id: auth.id,
        legacy_user_id: legacyId,
        full_name: profile?.full_name ?? name,
        phone: profile?.phone ?? phone,
        avatar_url: profile?.avatar_url ?? avatar,
        role: profile?.role ?? "customer",
      },
      { onConflict: "id" }
    )
    .select(PROFILE_COLUMNS)
    .single();

  if (upsertError || !upserted) return null;

  return { legacyUserId: legacyId, profile: shapeProfile(upserted) };
}

/** Convert a linked profile into the SessionUser shape the cookie carries. */
export function toSessionUser(profile: Profile, legacyUserId: string, extra?: Partial<SessionUser>): SessionUser {
  const role: UserRole = profile.role === "admin" ? "admin" : "customer";
  return {
    id: legacyUserId,
    name: profile.full_name,
    email: extra?.email ?? null,
    phone: profile.phone,
    role,
  };
}

export async function updateProfile(
  authId: string,
  patch: Partial<Pick<Profile, "full_name" | "phone" | "bio" | "avatar_url" | "language" | "theme" | "notifications" | "onboarded">>
): Promise<Profile | null> {
  if (!isDbConfigured()) return null;

  const clean: Record<string, unknown> = {};
  if (patch.full_name !== undefined) clean.full_name = patch.full_name?.trim().slice(0, 80) || null;
  if (patch.phone !== undefined) clean.phone = patch.phone?.trim().slice(0, 20) || null;
  if (patch.bio !== undefined) clean.bio = patch.bio?.trim().slice(0, 400) || null;
  if (patch.avatar_url !== undefined) clean.avatar_url = patch.avatar_url || null;
  if (patch.language !== undefined) clean.language = patch.language === "en" ? "en" : "bn";
  if (patch.theme !== undefined) clean.theme = patch.theme === "light" ? "light" : "dark";
  if (patch.notifications !== undefined) clean.notifications = patch.notifications;
  if (patch.onboarded !== undefined) clean.onboarded = Boolean(patch.onboarded);

  if (!Object.keys(clean).length) return getProfile(authId);

  const { data, error } = await db()
    .from("profiles")
    .update(clean)
    .eq("id", authId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error || !data) return null;

  // mirror the display name/avatar into users so older pages stay in sync
  const profile = shapeProfile(data);
  if (profile.legacy_user_id) {
    const mirror: Record<string, unknown> = {};
    if (clean.full_name !== undefined) mirror.name = profile.full_name;
    if (clean.avatar_url !== undefined) mirror.avatar = profile.avatar_url;
    if (clean.phone !== undefined) mirror.phone = profile.phone;
    if (clean.language !== undefined) mirror.locale = profile.language;
    if (Object.keys(mirror).length) {
      try {
        await db().from("users").update(mirror).eq("id", profile.legacy_user_id);
      } catch {
        /* mirror is best-effort */
      }
    }
  }

  return profile;
}

export async function touchLastSeen(authId: string): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await db().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", authId);
  } catch {
    /* non-critical */
  }
}

/** Map a profile role to the app's coarser UserRole. */
export function roleToSessionRole(role: ProfileRole): UserRole {
  return role === "admin" ? "admin" : "customer";
}

/** Bengali label for a profile role, used by the header + profile page. */
export const roleLabelBn: Record<ProfileRole, string> = {
  customer: "গ্রাহক",
  seller: "সেলার",
  premium: "প্রিমিয়াম",
  admin: "অ্যাডমিন",
};
