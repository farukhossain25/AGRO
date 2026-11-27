/**
 * In-process Postgres (PGlite) harness for supabase/sql.
 *
 * Used by:
 *   node scripts/check-sql.mjs        → runs 00 → 13 twice, asserts no error
 *   node scripts/generate-db-types.mjs → introspects the result into
 *                                       lib/database.types.ts
 *
 * Supabase-only objects (auth.users, storage.buckets/objects, the anon /
 * authenticated / service_role roles, auth.uid()) are stubbed so the SQL can be
 * validated exactly as written, without touching a real project.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

export const SQL_DIR = path.resolve(process.cwd(), "supabase/sql");

export const ORDERED_FILES = [
  "01_extensions_and_enums.sql",
  "02_core_tables.sql",
  "03_catalog_tables.sql",
  "04_orders_payments_tables.sql",
  "05_premium_reviews_tables.sql",
  "06_homepage_cms_tables.sql",
  "07_functions_and_triggers.sql",
  "08_rls_policies.sql",
  "09_storage_buckets_and_policies.sql",
  "10_indexes_and_views.sql",
  "11_seed_sample_data.sql",
];

const BOOTSTRAP = `
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

-- Mirrors Supabase's built-in storage helpers (real projects have these
-- automatically; the harness must stub them so SQL files that use them in
-- RLS policies can be validated exactly as written).
create or replace function storage.foldername(filename text)
returns text[] language sql immutable as
$$ select regexp_split_to_array(filename, '/') $$;
`;

/** Boot an empty PGlite with the Supabase stubs applied. */
export async function createHarness() {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.exec(BOOTSTRAP);
  return db;
}

/** Execute one SQL file from supabase/sql. */
export async function runFile(db, file) {
  const sql = fs.readFileSync(path.join(SQL_DIR, file), "utf8");
  await db.exec(sql);
}

/** Boot + run the whole chain (optionally with 00 reset first). */
/**
 * Files that build on the base chain (14 → 27). They are optional for a given
 * introspection run but mandatory for `npm run db:types`: skipping them silently
 * produced a database.types.ts without the columns and tables those migrations
 * add, and the typecheck then failed on code that was perfectly correct.
 */
const CHAIN_FILES = [
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
  "29_security_hardening.sql",
  "30_critical_fixes.sql",
  "31_security_reliability_fixes.sql",
  "32_team_permission_console.sql",
];

export { CHAIN_FILES };

export async function loadSchema({ withReset = false, withSeed = true, chain = true } = {}) {
  const db = await createHarness();
  if (withReset) await runFile(db, "00_RESET_ALL_DANGEROUS.sql");
  for (const file of ORDERED_FILES) {
    if (!withSeed && file.startsWith("11_")) continue;
    await runFile(db, file);
  }
  if (chain) for (const file of CHAIN_FILES) await runFile(db, file);
  return db;
}
