"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabasePublicConfigured } from "@/lib/env";

/* ==========================================================================
   Browser Supabase client — the ONLY client a Client Component may use.
   --------------------------------------------------------------------------
   createBrowserClient stores the session in cookies (via @supabase/ssr), not
   localStorage, so the server can read the same session and the session
   survives a hard reload. The publishable/anon key is public by design; every
   real permission check happens in Postgres RLS.
   ========================================================================== */

let browserClient: SupabaseClient<Database> | null = null;

/* --------------------------------------------------------------------------
   "এই ডিভাইসে লগইন রাখুন" (remember me)
   --------------------------------------------------------------------------
   @supabase/ssr always writes the session cookie with a 400-day max-age, so the
   checkbox cannot change the cookie itself. Instead the choice is remembered
   here and AuthProvider signs the visitor out once per browser session when the
   box was left unchecked — session-only behaviour, no fake switch.
   -------------------------------------------------------------------------- */
const REMEMBER_KEY = "ba:remember";

export function setRememberSession(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    /* private mode — the cookie still works, just always persistent */
  }
}

/** null = never asked (treat as remembered) */
export function readRememberSession(): boolean | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

/** True when the public Supabase keys exist (hide Google login etc. if not). */
export const supabaseConfigured = isSupabasePublicConfigured;

export function createClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;

  if (!isSupabasePublicConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  browserClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return browserClient;
}

/** Alias kept for readable call sites: `supabase.auth.signInWithPassword(...)`. */
export const createBrowserSupabaseClient = createClient;
