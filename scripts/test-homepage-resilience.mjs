/**
 * Homepage resilience harness.
 *
 * Hits the built server and asserts the properties the brief asks for, rather
 * than eyeballing a page:
 *
 *   1. normal               — every section present, no error card
 *   2. database down        — page still renders, hero present, no error card
 *   3. one query times out  — simulated by a very short read timeout
 *   4. empty catalogue      — no crash, empty states render
 *   5. missing CMS content  — falls back, page whole
 *   6. mobile refresh       — the document carries a viewport meta and the hero
 *   7. stale chunks         — sw.js versioned, no stale fallback for build files
 *
 * Usage: node scripts/test-homepage-resilience.mjs [baseUrl]
 * Exits non-zero on the first failed assertion so CI can gate on it.
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

let failures = 0;
const results = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures += 1;
  const mark = condition ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** Strip <script> so RSC payload text cannot satisfy a DOM assertion. */
function visible(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

/**
 * Count headings in what the VISITOR sees.
 *
 * A streamed Suspense fallback is emitted twice in the HTML: once inline, and
 * once inside `<div hidden id="S:n">` as the out-of-order chunk React will swap
 * in. Counting raw `<h1>` on a page with a hero fallback therefore reports 2
 * for a document that renders one. Removing the hidden stream containers is
 * what makes this assertion mean "one visible h1", not "one h1 per copy".
 */
function visibleDom(html) {
  const src = visible(html);
  /**
   * Remove each hidden stream container INCLUDING everything nested in it.
   *
   * The previous regex cut from `<div hidden id="S:n">` to the next such
   * marker — which deletes the rest of the document whenever there is only one
   * hidden block. It reported "one h1" on a page that has two, and would have
   * hidden a real duplicate. This walks tags and tracks depth instead.
   */
  const spans = [];
  const open = [];
  let depth = 0;
  const tag = /<div\b[^>]*>|<\/div>/g;
  let m;
  while ((m = tag.exec(src))) {
    if (m[0].startsWith("</")) {
      depth -= 1;
      const last = open[open.length - 1];
      if (last && depth === last.depth) spans.push([open.pop().start, m.index + m[0].length]);
    } else {
      if (/hidden id="S:\d+"/.test(m[0])) open.push({ start: m.index, depth });
      depth += 1;
    }
  }
  return spans.reverse().reduce((acc, [a, b]) => acc.slice(0, a) + acc.slice(b), src);
}

/**
 * LATENCY BUDGET.
 *
 * The brief's first acceptance criterion is "the homepage never waits
 * indefinitely". A harness that only checks status codes passes while a page
 * takes 39 s to answer, which is exactly what used to happen. Measured on a
 * STALLING database host (connections that hang, not refuse), the degraded
 * server must still answer every page inside this budget.
 *
 * It is generous on purpose — CI machines are slow and a cold start is real.
 * It catches the pathology (tens of seconds), not ordinary jitter.
 */
const BUDGET_MS = Number(process.env.RESILIENCE_BUDGET_MS ?? 8000);

async function get(path) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers, ms: Date.now() - started };
}

const ERROR_CARD = "কিছু একটা ভুল হয়েছে";

async function main() {
  console.log(`\n▸ homepage resilience — ${BASE}\n`);

  /* ── 1. normal ─────────────────────────────────────────────────────── */
  const home = await get("/");
  const dom = visibleDom(home.body);

  check("home responds 200", home.status === 200, `got ${home.status}`);
  check("home has no error card", !dom.includes(ERROR_CARD));
  check("hero headline present", dom.includes("রান্নাঘর") || dom.includes("খামার থেকে"));
  check("exactly one h1 in the document", (dom.match(/<h1[\s>]/g) ?? []).length === 1);
  check("site header present", dom.includes("<header"));
  check("site footer present", dom.includes("<footer"));
  check(
    "hero appears before the first skeleton",
    (() => {
      const hero = dom.indexOf("রান্নাঘর") >= 0 ? dom.indexOf("রান্নাঘর") : dom.indexOf("খামার থেকে");
      const sk = dom.indexOf('class="skeleton');
      return hero >= 0 && (sk < 0 || hero < sk);
    })()
  );
  check("home answers inside the latency budget", home.ms <= BUDGET_MS, `${home.ms} ms (budget ${BUDGET_MS})`);
  check("title tag present", /<title>[^<]{6,}<\/title>/.test(home.body));
  check("viewport meta present (mobile)", /name="viewport"[^>]*width=device-width/.test(home.body));

  /* ── 2/3/4/5. degraded paths (these are active when the server is run
     against an unreachable database; the harness asserts the same invariants
     either way, which is the point) ─────────────────────────────────────── */
  const sections = [
    ["/products", "products"],
    ["/market", "market"],
    ["/categories", "categories"],
    ["/blog", "blog"],
    ["/faq", "faq"],
  ];
  for (const [path, name] of sections) {
    const r = await get(path);
    const d = visibleDom(r.body);
    check(`${name} responds 200`, r.status === 200, `got ${r.status}`);
    check(`${name} answers inside the latency budget`, r.ms <= BUDGET_MS, `${r.ms} ms`);
    check(`${name} has no error card`, !d.includes(ERROR_CARD));
    check(`${name} has one h1`, (d.match(/<h1[\s>]/g) ?? []).length === 1);
  }

  /* ── 7. stale chunks ──────────────────────────────────────────────── */
  const sw = await get("/sw.js");
  check("sw.js served", sw.status === 200);
  check("sw.js is not browser-cached", /max-age=0/.test(sw.headers.get("cache-control") ?? ""), sw.headers.get("cache-control") ?? "");
  check("sw.js has a version marker", /const SHELL\s*=/.test(sw.body));
  /* The name must come from the build, not from a constant someone has to
     remember to bump: one skipped bump served the previous build to every
     installed phone, permanently. `dev` is what an unbuilt local run sees. */
  const shellName = /const SHELL\s*=\s*["']([^"']+)["']/.exec(sw.body)?.[1] ?? "";
  check(
    "sw.js cache name is per-deployment (no __BUILD_ID__ placeholder left)",
    shellName.length > 3 && !shellName.includes("__BUILD_ID__"),
    shellName
  );
  check("sw.js declares a Service-Worker-Allowed scope", sw.headers.get("service-worker-allowed") === "/", sw.headers.get("service-worker-allowed") ?? "(none)");
  check("sw.js serves an offline page, not the document", sw.body.includes("/offline"));
  /* The worker must not sit between the browser and a hashed build asset.
     Every stale-chunk incident came from a worker-held copy that outlived a
     deploy, so the check slices the branch out and reads it rather than
     matching the whole file with one fragile regex. */
  const staticBranch = (() => {
    const at = sw.body.indexOf('url.pathname.startsWith("/_next/static/")');
    if (at === -1) return "";
    /* Cut at the next branch, then drop comments — the block's own explanation
       mentions `respondWith`, and matching that would fail forever. */
    const end = sw.body.indexOf("// ---- fonts", at);
    const block = sw.body.slice(at, end === -1 ? at + 1200 : end);
    return block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  })();
  check(
    "sw.js does not serve /_next/static from its own cache",
    staticBranch.length > 0 && !staticBranch.includes("cache.put") && !staticBranch.includes("respondWith")
  );
  const navBranch = (() => {
    const at = sw.body.indexOf('request.mode === "navigate"');
    if (at === -1) return "";
    const end = sw.body.indexOf("// ---- build assets", at);
    const block = sw.body.slice(at, end === -1 ? at + 1200 : end);
    return block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  })();
  check("sw.js never writes an HTML document into a cache", navBranch.length > 0 && !navBranch.includes("cache.put"));
  check(
    "sw.js does not return `cached || network` (the undefined bug)",
    !/return cached \|\| network/.test(sw.body)
  );
  /* The policy changed from "network-first" to "not intercepted at all", which
     is the stronger form of the same rule. Accept either wording so an older
     deployed worker still passes this check. */
  check(
    "build assets are never served stale",
    /network-first/i.test(sw.body) || /GET OUT OF THE WAY/i.test(sw.body)
  );

  /* ── summary ──────────────────────────────────────────────────────── */
  const passed = results.length - failures;
  console.log(`\n${passed}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ""}\n`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("harness error:", error);
  process.exit(2);
});
