"use client";

import { useEffect } from "react";

/* ==========================================================================
   Service-worker registration
   --------------------------------------------------------------------------
   • only in production builds (a dev SW caches HMR chunks and fights you)
   • never registers inside the Capacitor shell (file:// has no SW support)
   • updates are applied silently on the next navigation
   ========================================================================== */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }
}

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    if (window.Capacitor?.isNativePlatform?.()) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Look for a new deploy on every load and quietly activate it.
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                // eslint-disable-next-line no-console
                console.info("[pwa] new version ready — reload to apply");
              }
            });
          });
        })
        .catch((error) => console.warn("[pwa] service worker registration failed:", error));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
