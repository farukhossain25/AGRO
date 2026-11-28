import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { logBreakerOpen, logReadFail } from "./log";

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — every call site MUST authorise the caller first.
 */
let adminClient: SupabaseClient<Database> | null = null;

/**
 * Every server-side query gets a hard deadline.
 *
 * Without this, one unreachable Supabase call stalls the whole render and the
 * page ships with an empty section. Callers already degrade gracefully on
 * errors, so a fast failure is the right outcome: the page still paints and the
 * fallback content appears. 8s is far above a healthy round-trip (p99 ≈ 200ms).
 */
export const DB_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS ?? 8000);

/**
 * Aborts at the deadline and says so.
 *
 * `controller.abort()` with no argument makes the SDK report a bare
 * "AbortError" — indistinguishable in a log (and in `failureKind`) from the
 * browser cancelling a navigation. Passing a reason gives every timeout the
 * same, recognisable signature, which is what lets lib/log.ts report
 * `kind=timeout` instead of `kind=unknown`.
 */
export class DbTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`supabase request exceeded ${timeoutMs}ms`);
    this.name = "DbTimeoutError";
  }
}

const timeoutFetch: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DbTimeoutError(DB_TIMEOUT_MS)), DB_TIMEOUT_MS);

  // respect a caller-supplied signal as well
  if (init?.signal) {
    if (init.signal.aborted) controller.abort(init.signal.reason);
    else init.signal.addEventListener("abort", () => controller.abort(init.signal?.reason), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal })
    .then((response) => {
      markDbReachable();
      return response;
    })
    .catch((error) => {
      markDbUnreachable(error);
      throw error;
    })
    .finally(() => clearTimeout(timer));
};

/**
 * The server key, in the order the rest of the app already uses.
 *
 * Supabase renamed the service-role key to "secret key" (`sb_secret_…`), and
 * lib/env.ts accepted both from the start. This file did not: it read
 * SUPABASE_SERVICE_ROLE_KEY only, so a deployment configured the new way —
 * SUPABASE_SECRET_KEY set, the legacy name unset — left every call to db()
 * throwing "Supabase is not configured" while the public pages (which use
 * lib/env.ts) worked fine. Symptom: the site browsed normally but every panel
 * screen and every API mutation failed.
 */
export function serverSupabaseKey(): string {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function db(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverSupabaseKey();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY " +
        "(or the legacy SUPABASE_SERVICE_ROLE_KEY) in .env.local"
    );
  }

  adminClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "biswas-agro-server" }, fetch: timeoutFetch },
  });

  return adminClient;
}

/**
 * Circuit breaker — and why it is time-boxed.
 * --------------------------------------------------------------------------
 * A failed round-trip opens the breaker so the rest of the render does not burn
 * another 8 s per query. That part is fine.
 *
 * It used to stay open until some later request succeeded — but a process that
 * has already fallen back never retries, so one bad minute (a Vercel cold start
 * that could not resolve DNS, a transient 5xx from Postgres) left the whole
 * serverless instance serving EMPTY data indefinitely. Symptom: product cards
 * render, every /products/<slug> is a 404, sections vanish — while Supabase is
 * perfectly healthy again. That is exactly what happened in production.
 *
 * So the breaker now closes itself after a short probe window, and a successful
 * response closes it immediately.
 */
function probeAfterMs(): number {
  const raw = Number(process.env.SUPABASE_PROBE_AFTER_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 3000;
}

let unreachableUntil = 0;

/** A request genuinely reached the database. Always safe to call. */
export function markDbReachable() {
  unreachableUntil = 0;
}

/**
 * Called by data modules when a read fails. Production failures do NOT open the
 * breaker — most are row-level (a missing column, one bad filter) and every
 * other query still works. Only transport-level errors do, because those are
 * the ones that make each retry cost a full timeout.
 */
export function markDbUnreachable(error?: unknown) {
  if (!isTransportFailure(error)) return;
  const wasClosed = Date.now() >= unreachableUntil;
  unreachableUntil = Date.now() + probeAfterMs();
  /* Log the transition, not every failure: a render that issues eleven reads
     against a dead database would otherwise print eleven identical lines. */
  if (wasClosed) {
    logBreakerOpen(unreachableUntil - Date.now());
    logReadFail("db", "transport", 0, error, { breaker: "opened", probe_ms: probeAfterMs() });
  }
}

function isTransportFailure(error: unknown): boolean {
  const e = error as { code?: string; message?: string; name?: string; status?: number } | undefined;
  if (!e) return true; // no detail at all — assume the worst, the window is short
  const message = `${e.message ?? ""}`.toLowerCase();
  if (e.name === "AbortError" || /abort|timeout|timed out/.test(message)) return true;
  if (/fetch failed|network|econnrefused|enotfound|eai_again|socket hang up|terminated/.test(message))
    return true;
  // Supabase's own gateway codes for "the database is not answering"
  if (e.status !== undefined && e.status >= 500) return true;
  // Everything else is a query-level problem (42703 unknown column, 42P01 missing
  // table, PGRST errors about the request itself) — do not punish the whole app.
  return false;
}

/**
 * How long until the breaker lets a request through again (0 = closed).
 * Used by the read helpers to report `kind=breaker` without a fake timeout.
 */
export function dbRetryInMs(): number {
  return Math.max(0, unreachableUntil - Date.now());
}

/**
 * True when it is worth attempting a query: credentials exist AND the breaker
 * is fully closed.
 *
 * ⚠️ The half-open window does NOT count as usable. It used to (`Date.now() >=
 * unreachableUntil`), and that is a subtle performance bug: at the moment the
 * window elapses every arriving request sends real queries that then pay the
 * whole 4 s budget before failing. Measured as `/products 5528 ms`,
 * `/market 5527 ms` while every other page was 1.5 s. Recovery is the probe's
 * job now (see `dbProbeDue`) — a request never discovers the database is back
 * by waiting for it.
 */
export function dbUsable(): boolean {
  return isDbConfigured() && unreachableUntil === 0;
}

/**
 * HALF-OPEN, WITH A BACKGROUND PROBE.
 *
 * When `unreachableUntil` elapses, the database MAY be back — but we do not
 * know. The previous behaviour was "the next read goes through", and that is
 * wrong under load in a way that is easy to miss:
 *
 *   measured on a stalling host, eleven concurrent reads all saw the window
 *   elapsed at the same instant, all went through, and all waited out the full
 *   read budget. The document could not be sent until they settled, so every
 *   request cost seconds — 5.5 s per page, forever, long after the breaker had
 *   "done its job".
 *
 * So a half-open breaker probes in the BACKGROUND with one small query on a
 * short budget. Pages served during that window get their fallbacks
 * immediately; if the probe succeeds the breaker closes and the next request
 * reads real data. A visitor never pays for the diagnosis.
 */
let probeState: "idle" | "running" = "idle";

/** Breaker is open, its window has elapsed, and we have not looked yet. */
export function dbProbeDue(): boolean {
  return isDbConfigured() && unreachableUntil > 0 && Date.now() >= unreachableUntil;
}

/** Claim the single probe slot; false when one is already running. */
export function beginDbProbe(): boolean {
  if (probeState === "running") return false;
  probeState = "running";
  return true;
}

/** Release the slot. Always in `finally` — a stuck probe disables recovery. */
export function endDbProbe() {
  probeState = "idle";
}

/** True when Supabase credentials are present (used for graceful demo mode). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && serverSupabaseKey());
}

/**
 * Dynamic-table escape hatch for the generic admin CRUD route.
 *
 * That route resolves its table name from the URL (`/api/foisal/[resource]`),
 * so TypeScript cannot know which row shape is coming back. Everything else in
 * the app uses the typed `db()` client; this alias exists so ONE file can opt
 * out instead of every file losing its types.
 */
export function dbDynamic() {
  return db() as unknown as SupabaseClient;
}

/** Unique violation from Postgres — used to return friendly "already exists" errors. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
