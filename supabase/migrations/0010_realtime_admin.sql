-- ============================================================================
--  0010_realtime_admin.sql
-- ----------------------------------------------------------------------------
--  Vercel cannot hold a long-lived connection open (serverless functions are
--  capped at a few seconds and are frozen between requests), and polling a
--  database every 20 seconds from an open admin tab burns the free-tier quota
--  all night. The brief's answer is Supabase Realtime: the browser subscribes
--  to a table, Postgres pushes an event the moment a row changes.

--  This migration adds the two tables the panel needs to hear about, and
--  nothing else. Adding a table to a publication does NOT widen who can read
--  it: Realtime honours RLS, and it re-checks the policy for every subscriber
--  before sending each row.

--  RLS AS IT STANDS (migration 0009)
--    payments      — customer reads their own row; `payments_admin_read` lets
--                    staff read everything.
--    notifications — `notifications_own`: user_id = app_user_id().
--  So a customer subscribing to `payments` only ever receives their own rows,
--  and an admin receives the queue. Exactly what we want.

--  REPLICA IDENTITY FULL
--  Without it, an UPDATE event carries only the primary key and whatever is in
--  the old tuple's default (nothing useful). The console needs the new status
--  to move a row from "যাচাই বাকি" to "ভেরিফাইড" without re-fetching, so we ask
--  Postgres to publish the whole row.
-- ============================================================================

do $$
begin
  -- The publication is created by Supabase itself; creating it if missing keeps
  -- this migration runnable against a fresh local database too.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ── payments: the verification queue ───────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'payments')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
     )
  then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;

alter table if exists public.payments replica identity full;

-- ── notifications: the admin bell ──────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'notifications')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

alter table if exists public.notifications replica identity full;

--  `payment_logs` is deliberately NOT published: it is an append-only audit
--  trail that grows on every submit and every decision. Broadcasting it would
--  wake every open console for no visual change.

-- ── verification ───────────────────────────────────────────────────────────
-- Expect two rows: payments and notifications.
select tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
 order by tablename;
