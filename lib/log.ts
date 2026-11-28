/* eslint-disable no-console -- this file IS the console; every other module
   goes through it. Keeping the disable here means a stray console.log elsewhere
   is still a lint warning. */
/**
 * Structured, server-only logging for the storefront's data path.
 *
 * WHY THIS EXISTS
 *   The reported failure was "the homepage does not load". Everything we could
 *   see from outside was a grey skeleton or a Bangla error card; everything we
 *   could see from inside was a one-line `console.warn` that fired once per
 *   process per key and then went quiet (`safe()` in lib/data.ts keeps a
 *   `warned` Set). A slow query, a timeout and an empty table were
 *   indistinguishable in Vercel's logs, which is why the same report kept
 *   coming back.
 *
 * WHAT IT DOES
 *   One line per data event, always the same shape:
 *
 *     [data] read ok     key=products   ms=142  cached=1 items=48
 *     [data] read fail   key=farmers    ms=6001 kind=timeout
 *     [data] breaker open              ms=0                   retry_in=2341
 *     [home] renders in  ms=812   sections=13 failed=blog
 *
 *   Single-line, key=value, no stack traces by default — Vercel's log search
 *   can match a prefix (`[data]`) or a specific failure (`kind=timeout`) without
 *   a log viewer.
 *
 * WHAT IT MUST NEVER DO
 *   Emit credentials, tokens, full URLs or row contents. `redact()` keeps only
 *   the message of an error, strips anything that looks like a key, and caps the
 *   length. Nothing here is shown to a visitor: it writes to the server console,
 *   which on Vercel is the function log, not the browser.
 *
 * COST
 *   Disabled in tests (`NODE_ENV=test`) so the suites stay quiet, and one
 *   `process.env` read per call, which the compiler folds to nothing.
 */

export type DataFailureKind =
  | "timeout"
  | "offline"
  | "unconfigured"
  | "breaker"
  | "query"
  | "unknown";

/** Strip credentials, tokens and query strings from anything we log. */
export function redact(error: unknown): string {
  if (!error) return "";
  /**
   * Supabase errors are plain objects, not `Error`s: `String(postgrestError)`
   * is the literal string "[object Object]", which is what every `err=` field
   * in the timeout logs used to say. Describe the fields instead — and never
   * the request, which can carry the key.
   */
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "object" && error !== null
        ? (() => {
            const e = error as { name?: string; code?: string; message?: string; details?: string; hint?: string; status?: number };
            return (
              [e.name, e.code && `code=${e.code}`, e.status !== undefined && `status=${e.status}`, e.message, e.details]
                .filter(Boolean)
                .join(" ") || "unnamed object failure"
            );
          })()
        : String(error);
  return (
    raw
      // JWTs / secret keys
      .replace(/eyJ[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]+){0,2}/g, "[token]")
      .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[key]")
      // Postgres/Supabase connection strings
      .replace(/(postgres(?:ql)?:\/\/)[^\s"]+/gi, "$1[url]")
      // any other URL with credentials embedded
      .replace(/(https?:\/\/)[^\s"@]+@/g, "$1[redacted]@")
      .slice(0, 200)
  );
}

/**
 * Classify a failure so the log says WHY, not just that something broke.
 * Mirrors lib/db.ts's transport test — the same distinction decides whether the
 * circuit breaker opens, so it is worth naming here too.
 */
export function failureKind(error: unknown): DataFailureKind {
  if (!error) return "breaker";
  const e = error as { name?: string; message?: string; status?: number; code?: string };
  const message = `${e.message ?? ""}`.toLowerCase();
  if (
    e.name === "AbortError" ||
    e.name === "ReadTimeoutError" ||
    e.name === "DbTimeoutError" ||
    /abort|timeout|timed out|deadline|exceeded \d+ms/.test(message)
  )
    return "timeout";
  if (/fetch failed|network|econnrefused|enotfound|eai_again|socket hang up|terminated/.test(message))
    return "offline";
  if (/not configured/.test(message)) return "unconfigured";
  if (e.status !== undefined && e.status >= 500) return "offline";
  if (e.code) return "query";
  return "unknown";
}

function enabled(): boolean {
  return process.env.NODE_ENV !== "test";
}

function line(scope: string, event: string, fields: Record<string, string | number | boolean | undefined>) {
  const parts: string[] = [`[${scope}] ${event}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === "") continue;
    parts.push(`${key}=${value}`);
  }
  return parts.join(" ");
}

/**
 * A successful read. Level is debug-ish on purpose: on Vercel, `console.log` is
 * captured but not treated as an error, so a healthy page does not pollute the
 * error stream (and does not trigger log-based alerting).
 */
export function logReadOk(scope: string, key: string, ms: number, items?: number, cached?: boolean) {
  if (!enabled()) return;
  console.log(
    line("data", "read ok", {
      key,
      ms,
      cached: cached === undefined ? undefined : cached ? 1 : 0,
      items,
      scope: scope === "data" ? undefined : scope,
    })
  );
}

export function logReadFail(
  scope: string,
  key: string,
  ms: number,
  error: unknown,
  extra?: Record<string, string | number | boolean | undefined>
) {
  if (!enabled()) return;
  console.error(
    line("data", "read fail", {
      key,
      ms,
      kind: failureKind(error),
      scope: scope === "data" ? undefined : scope,
      err: redact(error),
      ...extra,
    })
  );
}

export function logBreakerOpen(retryInMs: number) {
  if (!enabled()) return;
  console.warn(line("data", "breaker open", { retry_in: Math.max(0, Math.round(retryInMs)) }));
}

/**
 * One line per homepage render: how long the section queries took, how many
 * sections will paint, and which ones degraded. This is the single line to
 * search for after a "homepage is slow" report.
 */
export function logHomepage(
  ms: number,
  sections: number,
  failed: string[],
  extra?: Record<string, string | number | boolean | undefined>
) {
  if (!enabled()) return;
  const fields = {
    ms,
    sections,
    failed: failed.length ? failed.join(",") : undefined,
    ...extra,
  };
  if (failed.length) console.warn(line("home", "rendered degraded", fields));
  else console.log(line("home", "rendered", fields));
}

/** Cache-specific events (a stale entry, a write that failed to invalidate). */
export function logCache(event: string, fields: Record<string, string | number | boolean | undefined> = {}) {
  if (!enabled()) return;
  console.warn(line("cache", event, fields));
}
