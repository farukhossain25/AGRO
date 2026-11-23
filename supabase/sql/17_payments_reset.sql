-- ============================================================================
-- 17_payments_reset.sql
-- ============================================================================
-- ███ DELETES OLD PAYMENT DATA ONLY ███
-- Does NOT touch: orders, order_items, sub_orders, products, auth.users,
-- profiles, payment_methods.
--
-- WHAT IT DOES
--   Drops the old manual-verification payment system (the `payments` and
--   `payment_logs` tables, the submit_payment / review_payment / cancel_unpaid_
--   orders RPCs, the public_payment_methods view and the payment-proofs
--   storage policies) so the new, simpler payment setup can run cleanly.
--   The new system keeps only `payment_methods` (admin-managed receiving
--   numbers) plus the `payment_method` / `payment_status` columns on orders.
--
-- WHEN TO RUN
--   First in the new payment setup (before 18_payments_schema.sql), and only
--   on a database that still has the old payment system. On a fresh project
--   the drops are harmless no-ops.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

-- Old storage policies for the payment-proofs bucket (gone with the old system).
drop policy if exists "payment proof owner read" on storage.objects;
drop policy if exists "payment proof owner upload" on storage.objects;
drop policy if exists "payment proof admin manage" on storage.objects;

-- Old public view over the payment methods table (the new app reads the table
-- directly through the API, no view needed).
drop view if exists public.public_payment_methods cascade;

-- Old RPCs from the manual-verification engine.
drop function if exists public.submit_payment(uuid, uuid, text, text, numeric, text, text, text) cascade;
drop function if exists public.review_payment(uuid, text, text, text) cascade;
drop function if exists public.cancel_unpaid_orders() cascade;

-- Old payment tables.
drop table if exists public.payment_logs cascade;
drop table if exists public.payments cascade;
drop table if exists public.payment_settings cascade;

-- Payment-proofs bucket itself (its policies are dropped above).
delete from storage.buckets where id = 'payment-proofs';
