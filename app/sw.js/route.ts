import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ==========================================================================
   The service worker's cache name is derived from the build, not typed by hand
   --------------------------------------------------------------------------
   `public/sw.js` used to carry a hand-written `const SHELL = "ba-v4"`. Its own
   comment says "bump it on any deploy that changes the shell" — which is
   exactly the kind of instruction that gets skipped, and one deploy's worth of
   skipped bump is enough to serve the previous build's HTML and chunks to a
   phone that already has the worker installed. The visitor then sees the error
   boundary ("কিছু একটা ভুল হয়েছে") on every page until site data is cleared.

   The PWA is now served through a route handler that rewrites one placeholder
   with the deployment's build id (the same value `next.config.ts` exposes as
   NEXT_PUBLIC_BUILD_ID, so the page and the worker always agree about which
   build they belong to). Because `SHELL` changes, `activate` deletes every old
   cache, and the browser sees a byte-different `sw.js` and installs it.

   Cache headers are set here rather than in next.config's `headers()`, because
   `headers()` matches the SOURCE path (`/sw.js`) and this request is answered
   by the route (`/sw.js` is rewritten to it) — one owner per header, so the
   worker can never arrive with a stale `max-age`.
   ========================================================================== */

/* Read once per process. The file is a plain static asset inside the repo and
   never changes at runtime, so there is no reason to hit the disk per request
   (and Vercel would run this on every worker fetch otherwise). */
const SOURCE = readFileSync(join(process.cwd(), "app", "sw.js", "sw.js"), "utf8");

/**
 * The deployment identity — the SAME value the client bundle carries.
 *
 * `next.config.ts` inlines NEXT_PUBLIC_BUILD_ID into the client at build time,
 * so a route that recomputes it at request time can disagree with the page.
 * It did: the fallback was a timestamp, `next start` re-evaluated the config,
 * and the worker's id came out different from the bundle's. The PWA compares
 * the two on every load and would have reloaded in a loop.
 *
 * Order of truth:
 *   1. NEXT_PUBLIC_BUILD_ID — the runtime env Next loaded from the build
 *   2. .next/build-id      — written by the build itself
 *   3. "dev"
 */
function buildId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BUILD_ID;
  if (fromEnv) return fromEnv;

  try {
    const stamped = readFileSync(join(process.cwd(), ".next", "build-id"), "utf8").trim();
    if (stamped) return stamped;
  } catch {
    /* fall through */
  }

  return (
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev"
  );
}

export const dynamic = "force-static";
export const revalidate = 0;

export function GET() {
  const id = buildId();
  const body = SOURCE.replaceAll("__BUILD_ID__", id);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      /* Must revalidate on every navigation: a cached `sw.js` is a worker that
         can never learn a new build exists. */
      "cache-control": "public, max-age=0, must-revalidate",
      "service-worker-allowed": "/",
      "x-content-type-options": "nosniff",
    },
  });
}
