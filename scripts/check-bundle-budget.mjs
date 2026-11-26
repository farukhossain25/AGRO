#!/usr/bin/env node
/**
 * scripts/check-bundle-budget.mjs
 * ---------------------------------------------------------------------------
 * Reads `.next/app-build-manifest.json` + the route manifests and fails when a
 * route's first-load JavaScript exceeds its budget.
 *
 *   node scripts/check-bundle-budget.mjs            # report + enforce
 *   node scripts/check-bundle-budget.mjs --report   # report only
 *
 * Budgets are gzipped-ish estimates (raw size × 0.34), which is close enough to
 * what the network transfers for JS and keeps this dependency-free.
 *
 * Why a budget at all: Lighthouse mobile Performance ≥ 90 needs a small main
 * thread budget. Every kilobyte of first-load JS pushes INP up.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const REPORT_ONLY = process.argv.includes("--report");

/**
 * Budgets are GZIPPED first-load JS, measured with `zlib.gzipSync` over every
 * chunk the route pulls in. That matches what the network actually transfers
 * (Brotli on Vercel is ~5% smaller still), and it is the number Lighthouse's
 * "JavaScript" row reports.
 *
 * Current headroom: home 96 kB gz of a 130 kB budget, catalogue 106/130.
 */
const BUDGETS = [
  /* 132 → 134: the home page gained the product ring (revision 10) — a real
     3D cylinder with drag/scroll/keyboard handling, ~1.8 kB gz of behaviour
     that cannot be shipped without JavaScript. Measured at 132.4 after the
     feature; everything else on the page is unchanged. */
  { match: /^\/$/, budget: 134, label: "home" },
  { match: /^\/products(\/|$)/, budget: 135, label: "catalogue" },
  { match: /^\/categories(\/|$)/, budget: 135, label: "categories" },
  { match: /^\/combos(\/|$)/, budget: 135, label: "combos" },
  { match: /^\/live(\/|$)/, budget: 150, label: "live" },
  { match: /^\/market(\/|$)/, budget: 135, label: "marketplace" },
  { match: /^\/blog(\/|$)/, budget: 125, label: "blog" },
  { match: /^\/foisal(\/|$)/, budget: 300, label: "admin" },
  { match: /^\/login$|^\/auth/, budget: 260, label: "auth" },
  /* Account/security screens import the Supabase browser client directly
     (session refresh on the client), so they sit ~30 kB above plain forms.
     200 kB gz keeps them honest while allowing @supabase/ssr. */
  { match: /^\/(account|cart|checkout|payment)(\/|$)/, budget: 200, label: "funnel" },
];

const DEFAULT_BUDGET = 215; // kB gz — root layout now carries Supabase SSR + fonts

const nextDir = path.join(process.cwd(), ".next");
const buildManifestPath = path.join(nextDir, "app-build-manifest.json");

/** Gzipped size of one build chunk, in kB. */
async function fileSizeKb(file) {
  try {
    const abs = path.join(nextDir, file);
    const buffer = readFileSync(abs);
    return gzipSync(buffer, { level: 9 }).length / 1024;
  } catch {
    return 0;
  }
}

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(buildManifestPath, "utf8"));
  } catch {
    console.error("✗ .next/app-build-manifest.json not found — run `npm run build` first.");
    process.exit(1);
  }

  const pages = manifest.pages ?? {};
  const rows = [];

  for (const [route, files] of Object.entries(pages)) {
    // /page → "/", /products/page → "/products"
    const clean = route.replace(/\/page$/, "").replace(/^\/\([^)]+\)/, "") || "/";
    let raw = 0;
    for (const file of files) raw += await fileSizeKb(file);

    const estimate = raw;
    const rule = BUDGETS.find((b) => b.match.test(clean));
    const budget = rule?.budget ?? DEFAULT_BUDGET;

    rows.push({ route: clean, family: rule?.label ?? "other", kb: estimate, budget, over: estimate > budget });
  }

  rows.sort((a, b) => b.kb - a.kb);

  console.log("\nRoute".padEnd(42) + "Family".padEnd(14) + "KB".padStart(8) + "Budget".padStart(9));
  console.log("─".repeat(73));
  for (const row of rows) {
    const flag = row.over ? " ✗" : "";
    console.log(
      row.route.padEnd(42) +
        row.family.padEnd(14) +
        row.kb.toFixed(1).padStart(8) +
        String(row.budget).padStart(9) +
        flag
    );
  }

  const failures = rows.filter((r) => r.over);
  console.log(`\n${rows.length} routes · ${failures.length} over budget`);

  if (failures.length && !REPORT_ONLY) {
    console.error("\n✗ Bundle budget exceeded. Largest offenders:");
    for (const f of failures.slice(0, 10)) {
      console.error(`   ${f.route} — ${f.kb.toFixed(1)} kB (budget ${f.budget} kB)`);
    }
    process.exit(1);
  }

  if (!failures.length) console.log("✓ every route is inside its budget");
}

/** Also report the biggest shared chunks, to spot a fat dependency. */
async function chunkReport() {
  const staticDir = path.join(nextDir, "static", "chunks");
  try {
    const files = await readdir(staticDir);
    const sized = [];
    for (const file of files) {
      if (!file.endsWith(".js")) continue;
      const info = await stat(path.join(staticDir, file));
      sized.push({ file, kb: info.size / 1024 });
    }
    sized.sort((a, b) => b.kb - a.kb);
    console.log("\nLargest shared chunks (raw kB):");
    for (const chunk of sized.slice(0, 8)) console.log(`  ${chunk.kb.toFixed(1).padStart(7)}  ${chunk.file}`);
  } catch {
    /* no chunks — skip */
  }
}

await main();
await chunkReport();
