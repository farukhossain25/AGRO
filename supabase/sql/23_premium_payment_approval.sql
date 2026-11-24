-- ============================================================================
-- 23_premium_payment_approval.sql
-- ============================================================================
-- WHAT IT DOES
--   1. Adds `cancel_reason` to public.user_subscriptions — the note the owner
--      writes when a premium payment is rejected, so the customer reads WHY
--      instead of just seeing "বাতিল".
--   2. Adds `reviewed_at` / `reviewed_by` so every approve/cancel carries who
--      decided and when (the audit log keeps the full diff; these two are the
--      fast read for the account page).
--   3. Index on (status, created_at) — the admin panel's "waiting for
--      approval" queue reads exactly that slice on every page load.
--
--   Nothing else changes: a subscription is still created as `pending` by
--   POST /api/premium/subscribe and only an admin action moves it to
--   `active` (approve) or `cancelled` (reject with a reason).
--
-- WHEN TO RUN
--   After 22_seller_logo_banner.sql — or any time. Idempotent.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — add column if not exists / create index if not exists.
-- ============================================================================

alter table public.user_subscriptions
  add column if not exists cancel_reason text,
  add column if not exists reviewed_at    timestamptz,
  add column if not exists reviewed_by    uuid references public.profiles (id) on delete set null;

comment on column public.user_subscriptions.cancel_reason is
  'Why an admin rejected this premium payment (or why the owner cancelled). Shown to the customer.';
comment on column public.user_subscriptions.reviewed_at is
  'When an admin approved (status=active) or rejected (status=cancelled) the payment.';
comment on column public.user_subscriptions.reviewed_by is
  'Which admin/staff member made the approve/reject decision.';

create index if not exists user_subscriptions_status_created_idx
  on public.user_subscriptions (status, created_at desc);

-- The queue badge on the dashboard counts pending premium payments.
create index if not exists user_subscriptions_pending_idx
  on public.user_subscriptions (created_at desc)
  where status = 'pending';
