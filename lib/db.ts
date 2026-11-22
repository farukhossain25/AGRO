import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — every call site MUST authorise the caller first.
 */
let adminClient: SupabaseClient | null = null;

/**
 * Every server-side query gets a hard deadline.
 *
 * Without this, one unreachable Supabase call stalls the whole render and the
 * page ships with an empty section. Callers already degrade gracefully on
 * errors, so a fast failure is the right outcome: the page still paints and the
 * fallback content appears. 8s is far above a healthy round-trip (p99 ≈ 200ms).
 */
const DB_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS ?? 8000);

const timeoutFetch: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);

  // respect a caller-supplied signal as well
  if (init?.signal) {
    init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal })
    .then((response) => {
      reachable = true;
      return response;
    })
    .catch((error) => {
      reachable = false;
      throw error;
    })
    .finally(() => clearTimeout(timer));
};

export function db(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "biswas-agro-server" }, fetch: timeoutFetch },
  });

  return adminClient;
}

/**
 * Set after the first failed round-trip in this process. Rendering an offline
 * build is the point: once we know Supabase is unreachable, every later call
 * returns its fallback immediately instead of burning 8 s on another timeout.
 * Reset whenever a request succeeds.
 */
let reachable: boolean | null = null;

export function markDbUnreachable() {
  reachable = false;
}

export function markDbReachable() {
  reachable = true;
}

/**
 * True when it is worth attempting a query: credentials exist AND the last
 * attempt in this process did not fail. Callers use it exactly like
 * `isDbConfigured()` — data modules already fall back to seed content.
 */
export function dbUsable(): boolean {
  return isDbConfigured() && reachable !== false;
}

/** True when Supabase credentials are present (used for graceful demo mode). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Unique violation from Postgres — used to return friendly "already exists" errors. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
