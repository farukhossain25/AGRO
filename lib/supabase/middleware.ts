import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabasePublicConfigured } from "@/lib/env";
import { normalizeRole } from "@/lib/session";
import type { UserRole } from "@/lib/types";

/* ==========================================================================
   lib/supabase/middleware.ts — refresh the Supabase session on every request
   --------------------------------------------------------------------------
   Supabase access tokens are short-lived (1 hour). If nothing refreshes them,
   a user who leaves a tab open is silently signed out even though the refresh
   token is still valid. This helper runs in middleware, calls `getUser()`
   (which validates the JWT server-side and rotates the cookies when needed)
   and writes the rotated cookies onto the response it returns.

   The same call answers "who is this?" for the route guards, so a guarded
   request costs exactly one auth round-trip — no duplicate verification.
   ========================================================================== */

export type SessionResult = {
  /** Response that already carries any refreshed auth cookies. */
  response: NextResponse;
  user: User | null;
  role: UserRole | null;
  supabase: SupabaseClient | null;
};

export async function updateSession(
  req: NextRequest,
  options: { nonce?: string; withRole?: boolean } = {}
): Promise<SessionResult> {
  const requestHeaders = new Headers(req.headers);
  if (options.nonce) requestHeaders.set("x-nonce", options.nonce);

  // Build the pass-through response up-front; `setAll` replaces it whenever
  // Supabase rotates a cookie so the new values always land on the response.
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!isSupabasePublicConfigured) {
    return { response, user: null, role: null, supabase: null };
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) req.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options: cookieOptions } of cookiesToSet) {
          response.cookies.set(name, value, cookieOptions);
        }
      },
    },
  });

  let user: User | null = null;
  try {
    /* A stub project (used by the local mock harness and by the UI screenshot
       runs) has no /auth/v1/user endpoint, so getUser() would throw and every
       guarded page would redirect to /login. Treat an explicit
       SUPABASE_DEV_USER_ID as "this request is that user" — it is read on the
       SERVER only and is ignored whenever the variable is unset, which is
       always the case in production. */
    const devUser = process.env.SUPABASE_DEV_USER_ID;
    if (devUser) {
      user = {
        id: devUser,
        email: process.env.SUPABASE_DEV_USER_EMAIL ?? "dev@local",
        app_metadata: {},
        user_metadata: { full_name: process.env.SUPABASE_DEV_USER_NAME ?? "ডেভ টিম" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User;
    }
    /* No early return: the role lookup below still has to run, otherwise
       withRole:true would hand the guards a null role and 404 the panel. */
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user ?? null;
    }
  } catch (error) {
    // A network hiccup must not take the whole site down: treat as signed out.
    console.error("[middleware] auth.getUser failed:", (error as Error)?.message);
  }

  if (!user) return { response, user: null, role: null, supabase };
  if (!options.withRole) return { response, user, role: null, supabase };

  let role: UserRole = "customer";
  try {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = normalizeRole((data as { role?: string } | null)?.role);
  } catch {
    /* unknown role ⇒ customer (fail closed) */
  }

  return { response, user, role, supabase };
}
