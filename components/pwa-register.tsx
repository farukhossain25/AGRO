"use client";

import { useEffect } from "react";

/* ==========================================================================
   Service-worker registration
   --------------------------------------------------------------------------
   • only in production builds (a dev SW caches HMR chunks and fights you)
   • never registers inside the Capacitor shell (file:// has no SW support)

   THE PART THAT MATTERS: GETTING A STUCK VISITOR OUT
   --------------------------------------------------------------------------
   The worker in `public/sw.js` used to serve build chunks out of a cache named
   by a hand-written constant. After a deploy the HTML was new but the chunks
   were the previous build's, so React failed while hydrating and every page
   showed "কিছু একটা ভুল হয়েছে" until site data was cleared by hand. A hard
   refresh did not help — the worker answered before the network did.

   Two safeguards live here, because the worker alone cannot rescue a browser
   that is already running the broken version:

     1. BUILD ID WATCH — `NEXT_PUBLIC_BUILD_ID` (next.config.ts falls back to
        Vercel's commit SHA, then to a timestamp) is compared with the last one
        this browser saw. A change means a new deployment: unregister every
        worker, delete every cache, and reload once. That is a one-time cost per
        deploy for users who have the PWA installed, and it guarantees they are
        never a chunk version behind.

     2. RECOVERY ON ERROR — if the app throws during the first few seconds and
        a worker is controlling the page, the most likely cause is exactly this
        class of mismatch. We do the same cleanup and reload once (guarded by
        sessionStorage so a genuine bug cannot become a reload loop). The
        error boundary stays the last resort instead of the first responder.

   Registration itself now waits for `load`, asks for `updateViaCache: "none"`
   so `sw.js` is re-fetched from the network rather than HTTP-cached, and
   activates a waiting worker immediately.
   ========================================================================== */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

const BUILD_KEY = "ba_build_id";
const RECOVERY_KEY = "ba_sw_recovery";

/** The deployment this page was built for. Regenerated on every build. */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

async function purgeEverything() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
  }
  if ("caches" in window) {
    const keys = await caches.keys().catch(() => [] as string[]);
    await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
  }
}

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Dev builds must never register: HMR chunks are not content-hashed.
    if (process.env.NODE_ENV !== "production") return;
    if (window.Capacitor?.isNativePlatform?.()) return;

    /* ── 1. a new deployment invalidates every worker and cache ─────────── */
    let lastSeen: string | null = null;
    try {
      lastSeen = window.localStorage.getItem(BUILD_KEY);
      window.localStorage.setItem(BUILD_KEY, BUILD_ID);
    } catch {
      /* storage blocked — fall through to the normal registration path */
    }

    if (lastSeen && lastSeen !== BUILD_ID) {
      // One reload per deploy. `purgeEverything` is awaited before it so the
      // next request is guaranteed to come from the network.
      void purgeEverything().then(() => {
        window.location.reload();
      });
      return;
    }

    /* ── 2. an error right after boot with a worker in control = mismatch ─ */
    const onEarlyError = () => {
      if (!navigator.serviceWorker.controller) return;
      try {
        if (window.sessionStorage.getItem(RECOVERY_KEY) === BUILD_ID) return;
        window.sessionStorage.setItem(RECOVERY_KEY, BUILD_ID);
      } catch {
        return;
      }
      void purgeEverything().then(() => window.location.reload());
    };
    const timer = window.setTimeout(() => {
      // After the app is interactive, an error is a real bug, not a stale chunk.
      window.removeEventListener("error", onEarlyError);
    }, 8000);
    window.addEventListener("error", onEarlyError);
    window.addEventListener("unhandledrejection", onEarlyError);
    // A chunk that fails to load arrives as a resource error, which does not
    // fire on `window` — this listener is added in the capture phase below.

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          /* A worker that is installed but waiting will not take over until
             every tab closes; that is the state that keeps serving the old
             build. Activate it now. */
          registration.waiting?.postMessage({ type: "skip-waiting" });
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "activated" && navigator.serviceWorker.controller) {
                // A fresh worker is now in control; one reload applies it.
                try {
                  if (window.sessionStorage.getItem(RECOVERY_KEY) === BUILD_ID) return;
                  window.sessionStorage.setItem(RECOVERY_KEY, BUILD_ID);
                } catch {
                  return;
                }
                window.location.reload();
              }
            });
          });
        })
        .catch((error) => console.warn("[pwa] service worker registration failed:", error));
    };

    /* Chunk-load failures surface as `error` events on the <script> element and
       do not bubble; capture gets them anyway. This is the exact signature of a
       stale-chunk mismatch, so it uses the same recovery. */
    const onResourceError = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== "SCRIPT") return;
      const src = (target as HTMLScriptElement).src || "";
      if (!src.includes("/_next/static/")) return;
      onEarlyError();
    };
    window.addEventListener("error", onResourceError, true);

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", onEarlyError);
      window.removeEventListener("unhandledrejection", onEarlyError);
      window.removeEventListener("error", onResourceError, true);
    };
  }, []);

  return null;
}
