#!/usr/bin/env node
/**
 * scripts/lighthouse-audit.mjs
 * ---------------------------------------------------------------------------
 * Runs Lighthouse (mobile, throttled) against the production build and fails
 * when a score or a Core Web Vital misses the target.
 *
 *   npm run build && npx next start -p 3000     # in another terminal
 *   node scripts/lighthouse-audit.mjs http://localhost:3000
 *
 * Targets (the brief):
 *   Performance ≥ 90 · Accessibility ≥ 95 · Best Practices ≥ 95 · SEO ≥ 95
 *   LCP < 2500 ms · CLS < 0.1 · INP proxy: TBT < 200 ms
 *
 * Install Lighthouse once:  npm i -D lighthouse chrome-launcher
 * (kept out of package.json so a Vercel install stays small)
 */

import { spawn } from "node:child_process";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";

const ROUTES = [
  "/",
  "/products",
  "/products/kacha-tomato",
  "/categories",
  "/live/farms",
  "/blog",
];

const THRESHOLDS = {
  performance: 90,
  accessibility: 95,
  "best-practices": 95,
  seo: 95,
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
};

async function loadLighthouse() {
  try {
    const mod = await import("lighthouse");
    return mod.default ?? mod;
  } catch {
    console.error(
      "✗ lighthouse is not installed.\n  npm i -D lighthouse chrome-launcher\n  (or set CHROME_PATH and use npx lighthouse)"
    );
    process.exit(1);
  }
}

async function audit(url, lighthouse, puppeteerLauncher) {
  const chromePath = process.env.CHROME_PATH;
  const chrome = chromePath
    ? { port: 0 }
    : await puppeteerLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });

  try {
    const port = chrome instanceof Object && "port" in chrome ? chrome.port : 9222;
    const result = await lighthouse(url, {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      throttling: { rttMs: 150, throughputKbps: 1638, cpuSlowdownMultiplier: 4 },
    });

    const lhr = result.lhr;
    return {
      url,
      scores: {
        performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
        "best-practices": Math.round((lhr.categories["best-practices"]?.score ?? 0) * 100),
        seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
      },
      lcp: Math.round(lhr.audits["largest-contentful-paint"]?.numericValue ?? 0),
      cls: Number((lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
      tbt: Math.round(lhr.audits["total-blocking-time"]?.numericValue ?? 0),
    };
  } finally {
    if (chrome && typeof chrome.kill === "function") await chrome.kill();
  }
}

async function main() {
  const lighthouse = await loadLighthouse();
  const puppeteerLauncher = await import("chrome-launcher").catch(() => ({
    launch: async () => ({ port: 9222, kill: async () => {} }),
  }));

  const failures = [];
  console.log("\nMobile Lighthouse (412×823, Slow 4G, 4× CPU)\n");

  for (const route of ROUTES) {
    const url = path.join(BASE, route).replace(":/", "://");
    const row = await audit(url, lighthouse, puppeteerLauncher);

    const problems = [];
    for (const [key, min] of Object.entries(THRESHOLDS)) {
      if (key in row.scores && row.scores[key] < min) problems.push(`${key} ${row.scores[key]}<${min}`);
    }
    if (row.lcp > THRESHOLDS.lcp) problems.push(`LCP ${row.lcp}ms`);
    if (row.cls > THRESHOLDS.cls) problems.push(`CLS ${row.cls}`);
    if (row.tbt > THRESHOLDS.tbt) problems.push(`TBT ${row.tbt}ms`);

    console.log(
      `${problems.length ? "✗" : "✓"} ${route.padEnd(28)} ` +
        `P${row.scores.performance} A${row.scores.accessibility} ` +
        `B${row.scores["best-practices"]} S${row.scores.seo} · ` +
        `LCP ${row.lcp}ms CLS ${row.cls} TBT ${row.tbt}ms`
    );

    if (problems.length) failures.push({ route, problems });
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} route(s) missed target:`);
    for (const f of failures) console.error(`   ${f.route}: ${f.problems.join(", ")}`);
    process.exit(1);
  }

  console.log("\n✓ all routes meet the Lighthouse 90+ target\n");
}

await main();
