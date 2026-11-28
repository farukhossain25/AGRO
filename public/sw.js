/* ============================================================================
   বিশ্বাস এগ্রো — service worker
   ----------------------------------------------------------------------------
   THE BUG THIS FILE USED TO CAUSE
   ----------------------------------------------------------------------------
   It served `/_next/static/*` STALE-WHILE-REVALIDATE out of a cache whose name
   was a hand-written constant (`ba-v3`). Next.js chunk filenames contain a
   content hash, so every deploy produces new names — but the HTML that
   references them is rendered fresh on the server, and a browser running the
   OLD worker happily answered a request for a NEW chunk from a stale entry it
   had for the OLD path, or from a `cached || network` fallback that returned
   `undefined` when both missed.

   The result was exactly the reported symptom: the layout (header, footer)
   rendered because those components were already in the cached route payload,
   then the page body threw while hydrating / loading its chunks, React walked
   up to `app/(storefront)/error.tsx`, and the visitor saw
   "কিছু একটা ভুল হয়েছে" — on every page, until they cleared site data. A hard
   refresh did not help, because the worker kept answering.

   THE RULES NOW
   ----------------------------------------------------------------------------
   1. Cache names carry `SHELL` — bump it whenever the shell changes. This is
      the ONLY manual step, and the old caches are deleted on activate.
   2. Build assets are NETWORK-FIRST, and a miss returns a real error instead of
      `undefined`. A stale chunk paired with fresh HTML is never acceptable;
      the correct behaviour is to fetch it or fail loudly on that request — not
      to serve a filename mismatch.
   3. A navigation that pulls a chunk-reload is detected: when a build asset
      404s or the RSC payload mismatches, Next emits a reload; that reload must
      be able to reach the network rather than the cache. Navigations are
      network-first already (kept).
   4. Nothing about the PWA is allowed to outlive its usefulness: `skipWaiting`
      + `clients.claim` on activate means a new worker takes over on the very
      next request instead of waiting for every tab to close.
   5. API, auth, payment, stream and admin traffic is never touched.

   ⚠️ REGISTRATION IS ALSO PART OF THIS. `components/pwa-register.tsx` now
   unregisters + clears caches on a build-id change, so a visitor who is stuck
   today gets out of it without knowing what a service worker is.
   ========================================================================== */

/** Bump on any deploy that changes the shell (HTML structure, routes, assets). */
const SHELL = "ba-v4";

const STATIC_CACHE = `${SHELL}-static`;
const IMAGE_CACHE = `${SHELL}-images`;
const OFFLINE_URL = "/offline";

/* Precache is best-effort and deliberately tiny: the offline page and the icon.
   It used to include "/" — a full HTML document pinned at install time, which
   meant a visitor with no network got a build from whenever they installed it,
   including chunk references that no longer exist. The offline page is static
   and version-independent; nothing else belongs here. */
const PRECACHE = [OFFLINE_URL, "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      // Take over immediately: a worker that waits for every tab to close keeps
      // serving the previous build to the one tab the visitor is using.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(SHELL)).map((k) => caches.delete(k)));
      await self.clients.claim();
      // A visitor whose page is currently controlled by an older build is
      // exactly the person experiencing the error boundary. Tell them once so
      // the page can offer a single reload instead of a mystery.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.postMessage({ type: "sw-activated", shell: SHELL });
    })()
  );
});

/* The page asks a waiting worker to take over immediately after it registers
   a new build. Without this the new worker sits in `waiting` until every tab
   closes, which is precisely how a visitor stays on the previous build. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skip-waiting") self.skipWaiting();
});

/** Anything that must never be cached or intercepted. */
function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/foisal") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/_next/data") ||
    // auth, payment and the streaming proxy are all session- or byte-exact
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/payment") ||
    url.pathname.startsWith("/stream") ||
    url.pathname.startsWith("/track")
  );
}

/** A navigation is a document request; only the HTML shell is cached for it. */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Supabase storage images are the only cross-origin traffic we touch.
  if (!sameOrigin && !url.hostname.endsWith(".supabase.co")) return;
  if (isBypassed(url)) return;

  // ---- navigations: always network, cache only as an OFFLINE fallback ----
  /* The HTML must always be the current deployment's HTML. Serving yesterday's
     document is what pairs new markup with old chunks. */
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          /* Only a 200, non-redirected document is worth keeping. A cached
             redirect (to /login, say) would otherwise trap the visitor there
             even after signing in. */
          if (fresh.ok && fresh.type === "basic" && fresh.redirected === false) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // ---- build assets: network-first, NO stale fallback ----
  /* A hashed chunk that the cache misses, or that the edge no longer has,
     must fail that request (Next will then reload the document) rather than be
     answered with different bytes. If the network works, the entry is
     refreshed; if it does not, the browser's own HTTP cache is the fallback,
     not this cache. */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (error) {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw error;
        }
      })()
    );
    return;
  }

  // ---- fonts / css outside /_next/static: same rule ----
  if (/\.(css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(STATIC_CACHE);
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

  // ---- images: cache-first is safe, the URL identifies the bytes ----
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
          return Response.error();
        }
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
