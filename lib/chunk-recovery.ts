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
 */

const RECOVERY_KEY = "ba_sw_recovery";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Messages browsers and bundlers use when a chunk cannot be loaded. */
const CHUNK_ERROR = /ChunkLoadError|Loading chunk [\w.-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|MIME type of ["']?text\/html/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

/**
 * Returns true when a recovery reload was started — the caller should render
 * nothing special, the page is going away.
 */
export async function recoverFromStaleChunks(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (window.sessionStorage.getItem(RECOVERY_KEY) === BUILD_ID) return false;
    window.sessionStorage.setItem(RECOVERY_KEY, BUILD_ID);
  } catch {
    // No storage ⇒ no loop protection ⇒ do not reload automatically.
    return false;
  }

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

  window.location.reload();
  return true;
}
