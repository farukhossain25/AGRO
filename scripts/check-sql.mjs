#!/usr/bin/env node
/**
 * Runs supabase/sql/*.sql in order inside an in-process Postgres (PGlite),
 * twice, and asserts zero errors. Also runs 13_verify_setup.sql and fails if any
 * row is FAIL.
 *
 *   npm run db:check
 *
 * CI-friendly: exits non-zero on the first problem. This is how the SQL is kept
 * safe without ever touching a real project.
 */
import fs from "node:fs";
import { createHarness, runFile, ORDERED_FILES, SQL_DIR } from "./lib/sql-harness.mjs";

const db = await createHarness();
await db.exec("insert into auth.users (email) values ('foysaliqbal09@gmail.com')");

/**
 * Second-wave files: the storage fix, seller applications + panel path,
 * the payments rebuild and its RLS/storage/seed. They build on the base
 * chain and must be run in order after 13. Validated twice like the base.
 */
const EXTRA_FILES = [
  "14_storage_fix.sql",
  "15_seller_applications_and_panel_path.sql",
  "16_verify_seller_rls_and_storage.sql",
  "17_payments_reset.sql",
  "18_payments_schema.sql",
  "19_payments_functions.sql",
  "20_payments_rls_storage.sql",
  "21_payments_seed.sql",
  "22_seller_logo_banner.sql",
  "23_premium_payment_approval.sql",
  "24_camera_cloud_bridge.sql",
  "25_coupons_referrals_wallet.sql",
  "26_footer_payments.sql",
  "27_live_chat.sql",
  "28_security_hardening.sql",
  /* 29 hardens wallet/payment/CCTV *and* is required for a fresh project:
     without it place_order() stays callable by anon. So it sits in the chain
     that 13_verify_setup.sql checks, not in the optional extras. */
  "29_security_hardening.sql",
  "30_critical_fixes.sql",
  "31_security_reliability_fixes.sql",
  "32_team_permission_console.sql",
  "33_seller_farm_profile_sync.sql",
];

async function run(file, round) {
  try {
    await runFile(db, file);
    console.log(`OK   [${round}] ${file}`);
  } catch (error) {
    console.error(`FAIL [${round}] ${file}\n${error.message}`);
    process.exit(1);
  }
}

for (const file of ORDERED_FILES) await run(file, 1);
for (const file of ORDERED_FILES) await run(file, 2);
for (const file of EXTRA_FILES) await run(file, 1);
for (const file of EXTRA_FILES) await run(file, 2);
await run("12_make_admin.sql", 1);
await run("13_verify_setup.sql", 1);

// 00 must leave the database empty and still be re-runnable.
await run("00_RESET_ALL_DANGEROUS.sql", 1);
await run("00_RESET_ALL_DANGEROUS.sql", 2);
const leftovers = await db.query(
  `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v')`
);
if (leftovers.rows[0].n !== 0) {
  console.error(`FAIL reset left ${leftovers.rows[0].n} tables/views behind`);
  process.exit(1);
}
console.log("OK   [1] 00 reset leaves the public schema empty (and is re-runnable)");

// Full chain again after the reset, to prove a brand-new project built only
// from the files in this repo reaches the same hardened state (00 → 29).
for (const file of ORDERED_FILES) await run(file, 3);
for (const file of EXTRA_FILES) await run(file, 3);
await run("12_make_admin.sql", 3);

const verifySql = fs.readFileSync(`${SQL_DIR}/13_verify_setup.sql`, "utf8");
const verify = await db.query(verifySql);
const failures = verify.rows.filter((row) => row.status === "FAIL");
console.log(`\n13_verify_setup: ${verify.rows.length} checks, ${failures.length} FAIL`);
if (failures.length) {
  console.error(failures);
  process.exit(1);
}

console.log("\nAll SQL files are valid, idempotent and dependency-correct. ✅");
