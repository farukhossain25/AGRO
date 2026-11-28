import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cache } from "react";
import {
  SUPABASE_PUBLIC_KEY,
  SUPABASE_SECRET_KEY,
  SUPABASE_URL,
  isSupabaseAdminConfigured,
  isSupabasePublicConfigured,
} from "@/lib/env";
import { normalizeRole, type SessionUser } from "@/lib/session";
import type { Database } from "@/lib/database.types";
import { withDeadline, withDeadlineFallback } from "@/lib/fetch-deadline";

/* ==========================================================================
   Server Supabase clients
   --------------------------------------------------------------------------
   createServerSupabaseClient()  — reads/writes the auth cookies. This is the
                                   client every Server Component, Route
                                   Handler and middleware should use to ask
                                   "who is this?" (via auth.getUser()).
   supabaseAdmin()               — secret key, bypasses RLS. SERVER ONLY, and
                                   only where the code has already authorised
                                   the caller.

   Never import this module from a "use client" file.
   ========================================================================== */

/** Cookie-bound client. Sets/removes auth cookies through Next's cookie store. */
export async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  if (!isSupabasePublicConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    /* Every request through this client — auth.getUser(), the profile read, any
       RLS-scoped query — now has a deadline. Without it a slow Supabase held the
       whole tree open and the visitor watched the route skeleton. */
    global: { fetch: withDeadline() },
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* Called from a Server Component render: the response headers are
             already flushed, so the rotated cookie cannot be written here.
             middleware.ts refreshes the session on the next request, so this
             is safe to ignore. */
        }
      },
    },
  });
}

let adminClient: SupabaseClient<Database> | null = null;

/** Secret-key client. Bypasses RLS — every call site must authorise first. */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  if (!isSupabaseAdminConfigured) {
    throw new Error(
      "Supabase secret key is not configured. Set SUPABASE_SECRET_KEY (server-only)."
    );
  }

  adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "biswas-agro-server" }, fetch: withDeadline() },
  });
  return adminClient;
}

/** Cached per request: one auth round-trip even if ten components ask. */
export const getServerUser = cache(async () => {
  if (!isSupabasePublicConfigured) return null;

  /* Stub-project override — see lib/supabase/middleware.ts. A local harness has
     no /auth/v1/user, so without this every server component saw "signed out"
     while middleware saw a user, and the panel bounced back to its login. Unset
     in production, therefore inert there. */
  const devUser = process.env.SUPABASE_DEV_USER_ID;
  if (devUser) {
    return {
      id: devUser,
      email: process.env.SUPABASE_DEV_USER_EMAIL ?? "dev@local",
      app_metadata: {},
      user_metadata: { full_name: process.env.SUPABASE_DEV_USER_NAME ?? "ডেভ টিম" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as User;
  }

  try {
    const supabase = await createServerSupabaseClient();
    /* `auth.getUser()` is a network call to /auth/v1/user, and the SDK builds
       that request itself — the client-level fetch deadline does not always
       apply to it. Racing it is the only way to guarantee a ceiling: without
       this, a Supabase auth endpoint that accepts the connection and then
       stalls kept the entire page render waiting indefinitely. */
    const result = await withDeadlineFallback(
      supabase.auth.getUser(),
      { data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>
    );
    if (result.error || !result.data?.user) return null;
    return result.data.user;
  } catch {
    return null;
  }
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  email: string | null;
  is_seller?: boolean | null;
};

/**
 * The signed-in user, joined with their own profile row.
 *
 * The profile read uses the user's own client, so `profiles_select` RLS is what
 * authorises it. If the row is somehow missing (a signup that predates the
 * trigger) it is repaired once with the service client — the trigger also does
 * this on insert, so this is belt-and-braces only.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const user = await getServerUser();
  if (!user) return null;

  const fallback: SessionUser = {
    id: user.id,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    email: user.email ?? null,
    phone: null,
    role: "customer",
    avatarUrl: null,
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, role, email, is_seller")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (data) {
      return {
        id: user.id,
        name: data.full_name ?? fallback.name,
        email: user.email ?? data.email ?? null,
        phone: data.phone ?? null,
        role: normalizeRole(data.role),
        avatarUrl: data.avatar_url ?? null,
        isSeller: Boolean(data.is_seller) || data.role === "seller",
      };
    }

    // Repair: create the missing profile once (service key, server-side only).
    if (isSupabaseAdminConfigured) {
      /* No email-handle fallback. It used to write "foysaliqbal09" straight
         into profiles.full_name, and every customer-facing surface then treated
         that login identifier as the person's name — including the live-chat
         sentence that announces who picked the chat up. A missing name stays
         null; the UI has an honest label for that, and /foisal/team can set it. */
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;
      const { data: created } = await supabaseAdmin()
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name: name,
            email: user.email ?? "",
            avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? "",
          },
          { onConflict: "id", ignoreDuplicates: true }
        )
        .select("id, full_name, phone, avatar_url, role, email, is_seller")
        .maybeSingle<ProfileRow>();

      if (created) {
        return {
          id: user.id,
          name: created.full_name ?? name,
          email: user.email ?? created.email ?? null,
          phone: created.phone ?? null,
          role: normalizeRole(created.role),
          avatarUrl: created.avatar_url ?? null,
          isSeller: Boolean(created.is_seller) || created.role === "seller",
        };
      }
    }
  } catch {
    /* fall through to the metadata-only shape */
  }

  return fallback;
});
