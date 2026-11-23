-- ============================================================================
-- 04_orders_payments_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the money path: combos, subscription plans & subscriptions, cart,
--   orders, order_items, sub_orders (per-seller splits), payment methods,
--   manual payments, payment logs, parcel labels and custom combos.
--
-- WHEN TO RUN
--   Fourth, after 03_catalog_tables.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • orders are written ONLY by the place_order() RPC (file 07), so a single
--     transaction validates stock, price, coupon and delivery. No browser can
--     insert an order directly.
--   • payments.subscription_id is a plain uuid here; the foreign key to
--     user_subscriptions is added at the end of 05 (that table is created
--     there).
--   • statuses are enum-typed, so a typo cannot reach the database.
-- ============================================================================

-- -------------------------------------------------------------------- combos --
create table if not exists public.combos (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name_bn         text not null,
  name_en         text,
  description_bn  text,
  kind            public.combo_kind not null default 'daily',
  price           numeric(12, 2) not null default 0 check (price >= 0),
  original_price  numeric(12, 2),
  contents        jsonb not null default '[]'::jsonb,
  image           text,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------- combo_items --
create table if not exists public.combo_items (
  id          uuid primary key default gen_random_uuid(),
  combo_id    uuid not null references public.combos (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint combo_items_combo_product_key unique (combo_id, product_id)
);

-- -------------------------------------------------------- subscription_plans --
create table if not exists public.subscription_plans (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name_bn         text not null,
  name_en         text,
  members_label   text not null default '৪-৫ জন',
  members_min     integer not null default 1,
  members_max     integer not null default 10,
  price_monthly   numeric(12, 2) not null default 0,
  saving_label    text,
  features        text[] not null default '{}'::text[],
  image           text,
  is_popular      boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------ subscriptions --
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  sub_no         text not null unique,
  user_id        uuid references public.profiles (id) on delete set null,
  plan_id        uuid references public.subscription_plans (id) on delete set null,
  package_name   text not null,
  customer_name  text not null,
  phone          text not null,
  division       text not null,
  district       text not null,
  upazila        text not null,
  address        text not null,
  members        integer not null default 1,
  start_date     date not null default current_date,
  frequency      public.subscription_frequency not null default 'monthly',
  price_monthly  numeric(12, 2) not null default 0,
  status         public.subscription_status not null default 'active',
  paused_until   date,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- --------------------------------------------------------------- cart_items --
create table if not exists public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     uuid not null,
  kind        text not null default 'product' check (kind in ('product', 'combo')),
  slug        text,
  name_bn     text,
  quantity    integer not null default 1 check (quantity between 1 and 99),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cart_items_user_item_key unique (user_id, kind, item_id)
);

-- -------------------------------------------------------------------- orders --
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_no         text not null unique,
  user_id          uuid references public.profiles (id) on delete set null,
  customer_name    text not null,
  customer_phone   text not null,
  customer_email   text,
  division         text not null,
  district         text not null,
  upazila          text not null,
  address          text not null,
  delivery_note    text,
  subtotal         numeric(12, 2) not null default 0,
  delivery_charge  numeric(10, 2) not null default 0,
  discount         numeric(12, 2) not null default 0,
  total            numeric(12, 2) not null default 0,
  coupon_code      text,
  payment_method   text not null default 'cod',
  payment_status   public.payment_status not null default 'pending',
  payment_ref      text,
  status           public.order_status not null default 'received',
  eta_days         text,
  admin_note       text,
  cancel_reason    text,
  delivered_at     timestamptz,
  delivered_by     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- --------------------------------------------------------------- order_items --
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  sub_order_id  uuid,
  product_id    uuid references public.products (id) on delete set null,
  seller_id     uuid references public.sellers (id) on delete set null,
  name_bn       text not null,
  unit          text,
  price         numeric(12, 2) not null default 0,
  quantity      integer not null default 1 check (quantity > 0),
  image         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- sub_orders --
create table if not exists public.sub_orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  sub_no          text not null unique,
  seller_id       uuid references public.sellers (id) on delete set null,
  farm_id         uuid references public.farms (id) on delete set null,
  seller_name     text,
  seller_phone    text,
  subtotal        numeric(12, 2) not null default 0,
  commission      numeric(12, 2) not null default 0,
  seller_earning  numeric(12, 2) not null default 0,
  status          public.order_status not null default 'received',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sub_orders_order_seller_key unique (order_id, seller_id)
);

-- ----------------------------------------------------------- payment_methods --
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

-- ------------------------------------------------------------------ payments --
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  payment_no        text not null unique,
  user_id           uuid references public.profiles (id) on delete set null,
  purpose           public.payment_purpose not null default 'order',
  order_id          uuid references public.orders (id) on delete set null,
  subscription_id   uuid,
  method_id         uuid references public.payment_methods (id) on delete set null,
  method_code       text not null,
  method_name_bn    text,
  expected_amount   numeric(12, 2) not null default 0,
  amount            numeric(12, 2) not null default 0,
  sender_number     text,
  trx_id            text,
  trx_norm          text,
  paid_at           timestamptz,
  screenshot_url    text,
  status            public.payment_review_status not null default 'pending',
  reject_reason     text,
  admin_note        text,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  submitted_ip      text,
  submitted_agent   text,
  attempt_no        integer not null default 1,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- One TrxID can settle exactly one payment. Partial unique index so the many
-- NULLs (COD / bank drafts) do not collide.
create unique index if not exists payments_trx_norm_key
  on public.payments (trx_norm)
  where trx_norm is not null;

-- --------------------------------------------------------------- payment_logs --
create table if not exists public.payment_logs (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_role   text,
  action       public.payment_log_action not null default 'note',
  from_status  text,
  to_status    text,
  note         text,
  ip           text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------- parcels --
create table if not exists public.parcels (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  sub_order_id    uuid references public.sub_orders (id) on delete set null,
  order_no        text not null,
  qr_token        text not null unique,
  label           jsonb not null default '{}'::jsonb,
  printed_count   integer not null default 0,
  delivered_at    timestamptz,
  delivered_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint parcels_order_key unique (order_id)
);

-- --------------------------------------------------------------- custom_combos --
create table if not exists public.custom_combos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  name_bn         text not null,
  items           jsonb not null default '[]'::jsonb,
  item_count      integer not null default 0,
  price_cached    numeric(12, 2) not null default 0,
  repeat_interval text not null default 'none' check (repeat_interval in ('none', 'weekly', 'monthly')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
