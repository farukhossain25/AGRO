/**
 * Server-side Supabase clients.
 *
 *  supabaseAnonServer()  — anon key, no session. For verifying a bearer token
 *                          passed from the browser (supabase.auth.getUser(jwt)).
 *  supabaseService()     — service role. Bypasses RLS. Server only.
 *
 * Never import this file from a "use client" component.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(url() && anon());
}

let anonServer: SupabaseClient | null = null;

/** Anon-key client with no persisted session — safe to reuse per instance. */
export function supabaseAnonServer(): SupabaseClient {
  if (anonServer) return anonServer;
  if (!url() || !anon()) throw new Error("Supabase auth is not configured (URL / anon key).");
  anonServer = createClient(url(), anon(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return anonServer;
}

let serviceServer: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS — every caller must authorise first. */
export function supabaseService(): SupabaseClient {
  if (serviceServer) return serviceServer;
  if (!url() || !service()) {
    throw new Error("Supabase service role is not configured (URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  serviceServer = createClient(url(), service(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "biswas-agro-auth" } },
  });
  return serviceServer;
}

export type AuthUser = {
  id: string;
  email: string | null;
  /** true once the email has been confirmed (or the provider verified it) */
  verified: boolean;
  /** Supabase MFA: has at least one verified TOTP factor */
  mfa: boolean;
  provider: string | null;
  meta: Record<string, unknown>;
};

/** Shape the parts of a Supabase user we care about. */
export function shapeAuthUser(
  user: {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
    factors?: { status?: string; factor_type?: string }[] | null;
    identities?: { provider?: string }[] | null;
  } | null
): AuthUser | null {
  if (!user) return null;

  const verified = Boolean(
    user.email_confirmed_at ||
      user.confirmed_at ||
      (user.app_metadata?.provider && user.app_metadata.provider !== "email")
  );

  const mfa = Boolean(
    user.factors?.some((f) => f.status === "verified" && f.factor_type === "totp")
  );

  // Highest-privilege provider wins for display purposes.
  const provider =
    (user.app_metadata?.providers as string[] | undefined)?.find((p) => p !== "email") ??
    (user.app_metadata?.provider as string | undefined) ??
    user.identities?.[0]?.provider ??
    "email";

  return {
    id: user.id,
    email: user.email ?? null,
    verified,
    mfa,
    provider,
    meta: (user.user_metadata ?? {}) as Record<string, unknown>,
  };
}
