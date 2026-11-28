"use client";

/**
 * Recovery from a stale-chunk error.
 *
 * WHY THIS EXISTS SEPARATELY FROM `components/pwa-register.tsx`
 *   That file watches the first few seconds after boot, which catches almost
 *   every case. This one is the safety net for the rest: a chunk can also fail
 *   later (a lazy route, the ring showcase's images, a click that pulls in a
 *   dynamic import) if a worker or an HTTP cache is still holding the previous
 *   build. When the error reaches an error boundary we can see its message, so
 *   we can be certain rather than speculative — and only then do we unregister
 *   workers, drop caches and reload.
 *
 * `sessionStorage` guards it to ONE recovery per build: a genuine bug that
 * happens to look like a chunk error must not turn into a reload loop.
 *
 * ⚠️ THE GUARD MUST NOT BECOME A DEAD END
 *   It used to. The error boundary hid every button the moment it called this,
 *   and when the guard said "already tried for this build" nothing reloaded —
 *   so the visitor was left on "এক মুহূর্ত… পৃষ্ঠাটি নিজে থেকেই রিফ্রেশ হচ্ছে"
 *   with no refresh coming and nothing to tap. That is the screenshot in the
 *   bug report, on a phone where every page was stuck.
 *
 *   Hence the boolean return is not decoration: the caller renders the
 *   refreshing state ONLY when a reload is actually under way. `force` is the
 *   visitor tapping a button, which is a deliberate request and must never be
 *   silently dropped.
 */

const RECOVERY_KEY = "ba_sw_recovery";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Messages browsers and bundlers use when a chunk cannot be loaded. */
const CHUNK_ERROR =
  /ChunkLoadError|Loading chunk [\w.-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|MIME type of ["']?text\/html/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

/**
 * Clear every cached build artefact and reload.
 *
 * Returns true when a reload was started (the page is going away, the caller
 * should show the "refreshing" state), false when it was skipped because this
 * build already used its one automatic attempt.
 *
 * @param force the visitor asked for it — skip the once-per-build guard.
 */
export async function recoverFromStaleChunks(force = false): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (!force && window.sessionStorage.getItem(RECOVERY_KEY) === BUILD_ID) return false;
    window.sessionStorage.setItem(RECOVERY_KEY, BUILD_ID);
  } catch {
    // No storage ⇒ no loop protection ⇒ do not reload automatically.
    if (!force) return false;
    /* A forced recovery still reloads: with storage blocked a reload loop is
       theoretically possible, but the visitor asked for it and the alternative
       is leaving them stuck on an error page with a dead button. */
  }

  /* Deleting a Cache is asynchronous and postMessage to a worker is not
     observable; a stuck worker can therefore survive the cleanup below and
     answer the next navigation with the previous build — the exact loop this
     function exists to break. A hard reload (`location.reload()` with no
     argument is allowed to be served from the HTTP cache) does not guarantee a
     network round trip, so the reload carries a cache-busting marker. The
     service worker bypasses nothing for navigations and always goes to the
     network, so the marker is only for the browser's own cache. */
  const go = () => {
    const url = new URL(window.location.href);
    // Strip any previous marker so the URL does not grow on every recovery.
    url.searchParams.delete("_r");
    url.searchParams.set("_r", Date.now().toString(36));
    window.location.replace(url.toString());
  };

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {
    /* the reload below still helps */
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* the reload below still helps */
  }

  go();
  return true;
}

/**
 * Last-resort cleanup with no reload — for the error page's own "clear and
 * reload" button, so a visitor holding a stale worker can fix it themselves
 * even when the automatic attempt was already spent.
 */
export async function clearBuildCacheAndReload(): Promise<void> {
  await recoverFromStaleChunks(true);
}
