"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient, readRememberSession, supabaseConfigured } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/session";

/* ==========================================================================
   AuthProvider — one source of truth for "who is signed in" in the browser
   --------------------------------------------------------------------------
   The server renders the first paint with the session it already read, so
   there is no flash of the logged-out header. From then on Supabase's
   `onAuthStateChange` keeps it live: signing in or out in any tab updates the
   header immediately, with no page reload.

   The role and display name come from the user's OWN `profiles` row (RLS
   allows `id = auth.uid()` only), never from a token we minted ourselves.
   ========================================================================== */

export type AuthState = {
  user: SessionUser | null;
  /** true until the first client-side session check settles */
  loading: boolean;
  /** re-read the profile row (after editing the profile, for example) */
  refresh: () => Promise<void>;
  /** sign out everywhere via the server route, then refresh the UI */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
};

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser && supabaseConfigured);

  /*
   * "এই ডিভাইসে লগইন রাখুন" unchecked → session-only login.
   * The cookie from @supabase/ssr is always long-lived, so a fresh browser
   * session (sessionStorage marker absent) signs the visitor out once. Doing it
   * here, not in the login form, also covers a tab that was merely reopened.
   */
  useEffect(() => {
    if (!supabaseConfigured) return;
    if (readRememberSession() !== false) return;
    try {
      if (sessionStorage.getItem("ba:boot") === "1") return;
      sessionStorage.setItem("ba:boot", "1");
    } catch {
      return;
    }
    void createClient()
      .auth.signOut()
      .catch(() => {
        /* nothing to end */
      });
  }, []);

  const loadProfile = useCallback(async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    const fallback: SessionUser = {
      id: authUser.id,
      name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      email: authUser.email ?? null,
      phone: null,
      role: "customer",
      avatarUrl: null,
    };

    if (!supabaseConfigured) return fallback;

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url, role")
        .eq("id", authUser.id)
        .maybeSingle<ProfileRow>();

      if (!data) return fallback;

      const role = data.role;
      return {
        id: authUser.id,
        name: data.full_name ?? fallback.name,
        email: authUser.email ?? null,
        phone: data.phone ?? null,
        role:
          role === "admin" || role === "manager" || role === "staff" || role === "seller" || role === "premium"
            ? role
            : "customer",
        avatarUrl: data.avatar_url ?? null,
      } satisfies SessionUser;
    } catch {
      return fallback;
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let disposed = false;

    // Initial read: covers a page that was cached, or a session restored in
    // another tab before this one mounted.
    void supabase.auth.getUser().then(async ({ data }) => {
      if (disposed) return;
      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      if (data.user.id !== initialUser?.id) {
        const next = await loadProfile(data.user);
        if (!disposed) setUser(next);
      }
      if (!disposed) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Defer the query one tick: Supabase is still writing the session cookie
      // when the callback fires, and a PostgREST call in that instant 401s.
      setTimeout(() => {
        void loadProfile(session.user).then((next) => {
          if (!disposed) {
            setUser(next);
            setLoading(false);
          }
        });
      }, 0);

      if (event === "SIGNED_IN") setLoading(false);
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [initialUser?.id, loadProfile]);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const {
        data: { user: authUser },
      } = await createClient().auth.getUser();
      if (!authUser) {
        setUser(null);
        return;
      }
      setUser(await loadProfile(authUser));
    } catch {
      /* keep the current user on a transient failure */
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/auth/signout", { method: "POST" });
    } catch {
      /* cookie may already be gone */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, refresh, signOut }),
    [user, loading, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the auth state. Returns a safe empty state when used outside the
 * provider (the login page renders before any layout in some error paths), so
 * a missing provider can never crash the page.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    user: null,
    loading: false,
    refresh: async () => {},
    signOut: async () => {},
  };
}
