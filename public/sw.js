/* ============================================================================
   বিশ্বাস এগ্রো — service worker
   ----------------------------------------------------------------------------
   Deliberately conservative:
     • NEVER cache API responses (prices, stock and orders must be live)
     • NEVER cache live-stream manifests or segments
     • stale-while-revalidate for static assets and images
     • network-first with an offline page for navigations
   Cache version is bumped by hand on every deploy that changes shell assets.
   ========================================================================== */

const VERSION = "ba-v2";
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const OFFLINE_URL = "/offline";

const PRECACHE = ["/", OFFLINE_URL, "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Best-effort: a failed precache must not block activation.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** Anything that must never be cached. */
function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    // gateway redirects & auth flows
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/payment")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only (except images on the Supabase CDN, handled below).
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !url.hostname.endsWith(".supabase.co")) return;
  if (isBypassed(url)) return;

  // ---- navigations: network first, offline page as the safety net ----
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  // ---- images: cache first, then network ----
  if (request.destination === "image") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(IMAGE_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // ---- static build assets: stale-while-revalidate ----
  if (url.pathname.startsWith("/_next/static/") || /\.(css|js|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});

/* --------------------------------------------------------------- push */

self.addEventListener("push", (event) => {
  let payload = { title: "বিশ্বাস এগ্রো", body: "", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      dir: "ltr",
      lang: "bn-BD",
      tag: payload.tag || "ba-notification",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })()
  );
});
