import { beginDbProbe, db, dbProbeDue, dbUsable, endDbProbe, markDbReachable, markDbUnreachable } from "./db";
import { logReadFail, logReadOk } from "./log";

/**
 * One bounded read. Used by every server module that talks to Supabase.
 *
 * ==========================================================================
 * WHY THIS FILE EXISTS, AND WHAT IT FIXES
 * ==========================================================================
 *
 * A `Promise.race([query, timer])` is NOT a deadline. When the timer wins, the
 * query is still in flight — it keeps its socket open until `lib/db.ts`'
 * 8 s fetch timeout, rejects, and the Node server cannot finish the response
 * until that work is done. Measured on a stalling host with races in place:
 *
 *     [data] read fail key=faq_items ms=39042 kind=timeout
 *     [home] rendered ms=39049
 *
 * The page had "given up" after 4 s and still took 39 s to send a byte. The
 * logs said timeout; the visitor said grey screen. Two different clocks.
 *
 * `lib/db.ts` already aborts its own fetch on a deadline; what was missing was
 * one mechanism everyone could use, so every module did its own thing —
 * `lib/data.ts` raced a promise, `lib/content.ts` raced a promise, `lib/cms.ts`
 * had nothing, `lib/sellers.ts` had nothing, `lib/site-settings.ts` had nothing.
 *
 * THE CONTRACT
 *   `withReadDeadline` passes an AbortSignal into the read. A query builder
 *   given `.abortSignal(signal)` is cancelled when the deadline fires, so the
 *   socket closes, the failure is a transport failure, the breaker opens, and
 *   the server is free to render. If a caller cannot honour the signal (an SDK
 *   helper that builds its own request), the race still bounds the caller — the
 *   signal is best-effort by design, the bound is not.
 *
 * WHAT IT DOES ON FAILURE
 *   Never throws. A page render must degrade, not crash:
 *     • the circuit breaker is opened, so concurrent and subsequent reads are
 *       free instead of each paying the full budget;
 *     • the fallback is returned;
 *     • one structured line is written (lib/log.ts) with the duration and a
 *       failure kind, which is what was missing from every past report.
 */

/** Milliseconds a single read may take before it is abandoned and aborted. */
export const READ_TIMEOUT_MS = Number(process.env.SUPABASE_READ_TIMEOUT_MS ?? 4000);

export type ReadOutcome<T> = { value: T; ok: boolean };

/** Thrown inside the read when the deadline fires; recognised by name (see below). */
export class ReadTimeoutError extends Error {
  constructor(readonly key: string, readonly timeoutMs: number) {
    super(`read "${key}" exceeded ${timeoutMs}ms`);
    this.name = "ReadTimeoutError";
  }
}

/**
 * ⚠️ NAME CHECK, NOT `instanceof`.
 * Next compiles each route entrypoint separately, so this module can exist
 * twice in one server process. A class from one copy is not an instance of the
 * "same" class from the other, and `instanceof` silently returns false — which
 * is how a deadline that fired failed to open the breaker. A `name` is stable
 * across copies; the class identity is not.
 */
export function isReadTimeout(error: unknown): boolean {
  return (error as { name?: string } | undefined)?.name === "ReadTimeoutError";
}

/**
 * Run `read` with a signal and a deadline.
 *
 * @param scope  log scope — "data", "content", "cms", "settings"
 * @param key    what is being read, for the log line
 * @param read   receives an AbortSignal; pass it to `.abortSignal(signal)`
 * @param fallback returned on failure (never a throw)
 */
export async function withReadDeadline<T>(
  scope: string,
  key: string,
  read: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  timeoutMs = READ_TIMEOUT_MS
): Promise<T> {
  const { value } = await readWithOutcome(scope, key, read, fallback, timeoutMs);
  return value;
}

/**
 * Is the read worth attempting right now?
 *
 * Three states, and the distinction is the whole reason pages stay fast when
 * Supabase does not:
 *
 *   closed    → yes, read normally
 *   open      → no, serve the fallback from memory (free)
 *   half-open → no, serve the fallback now and probe in the background — the
 *               visitor must not wait for the diagnosis. See `lib/db.ts`.
 */
function shouldRead(): boolean {
  if (dbUsable()) return true;
  if (dbProbeDue() && beginDbProbe()) void probe();
  return false;
}

/**
 * One tiny round-trip, off the render path. Success closes the breaker;
 * failure re-opens it for another window. Never throws, always releases the
 * slot, and never blocks a request.
 */
async function probe(): Promise<void> {
  try {
    await readWithOutcome(
      "db",
      "probe",
      async (signal) => {
        const client = db();
        const { error } = await client.from("site_settings").select("key").limit(1).abortSignal(signal);
        /* PostgREST reports a network failure as `{ error }`, not a throw.
           Treating it as success is how the breaker used to close itself while
           the database was still gone — `read ok key=announcement ms=4004` in
           the logs was this exact misreport. */
        if (error) throw error;
        return true;
      },
      false,
      /* A health check, not a data read: it must be quicker than a page. */
      Math.min(READ_TIMEOUT_MS, 2500),
      true
    );
    /* `markDbReachable` runs inside `timeoutFetch`; success above is enough. */
    void markDbReachable;
  } finally {
    endDbProbe();
  }
}

/** Same, but tells the caller whether the read actually succeeded. */
export async function readWithOutcome<T>(
  scope: string,
  key: string,
  read: (signal: AbortSignal) => Promise<T>,
  fallback: T,
  timeoutMs = READ_TIMEOUT_MS,
  /** internal: the probe must be allowed to run while the breaker is half-open */
  isProbe = false
): Promise<ReadOutcome<T>> {
  /* Do not open a socket to a database we know is gone. Free fallback. */
  if (!isProbe && !shouldRead()) {
    logReadFail(scope, key, 0, null, { kind: "breaker" });
    return { value: fallback, ok: false };
  }

  const controller = new AbortController();
  const started = Date.now();

  const timer = setTimeout(() => {
    /* Order matters: mark the breaker BEFORE aborting, so the rejection the
       abort causes is already classified as a transport failure and any read
       that starts during the unwind sees `dbUsable() === false`. */
    markDbUnreachable(new ReadTimeoutError(key, timeoutMs));
    controller.abort(new ReadTimeoutError(key, timeoutMs));
  }, timeoutMs);

  try {
    const value = await read(controller.signal);
    /**
     * AN ABORT IS A FAILURE, EVEN IF THE SDK RESOLVED.
     *
     * PostgREST does not throw when its fetch is aborted — it resolves
     * `{ data: null, error: {...} }`. A read that reported `ok` with no rows
     * therefore looked successful: the breaker stayed closed and the next
     * render paid the whole budget again. This one line is why the logs used to
     * say `read ok key=announcement ms=4004` on a dead database.
     */
    if (controller.signal.aborted) {
      const reason = controller.signal.reason instanceof Error ? controller.signal.reason : new ReadTimeoutError(key, timeoutMs);
      logReadFail(scope, key, Date.now() - started, reason);
      return { value: fallback, ok: false };
    }
    logReadOk(scope, key, Date.now() - started, Array.isArray(value) ? value.length : undefined);
    return { value: value ?? fallback, ok: true };
  } catch (error) {
    /* The abort may surface as the reason or as a generic AbortError depending
       on how far the request got; both are the deadline firing. */
    if (controller.signal.aborted) markDbUnreachable(error ?? new ReadTimeoutError(key, timeoutMs));
    else markDbUnreachable(error);
    logReadFail(scope, key, Date.now() - started, error);
    return { value: fallback, ok: false };
  } finally {
    clearTimeout(timer);
  }
}
