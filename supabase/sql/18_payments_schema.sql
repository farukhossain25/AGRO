-- ============================================================================
-- 18_payments_schema.sql
-- ============================================================================
-- WHAT IT DOES
--   Re-asserts the clean, admin-controllable payment schema. The
--   `payment_methods` table itself is created by 04_orders_payments_tables.sql
--   (this file keeps the payment setup self-contained so 17–21 can also be
--   run against a database that only has the new tables).
--
--   There is deliberately NO `payments` or `payment_logs` table: orders carry
--   only `payment_method` (the method code) and `payment_status`
--   (pending → paid). The owner marks an order paid from the admin panel —
--   there is no customer-side TrxID verification engine.
--
-- WHEN TO RUN
--   After 17_payments_reset.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

-- The payment_methods table (identical to 04 — safe to run twice).
create table if not exists public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name_bn         text not null,
  name_en         text,
  kind            public.payment_method_kind not null default 'mfs',
  logo_url        text,
  account_type    public.payment_account_type,
  account_number  text,
  account_name    text,
  bank_name       text,
  branch_name     text,
  routing_number  text,
  instruction_bn  text,
  min_amount      numeric(10, 2) not null default 1,
  max_amount      numeric(12, 2),
  trx_pattern     text,
  requires_trx    boolean not null default true,
  requires_sender boolean not null default true,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Human-readable code fallback: if a row somehow has no code, use the id.
-- (code is NOT NULL UNIQUE, so this is only a documentation guard.)
comment on table public.payment_methods is
  'Admin-managed payment receiving methods. Each row is one way to pay '
  '(bKash, Nagad, Rocket, Upay, bank account, cash on delivery) with the '
  'receiving number and Bangla instructions. Orders reference only code.';
