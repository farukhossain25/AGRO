"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";

/* ==========================================================================
   The auth context, kept apart from the provider component
   --------------------------------------------------------------------------
   `auth-provider.tsx` is heavy on purpose: it owns the Supabase browser client
   glue and the sign-out flow. A component that only needs to know *whether*
   somebody is signed in — the storefront review form on the home page, for
   example — should not pay for that. Importing the context from this module
   keeps such a component at a few hundred bytes instead of dragging the whole
   provider into its route's first-load bundle.
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

export const AuthContext = createContext<AuthState | null>(null);

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
