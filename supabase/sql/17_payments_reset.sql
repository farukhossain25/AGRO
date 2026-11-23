-- ============================================================================
-- 17_payments_reset.sql
-- ============================================================================
-- ███ DELETES OLD PAYMENT DATA ONLY ███
-- Does NOT touch: orders, order_items, sub_orders, products, auth.users, profiles.
-- If your old `payments` table has real customer data you want to keep, export
-- it from Supabase Dashboard → Table Editor → payments → Export CSV first.
--
-- WHAT IT DOES
--   Drops old payment tables, functions, and payment-specific storage policies
--   in dependency order so 18_payments_schema.sql can create the clean schema.
--
-- WHEN TO RUN
--   First in the new payment setup (before 18_payments_schema.sql).
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

drop policy if exists "payment proof owner read" on storage.objects;
drop policy if exists "payment proof owner upload" on storage.objects;
drop policy if exists "payment proof admin manage" on storage.objects;

drop view if exists public.public_payment_methods cascade;

drop function if exists public.submit_payment(uuid, uuid, text, text, numeric, text, text, text) cascade;
drop function if exists public.review_payment(uuid, text, text, text) cascade;
drop function if exists public.cancel_unpaid_orders() cascade;

drop table if exists public.payment_logs cascade;
drop table if exists public.payments cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.payment_settings cascade;
