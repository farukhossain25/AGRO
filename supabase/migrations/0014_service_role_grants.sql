-- 0014_service_role_grants.sql
--
-- Why this migration exists
-- -------------------------
-- Every server-side read/write in this app goes through `lib/db.ts`, which
-- talks to Postgres with the SERVICE ROLE key. The service role bypasses RLS,
-- but it still needs ordinary SQL privileges on the objects it touches.
--
-- In project izemauiuyqcdawijoloh those privileges were missing: all 74 public
-- tables reported `false` for select/insert/update/delete, and the ACL on every
-- table was just `service_role=Dxtm/postgres` (no `arwd`). Effect of that:
--
--   * every `db()` query raised `42501 permission denied for table …`,
--   * the storefront silently fell back to `lib/seed-data.ts`, so the shop
--     looked full while the database was empty,
--   * the admin panel could not save a single field — the PATCH was rejected
--     before it ever reached the row ("টেক্সট edit বা add কিছুই করতে পারছি না").
--
-- The grants below were applied to the live database on 2026-11-22 and verified
-- with has_table_privilege(): 75/75 relations readable and insertable. This file
-- records them so a fresh project, a `supabase db reset`, or a restore cannot
-- put the site back in that state.
--
-- Notes
--   * `grant … on all tables in schema public` only covers objects that exist
--     NOW; the `alter default privileges` half covers everything created later
--     (e.g. by a future migration, run as `postgres`).
--   * Sequences are granted too — inserts into `bigserial`/`identity` columns
--     fail with `permission denied for sequence` otherwise.
--   * No RLS change: `service_role` already bypasses policies (BYPASSRLS is a
--     property of the role, the policies stay in force for anon/authenticated).
--   * Re-running is harmless: these statements are idempotent.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Objects created by later migrations (which run as `postgres`) inherit the
-- same privileges without anyone remembering to repeat the grants.
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;

alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
