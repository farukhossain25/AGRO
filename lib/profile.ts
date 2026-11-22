import { db, isDbConfigured } from "./db";
import type { UserRole } from "./types";
import type { SessionUser } from "./auth";

/* ==========================================================================
   Profiles — the bridge between Supabase Auth and the app's own users table
   --------------------------------------------------------------------------
   Two production schemas exist in the wild:

     legacy (lyihdz… / biswas-agro) :  auth.users.id → profiles.id
                                       profiles.legacy_user_id → users.id
                                       (what ba_session carries)
     modern (izemaui… / AgroWeb)    :  auth.users.id → profiles.id  (1:1)
                                       no public.users table, no legacy_user_id
                                       orders/addresses FK directly to profiles.id

   Everything here runs server-side with the service role, so RLS policies
   protect direct browser access while these helpers do the privileged plumbing.
   Every query is written against SELECT "*" and maps both column dialects
   (notifications vs notification_preferences, etc.) so a single build works
   against either project without a migration.
   ========================================================================== */

export type ProfileRole = "customer" | "seller" | "premium" | "staff" | "manager" | "admin";

export type Profile = {
  id: string;
  /** null on modern schema where profiles.id IS the app identity */
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

const DEFAULT_NOTIFICATIONS = { email: true, push: true, sms: false };

function shapeProfile(row: Record<string, unknown>): Profile {
  // notifications lives as `notifications` (legacy) or `notification_preferences` (modern)
  const rawNotif =
    (row.notifications as Record<string, unknown> | undefined) ??
    (row.notification_preferences as Record<string, unknown> | undefined) ??
    null;

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
      ...((rawNotif as Partial<typeof DEFAULT_NOTIFICATIONS>) ?? {}),
    },
    onboarded: Boolean((row.onboarded as boolean | undefined) ?? false),
    mfa_enrolled: Boolean((row.mfa_enrolled as boolean | undefined) ?? false),
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function getProfile(authId: string): Promise<Profile | null> {
  if (!isDbConfigured()) {
    console.warn("[profile] getProfile: Supabase not configured (missing URL / service key)");
    return null;
  }
  try {
    const { data, error } = await db().from("profiles").select("*").eq("id", authId).maybeSingle();
    if (error) {
      // column mismatch shouldn't happen with "*", but log for visibility
      console.warn("[profile] getProfile query error", error.message);
      return null;
    }
    if (!data) return null;
    return shapeProfile(data as Record<string, unknown>);
  } catch (e) {
    console.warn("[profile] getProfile exception", (e as Error)?.message);
    return null;
  }
}

export async function getProfileByLegacyId(legacyId: string): Promise<Profile | null> {
  if (!isDbConfigured()) return null;
  try {
    // legacy schema
    const { data, error } = await db().from("profiles").select("*").eq("legacy_user_id", legacyId).maybeSingle();
    if (!error && data) return shapeProfile(data as Record<string, unknown>);
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const missingLegacy = msg.includes("legacy_user_id") || msg.includes("does not exist") || error.code === "42703";
      if (!missingLegacy) {
        // real error, but still try fallback to id
        console.warn("[profile] getProfileByLegacyId legacy query error", error.message);
      }
    }
    // modern schema or fallback: session.id IS profiles.id
    const { data: byId, error: err2 } = await db().from("profiles").select("*").eq("id", legacyId).maybeSingle();
    if (err2 || !byId) return null;
    return shapeProfile(byId as Record<string, unknown>);
  } catch {
    // final fallback: try by id
    try {
      const { data } = await db().from("profiles").select("*").eq("id", legacyId).maybeSingle();
      if (!data) return null;
      return shapeProfile(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }
}

/**
 * Guarantee a `users` / `profiles` row exists for this auth identity.
 * The DB trigger (handle_new_user / handle_new_auth_user) normally does this
 * at signup; this repairs users created before the trigger or a broken link,
 * and works against both legacy (users + legacy_user_id) and modern (direct)
 * schemas.
 */
export async function ensureLinkedUser(auth: {
  id: string;
  email: string | null;
  meta?: Record<string, unknown>;
}): Promise<{ legacyUserId: string; profile: Profile } | null> {
  if (!isDbConfigured()) {
    console.error("[profile] ensureLinkedUser: Supabase not configured — check NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY on Vercel");
    return null;
  }
  const client = db();

  const email = auth.email?.toLowerCase() ?? null;
  const name =
    (auth.meta?.full_name as string | undefined) ??
    (auth.meta?.name as string | undefined) ??
    (email ? email.split("@")[0] : "গ্রাহক");
  const phone = (auth.meta?.phone as string | undefined) ?? null;
  const avatar = (auth.meta?.avatar_url as string | undefined) ?? null;

  const existing = await getProfile(auth.id);

  // Fast path: legacy already linked
  if (existing?.legacy_user_id) {
    return { legacyUserId: existing.legacy_user_id, profile: existing };
  }

  // Detect which schema the project uses by probing public.users
  let hasUsersTable = true;
  try {
    const { error } = await client.from("users").select("id").limit(1).maybeSingle();
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("could not find") || error.code === "42P01" || error.code === "42703") {
        hasUsersTable = false;
      } else {
        // empty table returns no error; any other error still suggests table exists
      }
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? "").toLowerCase();
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("users")) hasUsersTable = false;
  }

  // ── Modern schema (no users table): profiles.id IS the app identity ──
  if (!hasUsersTable) {
    if (existing) {
      return { legacyUserId: existing.id, profile: existing };
    }
    // No profile yet — create it directly. Trigger should have done this,
    // but we repair it here. Use both email/full_name columns present on modern.
    const payload: Record<string, unknown> = {
      id: auth.id,
      full_name: name,
      phone: phone ?? "",
      email: email ?? "",
      avatar_url: avatar,
      role: "customer",
    };
    try {
      const { data, error } = await client.from("profiles").upsert(payload, { onConflict: "id" }).select("*").single();
      if (error || !data) {
        console.error("[profile] ensureLinkedUser modern upsert failed", error?.message, error);
        // Trigger may have raced and created it — try fetch again
        const retry = await getProfile(auth.id);
        if (retry) return { legacyUserId: retry.id, profile: retry };
        return null;
      }
      const profile = shapeProfile(data as Record<string, unknown>);
      return { legacyUserId: profile.id, profile };
    } catch (e) {
      console.error("[profile] ensureLinkedUser modern exception", (e as Error)?.message);
      const retry = await getProfile(auth.id);
      if (retry) return { legacyUserId: retry.id, profile: retry };
      return null;
    }
  }

  // ── Legacy schema (users + legacy_user_id) ──
  let legacyId: string | null = null;
  if (email) {
    try {
      const { data } = await client.from("users").select("id, name, avatar, locale").eq("email", email).maybeSingle();
      legacyId = (data as { id?: string } | null)?.id ?? null;
    } catch (e) {
      console.warn("[profile] ensureLinkedUser users lookup failed", (e as Error)?.message);
    }
  }

  if (!legacyId) {
    try {
      const { data, error } = await client
        .from("users")
        .insert({ name, email, phone, role: "customer", avatar })
        .select("id")
        .single();
      if (error) {
        // race: another request created it
        if (email) {
          try {
            const { data: again } = await client.from("users").select("id").eq("email", email).maybeSingle();
            legacyId = (again as { id?: string } | null)?.id ?? null;
          } catch {}
        }
        if (!legacyId) {
          console.error("[profile] ensureLinkedUser users insert failed", error.message);
          return null;
        }
      } else {
        legacyId = (data as { id: string }).id;
      }
    } catch (e) {
      console.error("[profile] ensureLinkedUser users insert exception", (e as Error)?.message);
      if (email) {
        try {
          const { data: again } = await client.from("users").select("id").eq("email", email).maybeSingle();
          legacyId = (again as { id?: string } | null)?.id ?? null;
        } catch {}
      }
      if (!legacyId) return null;
    }
  }

  // Upsert profile pointing at users.id
  try {
    const { data: upserted, error: upsertError } = await client
      .from("profiles")
      .upsert(
        {
          id: auth.id,
          legacy_user_id: legacyId,
          full_name: existing?.full_name ?? name,
          phone: existing?.phone ?? phone,
          avatar_url: existing?.avatar_url ?? avatar,
          role: existing?.role ?? "customer",
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (upsertError || !upserted) {
      console.error("[profile] ensureLinkedUser legacy upsert failed", upsertError?.message);
      // Retry fetch — trigger may have created it
      const retry = await getProfile(auth.id);
      if (retry?.legacy_user_id) return { legacyUserId: retry.legacy_user_id, profile: retry };
      if (retry) return { legacyUserId: legacyId, profile: retry };
      return null;
    }

    return { legacyUserId: legacyId, profile: shapeProfile(upserted as Record<string, unknown>) };
  } catch (e) {
    console.error("[profile] ensureLinkedUser legacy upsert exception", (e as Error)?.message);
    return null;
  }
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
  if (patch.notifications !== undefined) {
    // write to both dialects so we hit the one that exists; the other will be ignored via fallback
    clean.notifications = patch.notifications;
    clean.notification_preferences = patch.notifications;
  }
  if (patch.onboarded !== undefined) clean.onboarded = Boolean(patch.onboarded);

  if (!Object.keys(clean).length) return getProfile(authId);

  // Try with full clean; if Supabase complains about a missing column, retry with dialect fixes
  const attempt = async (payload: Record<string, unknown>): Promise<Profile | null> => {
    const { data, error } = await db().from("profiles").update(payload).eq("id", authId).select("*").maybeSingle();
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      // dialect remediation
      if (msg.includes("notifications") && payload.notifications !== undefined) {
        const alt = { ...payload };
        delete alt.notifications;
        alt.notification_preferences = payload.notifications;
        const retry = await db().from("profiles").update(alt).eq("id", authId).select("*").maybeSingle();
        if (!retry.error && retry.data) return shapeProfile(retry.data as Record<string, unknown>);
      }
      if (msg.includes("notification_preferences") && payload.notification_preferences !== undefined) {
        const alt = { ...payload };
        delete alt.notification_preferences;
        alt.notifications = payload.notification_preferences;
        const retry = await db().from("profiles").update(alt).eq("id", authId).select("*").maybeSingle();
        if (!retry.error && retry.data) return shapeProfile(retry.data as Record<string, unknown>);
      }
      if (msg.includes("onboarded") || msg.includes("mfa_enrolled") || msg.includes("last_seen_at")) {
        // drop missing bookkeeping columns and retry
        const alt = { ...payload };
        delete alt.onboarded;
        delete alt.mfa_enrolled;
        delete alt.last_seen_at;
        if (Object.keys(alt).length) {
          const retry = await db().from("profiles").update(alt).eq("id", authId).select("*").maybeSingle();
          if (!retry.error && retry.data) return shapeProfile(retry.data as Record<string, unknown>);
        } else {
          return getProfile(authId);
        }
      }
      console.warn("[profile] updateProfile error", error.message);
      return null;
    }
    if (!data) return null;
    return shapeProfile(data as Record<string, unknown>);
  };

  const profile = await attempt(clean);
  if (!profile) return null;

  // mirror into users on legacy schema (best-effort)
  const mirrorTarget = profile.legacy_user_id;
  if (mirrorTarget) {
    const mirror: Record<string, unknown> = {};
    if (clean.full_name !== undefined) mirror.name = profile.full_name;
    if (clean.avatar_url !== undefined) mirror.avatar = profile.avatar_url;
    if (clean.phone !== undefined) mirror.phone = profile.phone;
    if (clean.language !== undefined) mirror.locale = profile.language;
    if (Object.keys(mirror).length) {
      try {
        await db().from("users").update(mirror).eq("id", mirrorTarget);
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
    const { error } = await db().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", authId);
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("last_seen_at") || msg.includes("does not exist")) return; // modern schema has no such column
      // silent otherwise
    }
  } catch {
    /* non-critical */
  }
}

/** Map a profile role to the app's UserRole — a straight pass-through now that
 *  the ladder is identical on both sides (section F). */
export function roleToSessionRole(role: ProfileRole): UserRole {
  return role;
}

/** Bengali label for a profile role, used by the header + profile page. */
export const roleLabelBn: Record<ProfileRole, string> = {
  customer: "গ্রাহক",
  seller: "সেলার",
  premium: "প্রিমিয়াম",
  staff: "স্টাফ",
  manager: "ম্যানেজার",
  admin: "অ্যাডমিন",
};
