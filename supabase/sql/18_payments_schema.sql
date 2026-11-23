-- ============================================================================
-- 18_payments_schema.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the clean, admin-controllable payment tables:
--     1. public.payment_methods
--     2. public.payments (with unique non-rejected TrxID index)
--     3. public.payment_logs
--     4. public.payment_settings (single-row config)
--
-- WHEN TO RUN
--   After 17_payments_reset.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('bkash', 'nagad', 'rocket', 'upay', 'bank', 'cod', 'custom')),
  display_name text not null,
  display_name_bn text not null,
  logo_path text,
  receiving_number text,
  account_type text not null default 'personal' check (account_type in ('personal', 'agent', 'merchant', 'account')),
  account_name text,
  bank_name text,
  branch text,
  account_number text,
  instructions_bn text not null default '',
  instructions_en text not null default '',
  min_amount numeric(12,2) not null default 10,
  max_amount numeric(12,2),
  fee_percent numeric(5,2) not null default 0,
  requires_trx_id boolean not null default true,
  requires_sender_number boolean not null default true,
  requires_screenshot boolean not null default false,
  trx_id_pattern text not null default '^[A-Za-z0-9]{6,20}$',
  is_active boolean not null default false,
  show_on_checkout boolean not null default true,
  show_on_premium boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  subscription_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  guest_phone text,
  method_id uuid not null references public.payment_methods(id) on delete restrict,
  method_snapshot jsonb not null default '{}'::jsonb,
  amount_expected numeric(12,2) not null,
  amount_sent numeric(12,2) not null,
  sender_number text,
  trx_id text,
  paid_at timestamptz default now(),
  screenshot_path text,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'rejected', 'need_more_info', 'cancelled', 'refunded')),
  reject_reason text,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_payments_unique_active_trx
  on public.payments (lower(trx_id))
  where status <> 'rejected' and trx_id is not null and btrim(trx_id) <> '';

create index if not exists idx_payments_order_id on public.payments (order_id);
create index if not exists idx_payments_status on public.payments (status);
create index if not exists idx_payments_user_id on public.payments (user_id);

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  action text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_logs_payment_id on public.payment_logs (payment_id);

create table if not exists public.payment_settings (
  id integer primary key default 1 check (id = 1),
  auto_block_after_rejections integer not null default 3,
  max_submissions_per_hour integer not null default 5,
  allow_cod boolean not null default true,
  cod_min numeric(12,2) not null default 100,
  cod_max numeric(12,2) not null default 10000,
  require_login_for_checkout boolean not null default false,
  auto_cancel_unpaid_hours integer not null default 24,
  support_phone text not null default '',
  support_whatsapp text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (id) values (1) on conflict (id) do nothing;
