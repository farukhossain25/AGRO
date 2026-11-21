#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the configured Supabase database.
 *
 *   node --env-file=.env.local scripts/migrate.mjs
 *   npm run db:migrate
 *
 * Uses the Supabase REST SQL endpoint via the service role key. If you have a
 * direct DATABASE_URL you can instead run:
 *   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  const envFile = process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : " --env-file=.env.local";
  console.error(`✖ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n  Run: node${envFile} scripts/migrate.mjs`);
  process.exit(1);
}

const dir = path.join(process.cwd(), "supabase", "migrations");

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
if (!files.length) {
  console.error("✖ No .sql files in supabase/migrations");
  process.exit(1);
}

console.log(`→ ${files.length} migration file(s) in ${url}`);

for (const file of files) {
  const sql = await readFile(path.join(dir, file), "utf8");
  process.stdout.write(`  • ${file} … `);

  // Supabase exposes arbitrary SQL through the pg-meta endpoint used by the
  // dashboard. It requires the service role key.
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ sql }),
  }).catch(() => null);

  if (res?.ok) {
    console.log("done");
    continue;
  }

  // Fallback: pg-meta query endpoint (works on hosted projects).
  const fallback = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  }).catch(() => null);

  if (fallback?.ok) {
    console.log("done (pg/query)");
    continue;
  }

  const detail = res ? await res.text().catch(() => "") : "network error";
  console.log("FAILED");
  console.error(`\n  ${detail.slice(0, 400)}\n`);
  console.error(
    "  Apply this file manually in Supabase → SQL Editor:\n" +
      `  https://supabase.com/dashboard/project/${url.split("//")[1].split(".")[0]}/sql/new\n`
  );
  process.exitCode = 1;
}

console.log("\n✅ Migration run finished.");
