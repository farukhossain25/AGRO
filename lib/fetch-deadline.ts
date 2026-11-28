/**
 * A deadline for every Supabase round-trip on the server.
 *
 * WHY THIS EXISTS
 *   The header, footer and page body all render together in one React tree, so
 *   a single slow query stalls everything — including the chrome the visitor
 *   should already be looking at. The reported symptom is exactly that: the
 *   route-level skeleton sits there forever.
 *
 *   `lib/db.ts` (the service-role client) has had a timeout for a while. The
 *   TWO clients in `lib/supabase/server.ts` did not — the cookie-bound one used
 *   by `auth.getUser()`, and the admin one. Those are the calls on the critical
 *   path of every single request: middleware validates the session, the layout
 *   validates it again, then reads the profile row. If Supabase is slow — a
 *   cold project, a paused free-tier database waking up, a network hiccup to
 *   the region — the request waits on the platform default, which is minutes.
 *
 *   A page that gives up in 6 seconds and renders the signed-out header is
 *   infinitely better than a page that shows a skeleton until the visitor
 *   leaves.
 *
 * WHY A TIMEOUT IS SAFE HERE
 *   Every read on this path already degrades: `lib/data.ts` returns an empty
 *   state, `getSessionUser` returns null, the settings readers fall back to
 *   defaults. None of them throw to the customer. So aborting the fetch just
 *   picks the degraded branch sooner — it does not invent a new failure mode.
 *
 * ⚠️ IT MUST BE ABOVE THE WRITE PATHS
 *   An abort on a *write* is ambiguous: the server may have committed after the
 *   client gave up. That is why the mutation routes use `dbDynamic()` and the
 *   service-role client, and why this timeout is generous rather than tight —
 *   it is here to stop a hang, not to enforce a latency budget.
 */

/** Milliseconds before a server-side Supabase fetch is aborted. */
export const SUPABASE_FETCH_TIMEOUT_MS = Number(process.env.SUPABASE_SERVER_TIMEOUT_MS ?? 6000);

/**
 * Wrap `fetch` so any request without its own signal gets a deadline.
 * A caller-supplied signal still wins (both abort the request).
 */
export function withDeadline(
  timeoutMs = SUPABASE_FETCH_TIMEOUT_MS
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("supabase fetch timed out")), timeoutMs);

    const signal = init?.signal;
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }

    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

/**
 * The storefront shell's own budget — deliberately shorter than the client
 * deadline below.
 *
 * The layout wraps every page, so its awaits delay the whole document. On a
 * healthy database the shell is one warm round-trip and this never fires; on a
 * slow one it degrades the header to its defaults and lets the page through.
 * Keeping it below `SUPABASE_FETCH_TIMEOUT_MS` means the shell settles from its
 * own fallback first, instead of waiting for each nested fetch to abort.
 */
export const SHELL_TIMEOUT_MS = Number(process.env.SUPABASE_SHELL_TIMEOUT_MS ?? 2000);

/**
 * Race a promise against a deadline. For reads whose SDK call cannot take a
 * signal — `auth.getUser()` builds its own request — this is the only way to
 * put a ceiling on it.
 *
 * Resolves `fallback` on timeout rather than rejecting: the caller is a page
 * render, and "show the signed-out chrome" beats "show nothing".
 */
export function withDeadlineFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = SUPABASE_FETCH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const done = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => done(fallback), timeoutMs);

    promise.then(done, () => done(fallback));
  });
}

/**
 * The storefront layout's wrapper: `withDeadlineFallback` on the shell's own,
 * shorter budget. Named separately so the call site reads as what it is — "the
 * chrome has two seconds, then defaults" — rather than as a generic race.
 */
export function withShellDeadline<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return withDeadlineFallback(promise, fallback, SHELL_TIMEOUT_MS);
}
