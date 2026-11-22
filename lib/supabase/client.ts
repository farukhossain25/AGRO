"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabasePublicConfigured } from "@/lib/env";

/* ==========================================================================
   Browser Supabase client — the ONLY client a Client Component may use.
   --------------------------------------------------------------------------
   createBrowserClient stores the session in cookies (via @supabase/ssr), not
   localStorage, so the server can read the same session and the session
   survives a hard reload. The publishable/anon key is public by design; every
   real permission check happens in Postgres RLS.
   ========================================================================== */

let browserClient: SupabaseClient | null = null;

/** True when the public Supabase keys exist (hide Google login etc. if not). */
export const supabaseConfigured = isSupabasePublicConfigured;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  if (!isSupabasePublicConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return browserClient;
}

/** Alias kept for readable call sites: `supabase.auth.signInWithPassword(...)`. */
export const createBrowserSupabaseClient = createClient;
