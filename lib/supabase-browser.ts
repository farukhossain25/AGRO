/**
 * Browser-side Supabase client (anon key only).
 *
 * Uses @supabase/supabase-js which is already a dependency — no extra package
 * needed. The anon key is PUBLIC by design (it is shipped to every visitor);
 * all real protection comes from the RLS policies in 0004.
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time. Do NOT put
 * SUPABASE_SERVICE_ROLE_KEY here — it must never reach a browser bundle.
 */
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  browserClient = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "ba-auth",
    },
  });

  return browserClient;
}

/** True when the public Supabase keys exist (used to hide Google login etc.). */
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Capacitor / Android deep-link return URL.
 *
 * In a plain browser this is `${origin}/auth/callback`. Inside the Capacitor
 * shell the WebView origin is `capacitor://localhost` (iOS) or
 * `http://localhost` (Android), which Supabase will not redirect to. So the
 * login uses the hosted callback and the app intercepts it via the custom
 * scheme registered in android/app/src/main/AndroidManifest.xml:
 *
 *   biswasagro://auth-callback
 */
export function oauthRedirectTo(next?: string): string {
  if (typeof window === "undefined") return "/auth/callback";

  const params = new URLSearchParams();
  if (next) params.set("next", next);

  const native =
    // Capacitor injects this before any app code runs
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.() ||
    window.location.protocol === "capacitor:" ||
    // Android WebView serves from http://localhost, still a native shell
    (window.location.hostname === "localhost" && /wv|Capacitor/i.test(navigator.userAgent));

  if (native) {
    /* Supabase requires an absolute http(s) redirectTo, so the WebView goes to
       the hosted /auth/callback first; the appUrlOpen listener in the Android
       shell treats `biswasagro://auth-callback` as a second return address.
       `native=1` tells the callback not to navigate the WebView away from the
       app before the deep link fires. */
    const target = `biswasagro://auth-callback${params.toString() ? `?${params}` : ""}`;
    return `${window.location.origin}/auth/callback?native=${encodeURIComponent(target)}`;
  }

  /* Always the CURRENT origin: https://<project>.vercel.app in production,
     https://<hash>-<team>.vercel.app on a preview, http://localhost:3000 in
     development. Nothing is hard-coded, so adding a custom domain later needs
     no code change — only the Supabase redirect allow-list. */
  const qs = params.toString();
  return `${window.location.origin}/auth/callback${qs ? `?${qs}` : ""}`;
}
