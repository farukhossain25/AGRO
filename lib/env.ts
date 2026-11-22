/* ==========================================================================
   lib/env.ts — one place that reads the Supabase environment
   --------------------------------------------------------------------------
   Rules enforced here:

     • Only NAMES are ever reported. A value is never logged, thrown or
       rendered — not even partially.
     • The publishable (anon) key is the only key allowed in a NEXT_PUBLIC_*
       variable. The secret (service) key is server-only.
     • New-style keys win; the legacy names still work as a fallback so an
       existing Vercel project keeps running while the keys are rotated:

         NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  → fallback NEXT_PUBLIC_SUPABASE_ANON_KEY
         SUPABASE_SECRET_KEY                   → fallback SUPABASE_SERVICE_ROLE_KEY

   The values are read with literal `process.env.X` expressions because Next
   only inlines NEXT_PUBLIC_* when the member access is written out in full.
   ========================================================================== */

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const rawPublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const rawSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

/** Project URL without a trailing slash, e.g. https://abcdefg.supabase.co */
export const SUPABASE_URL = rawUrl.replace(/\/+$/, "");

/** Publishable / anon key. PUBLIC by design — it ships to every visitor. */
export const SUPABASE_PUBLIC_KEY = rawPublicKey;

/** Secret / service-role key. SERVER ONLY. Never read this in a Client Component. */
export const SUPABASE_SECRET_KEY = rawSecretKey;

/** Canonical site URL, no trailing slash. Used for absolute links + OAuth. */
export const SITE_URL = (rawSiteUrl || "https://bishwasagro.vercel.app").replace(/\/+$/, "");

/** True when the browser-side client has everything it needs. */
export const isSupabasePublicConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);

/** True when the server can use the privileged client. */
export const isSupabaseAdminConfigured = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);

/**
 * Names (never values) of the variables that are missing.
 * `scope: "server"` also checks the secret key; the browser only needs the
 * public pair, so a Client Component must never be told the secret is absent.
 */
export function missingEnvNames(scope: "public" | "server" = "public"): string[] {
  const missing: string[] = [];
  const has = (name: string, ok: boolean) => {
    if (!ok) missing.push(name);
  };

  has("NEXT_PUBLIC_SUPABASE_URL", Boolean(SUPABASE_URL));
  has(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    Boolean(SUPABASE_PUBLIC_KEY)
  );
  if (scope === "server") {
    has("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)", Boolean(SUPABASE_SECRET_KEY));
  }
  return missing;
}

/**
 * Startup check. Runs once per process (module scope) so a misconfigured
 * deployment shows up in the Vercel runtime log immediately — as a list of
 * NAMES, never as values.
 */
if (typeof window === "undefined") {
  const missing = missingEnvNames("server");
  if (missing.length > 0) {
    console.error(`[env] Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }
}

export const env = {
  url: SUPABASE_URL,
  publicKey: SUPABASE_PUBLIC_KEY,
  secretKey: SUPABASE_SECRET_KEY,
  siteUrl: SITE_URL,
  isPublicConfigured: isSupabasePublicConfigured,
  isAdminConfigured: isSupabaseAdminConfigured,
  missing: missingEnvNames,
} as const;
