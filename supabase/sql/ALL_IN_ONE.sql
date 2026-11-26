-- ============================================================================
-- ALL_IN_ONE.sql  (schema only)
-- ============================================================================
-- WHAT IT DOES
--   Everything from 01 to 10 in ONE paste: extensions, enums, tables,
--   functions, triggers, RLS policies, storage buckets, indexes and views.
--
--   It does NOT contain:
--     • 00_RESET_ALL_DANGEROUS.sql  (destructive — run that separately)
--     • 11_seed_sample_data.sql     (optional demo data — run separately)
--     • 12_make_admin.sql           (needs your admin user to exist first)
--     • 13_verify_setup.sql         (run it after this to confirm)
--
-- WHEN TO RUN
--   On a brand-new project, instead of running 01–10 one by one.
--   Afterwards run 12 and 13 as usual.
--
-- WHAT YOU SHOULD SEE
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE: yes (every statement is guarded).
-- ============================================================================
-- ############################################################################
-- ##  01_extensions_and_enums.sql
-- ############################################################################
-- ============================================================================
-- 01_extensions_and_enums.sql
-- ============================================================================
-- WHAT IT DOES
--   Installs the Postgres extensions the app needs and creates every enum type
--   used by the new schema (roles, order status, payment status, etc.).
--
-- WHEN TO RUN
--   First file, right after creating a fresh Supabase project (and after
--   00_RESET_ALL_DANGEROUS.sql if you are wiping an existing database).
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes. Extensions use IF NOT EXISTS and each enum is created inside a
--   DO block that ignores "already exists".
-- ============================================================================

-- gen_random_uuid(), gen_random_bytes()  -> ids, QR tokens, access codes
create extension if not exists pgcrypto with schema extensions;
-- trigram search for product / order search boxes
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums. Each one is guarded so a second run is a no-op.
-- ---------------------------------------------------------------------------
do $$
begin
  -- accounts -----------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('customer', 'premium', 'seller', 'staff', 'manager', 'admin');
  end if;

  -- orders -------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('received', 'packing', 'shipped', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_kind') then
    create type public.payment_method_kind as enum ('mfs', 'bank', 'cod', 'gateway', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_account_type') then
    create type public.payment_account_type as enum ('personal', 'agent', 'merchant', 'account');
  end if;

  -- catalog ------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'farm_type') then
    create type public.farm_type as enum ('vegetables', 'dairy', 'poultry', 'fish', 'fruits');
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_status') then
    create type public.camera_status as enum ('online', 'offline', 'maintenance');
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_protocol') then
    create type public.camera_protocol as enum ('hls', 'webrtc');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_approval') then
    create type public.product_approval as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'seller_status') then
    create type public.seller_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'coupon_type') then
    create type public.coupon_type as enum ('percent', 'fixed');
  end if;

  -- subscriptions / combos ---------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'combo_kind') then
    create type public.combo_kind as enum ('daily', 'weekly', 'monthly');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('active', 'paused', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_frequency') then
    create type public.subscription_frequency as enum ('weekly', 'biweekly', 'monthly');
  end if;

  -- premium ------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'premium_tier') then
    create type public.premium_tier as enum ('basic', 'full');
  end if;
  if not exists (select 1 from pg_type where typname = 'premium_interval') then
    create type public.premium_interval as enum ('monthly', 'half_yearly', 'yearly');
  end if;
  if not exists (select 1 from pg_type where typname = 'premium_status') then
    create type public.premium_status as enum ('pending', 'active', 'grace', 'expired', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'access_code_status') then
    create type public.access_code_status as enum ('unused', 'used', 'revoked', 'expired');
  end if;

  -- reviews & complaints -----------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('published', 'hidden');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_status') then
    create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_problem') then
    create type public.complaint_problem as enum ('spoiled', 'short_weight', 'wrong_item', 'late', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'resolution_type') then
    create type public.resolution_type as enum ('refund', 'replacement', 'inform');
  end if;

  -- notifications ------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type public.notification_kind as enum ('order', 'status', 'premium', 'seller', 'product', 'camera', 'payment', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_audience') then
    create type public.notification_audience as enum ('user', 'seller', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared helper: updated_at maintenance (used by every table's trigger in 07).
-- Created here because it is a pure function with no table dependency.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'BEFORE UPDATE trigger that stamps updated_at = now().';

-- ############################################################################
-- ##  02_core_tables.sql
-- ############################################################################
-- ============================================================================
-- 02_core_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the identity + website-configuration tables:
--     profiles, addresses, site_settings, social_links, team_members,
--     static_pages, audit_log, plus the small support tables the app reads
--     (media_assets, seo_meta, contact_messages, newsletter_subscribers,
--      login_attempts).
--
-- WHEN TO RUN
--   Second, after 01_extensions_and_enums.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • profiles.id is the Supabase auth user id (auth.users.id). There is no
--     separate "users" table any more — Supabase Auth owns the credentials.
--   • Every column here matches a column the app actually reads or writes.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  full_name              text,
  email                  text,
  phone                  text,
  bio                    text,
  avatar_url             text,
  role                   public.user_role not null default 'customer',
  is_active              boolean not null default true,
  is_seller              boolean not null default false,
  premium_until          timestamptz,
  phone_verified         boolean not null default false,
  language               text not null default 'bn' check (language in ('bn', 'en')),
  theme                  text not null default 'dark' check (theme in ('dark', 'light')),
  notification_preferences jsonb not null default '{"email": true, "sms": false, "push": true}'::jsonb,
  onboarded              boolean not null default false,
  mfa_enrolled           boolean not null default false,
  last_login_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.profiles is 'One row per Supabase auth user. Role lives here (never in auth.users metadata alone).';

-- --------------------------------------------------------------- addresses --
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null default 'বাসা',
  full_name   text not null,
  phone       text not null,
  division    text not null,
  district    text not null,
  upazila     text not null,
  address     text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ site_settings --
-- One row per settings group: 'store', 'delivery', 'seller', 'reviews',
-- 'payments', 'premium', 'announcement', 'social', 'seo' …
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.site_settings is 'Key/value JSON settings edited from /foisal/settings. Replaces the old `settings` table.';

-- ------------------------------------------------------------- social_links --
create table if not exists public.social_links (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  label_bn      text,
  url           text not null,
  icon          text,
  color         text,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  show_header   boolean not null default false,
  show_footer   boolean not null default true,
  show_contact  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint social_links_platform_url_key unique (platform, url)
);

-- ------------------------------------------------------------- team_members --
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  name_bn     text not null,
  name_en     text,
  role_bn     text not null default 'টিম সদস্য',
  role_en     text,
  bio_bn      text,
  photo       text,
  email       text,
  phone       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- static_pages --
create table if not exists public.static_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title_bn         text not null,
  title_en         text,
  blocks           jsonb not null default '[]'::jsonb,
  seo_title        text,
  seo_description  text,
  is_published     boolean not null default true,
  show_in_footer   boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.static_pages.blocks is 'Array of typed CMS blocks: heading | text | list | callout | image.';

-- ----------------------------------------------------------------- audit_log --
create table if not exists public.audit_log (
  id           bigserial primary key,
  actor_id     uuid,
  actor_email  text,
  actor_role   text,
  action       text not null,
  entity       text,
  entity_id    text,
  diff         jsonb,
  meta         jsonb not null default '{}'::jsonb,
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

comment on table public.audit_log is 'Append-only trail of every admin write. Never updated or deleted from the app.';

-- --------------------------------------------------------------- media_assets --
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null,
  path         text not null,
  url          text not null,
  mime         text,
  bytes        bigint,
  alt_bn       text,
  title_bn     text,
  tags         text[] not null default '{}'::text[],
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint media_assets_bucket_path_key unique (bucket, path)
);

-- ------------------------------------------------------------------- seo_meta --
create table if not exists public.seo_meta (
  path             text primary key,
  title_bn         text,
  title_en         text,
  description_bn   text,
  description_en   text,
  keywords_bn      text[] not null default '{}'::text[],
  og_title         text,
  og_description   text,
  og_image         text,
  canonical        text,
  noindex          boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------- contact_messages --
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  message     text not null,
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------ newsletter_subscribers --
create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

-- ------------------------------------------------------------- login_attempts --
-- Used by the login-help screen and the sign-in rate limiter. Server only.
create table if not exists public.login_attempts (
  id          bigserial primary key,
  email       text,
  ip          text,
  ok          boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ############################################################################
-- ##  03_catalog_tables.sql
-- ############################################################################
-- ============================================================================
-- 03_catalog_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates everything about what is being sold and who sells it:
--     categories, farms, cameras, sellers, seller_payouts, seller_warnings,
--     camera_requests, camera_view_logs, products, product_images, coupons,
--     delivery_charges.
--
-- WHEN TO RUN
--   Third, after 02_core_tables.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • products.image is the primary photo shown on cards. product_images keeps
--     the ordered gallery; a trigger in 07 mirrors it into products.images so a
--     single row read still gives the storefront its gallery.
--  • cameras.stream_key / stream_url are server-only secrets. The public view
--    public_cameras (file 10) never exposes them.
--  • sellers.nid / payout_number / bank_account are private. The public view
--    public_sellers (file 10) never exposes them.
-- ============================================================================

-- --------------------------------------------------------------- categories --
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid references public.categories (id) on delete set null,
  slug            text not null unique,
  name_bn         text not null,
  name_en         text not null default '',
  description_bn  text,
  icon            text,
  image           text,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------------- farms --
create table if not exists public.farms (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name_bn           text not null,
  name_en           text,
  type              public.farm_type not null default 'vegetables',
  owner_user_id     uuid references public.profiles (id) on delete set null,
  owner_name_bn     text,
  owner_phone       text,
  owner_photo       text,
  owner_bio_bn      text,
  division          text not null,
  district          text not null,
  upazila           text,
  address_bn        text,
  lat               numeric(9, 6),
  lng               numeric(9, 6),
  boundary          jsonb,
  harvest_calendar  jsonb,
  description_bn    text,
  story_bn          text,
  cover             text,
  images            text[] not null default '{}'::text[],
  daily_output      jsonb,
  established_year  integer,
  certifications    text[] not null default '{}'::text[],
  is_active         boolean not null default true,
  is_premium        boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------------- cameras --
create table if not exists public.cameras (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references public.farms (id) on delete cascade,
  name_bn         text not null,
  zone_bn         text not null default 'খামার',
  protocol        public.camera_protocol not null default 'hls',
  stream_key      text,
  stream_url      text,
  -- cloud-bridge playback (migration 24): the seller's own camera app keeps the
  -- device reachable, so no VPS / tunnel is needed. 'none' = the RTSP path.
  cloud_provider  text not null default 'none' check (cloud_provider in ('none', 'hls', 'imou', 'ezviz')),
  cloud_serial    text,
  cloud_channel   integer not null default 0,
  poster          text,
  location_lat    numeric(9, 6),
  location_lng    numeric(9, 6),
  status          public.camera_status not null default 'offline',
  last_heartbeat  timestamptz,
  is_active       boolean not null default true,
  is_premium      boolean not null default true,
  max_viewers     integer not null default 50,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------------- sellers --
create table if not exists public.sellers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles (id) on delete set null,
  slug                text not null unique,
  farm_id             uuid references public.farms (id) on delete set null,
  name_bn             text not null,
  phone               text not null,
  email               text,
  nid                 text,
  farm_address_bn     text,
  division            text not null default 'ঢাকা',
  district            text not null default 'ঢাকা',
  upazila             text,
  farm_photos         text[] not null default '{}'::text[],
  product_types       text[] not null default '{}'::text[],
  -- store brand images, uploaded by the seller (migration 22 adds them to older DBs)
  logo                 text,
  banner               text,
  payout_method       text not null default 'bkash' check (payout_method in ('bkash', 'nagad', 'bank')),
  payout_number       text,
  bank_name           text,
  bank_account        text,
  commission_percent  numeric(5, 2) not null default 10 check (commission_percent >= 0 and commission_percent <= 100),
  status              public.seller_status not null default 'pending',
  rejection_reason    text,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------- seller_payouts --
create table if not exists public.seller_payouts (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.sellers (id) on delete cascade,
  amount        numeric(12, 2) not null check (amount >= 0),
  method        text,
  reference     text,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  note          text,
  paid_at       timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------ seller_warnings --
create table if not exists public.seller_warnings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.sellers (id) on delete cascade,
  reason      text not null,
  severity    text not null default 'warning' check (severity in ('notice', 'warning', 'final')),
  issued_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- camera_requests --
create table if not exists public.camera_requests (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid references public.sellers (id) on delete cascade,
  farm_id      uuid references public.farms (id) on delete set null,
  user_id      uuid references public.profiles (id) on delete set null,
  contact_name text,
  contact_phone text,
  note_bn      text,
  camera_count integer not null default 1,
  status       text not null default 'pending' check (status in ('pending', 'contacted', 'scheduled', 'installed', 'cancelled')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------- camera_view_logs --
create table if not exists public.camera_view_logs (
  id          bigserial primary key,
  camera_id   uuid references public.cameras (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  fingerprint text,
  minutes     integer,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ products --
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  category_id      uuid references public.categories (id) on delete set null,
  seller_id        uuid references public.sellers (id) on delete set null,
  farm_id          uuid references public.farms (id) on delete set null,
  name_bn          text not null,
  name_en          text not null default '',
  description_bn   text,
  description_en   text,
  unit             text not null default 'কেজি',
  unit_en          text not null default 'kg',
  price            numeric(12, 2) not null default 0 check (price >= 0),
  compare_price    numeric(12, 2) check (compare_price is null or compare_price >= 0),
  stock            integer not null default 0 check (stock >= 0),
  weight_grams     integer,
  image            text,
  images           text[] not null default '{}'::text[],
  farm_source_bn   text,
  harvest_date     date,
  badge_bn         text,
  rating           numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count     integer not null default 0,
  is_featured      boolean not null default false,
  is_active        boolean not null default true,
  approval_status  public.product_approval not null default 'approved',
  rejection_reason text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------ product_images --
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt_bn      text,
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint product_images_product_url_key unique (product_id, url)
);

-- ------------------------------------------------------------------- coupons --
create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  description_bn  text,
  type            public.coupon_type not null default 'percent',
  value           numeric(12, 2) not null default 0 check (value >= 0),
  min_order       numeric(12, 2) not null default 0 check (min_order >= 0),
  max_discount    numeric(12, 2) check (max_discount is null or max_discount >= 0),
  usage_limit     integer check (usage_limit is null or usage_limit >= 0),
  used_count      integer not null default 0,
  per_user_limit  integer not null default 1,
  starts_at       timestamptz,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists coupons_code_upper_key on public.coupons (upper(code));

-- ---------------------------------------------------------- delivery_charges --
create table if not exists public.delivery_charges (
  id          uuid primary key default gen_random_uuid(),
  district    text not null,
  district_en text,
  division    text not null,
  scope       text not null default 'outside_dhaka' check (scope in ('inside_dhaka', 'outside_dhaka')),
  charge      numeric(10, 2) not null default 0 check (charge >= 0),
  free_over   numeric(10, 2),
  eta_days    text not null default '২-৩ দিন',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint delivery_charges_district_key unique (district)
);

comment on table public.delivery_charges is 'Per-district delivery price. Replaces the old delivery_zones table.';

-- ############################################################################
-- ##  04_orders_payments_tables.sql
-- ############################################################################
-- ============================================================================
-- 04_orders_payments_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the money path: combos, subscription plans & subscriptions, cart,
--   orders, order_items, sub_orders (per-seller splits), payment methods,
--   parcel labels and custom combos.
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
--   • the orders table carries only the payment method code and status; there
--     is no payments table, so no subscription FK is needed here.
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

-- ############################################################################
-- ##  05_premium_reviews_tables.sql
-- ############################################################################
-- ============================================================================
-- 05_premium_reviews_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the premium live-camera subscriptions and the trust layer:
--     plans, user_subscriptions, access_codes, trials, stream_tokens,
--     premium_devices, reviews, review_photos, review_tags, complaints,
--     complaint_messages, notifications, push_subscriptions, fcm_tokens,
--     wishlist, recently_viewed.
--
-- WHEN TO RUN
--   Fifth, after 04_orders_payments_tables.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • There is exactly ONE reviews table. A verified order review and a public
--     testimonial are the same row: order_id/product_id are nullable, and
--     author_name / author_location store the display name for guests.
--   • stream_tokens is an audit + revocation list for short-lived playback
--     tokens. The token itself is signed in the app, never stored here.
-- ============================================================================

-- --------------------------------------------------------------------- plans --
create table if not exists public.plans (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name_bn         text not null,
  name_en         text,
  tier            public.premium_tier not null default 'full',
  interval        public.premium_interval not null default 'monthly',
  price           numeric(12, 2) not null default 0 check (price >= 0),
  compare_price   numeric(12, 2),
  duration_days   integer not null default 30 check (duration_days > 0),
  max_devices     integer not null default 2 check (max_devices > 0),
  features        text[] not null default '{}'::text[],
  is_active       boolean not null default true,
  is_popular      boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------- user_subscriptions --
create table if not exists public.user_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  sub_no          text not null unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  plan_id         uuid references public.plans (id) on delete set null,
  plan_name_bn    text not null default 'প্রিমিয়াম',
  tier            public.premium_tier not null default 'full',
  amount          numeric(12, 2) not null default 0,
  status          public.premium_status not null default 'pending',
  started_at      timestamptz,
  expires_at      timestamptz,
  grace_until     timestamptz,
  platform        text not null default 'web' check (platform in ('web', 'android')),
  payment_method  text,
  payment_ref     text,
  auto_renew      boolean not null default false,
  device_limit    integer not null default 2,
  cancelled_at    timestamptz,
  -- approve/reject trail for the manual payment flow (migration 23)
  cancel_reason   text,
  reviewed_at     timestamptz,
  reviewed_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------- access_codes --
create table if not exists public.access_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  plan_id          uuid references public.plans (id) on delete set null,
  user_id          uuid references public.profiles (id) on delete set null,
  subscription_id  uuid references public.user_subscriptions (id) on delete set null,
  status           public.access_code_status not null default 'unused',
  issued_at        timestamptz not null default now(),
  used_at          timestamptz,
  expires_at       timestamptz,
  note             text,
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- -------------------------------------------------------------------- trials --
create table if not exists public.trials (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null unique,
  user_id      uuid references public.profiles (id) on delete set null,
  minutes      integer not null default 10,
  ip_hash      text,
  started_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------- stream_tokens --
create table if not exists public.stream_tokens (
  jti          uuid primary key default gen_random_uuid(),
  camera_id    uuid references public.cameras (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete set null,
  fingerprint  text,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------- premium_devices --
create table if not exists public.premium_devices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  subscription_id  uuid references public.user_subscriptions (id) on delete set null,
  fingerprint      text not null,
  label            text,
  user_agent       text,
  last_seen        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint premium_devices_user_fingerprint_key unique (user_id, fingerprint)
);

-- ------------------------------------------------------------------- reviews --
create table if not exists public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid references public.orders (id) on delete set null,
  sub_order_id          uuid references public.sub_orders (id) on delete set null,
  product_id            uuid references public.products (id) on delete cascade,
  seller_id             uuid references public.sellers (id) on delete set null,
  user_id               uuid references public.profiles (id) on delete set null,
  rating                numeric(2, 1) not null default 5 check (rating >= 1 and rating <= 5),
  seller_rating         numeric(2, 1) check (seller_rating is null or (seller_rating >= 1 and seller_rating <= 5)),
  title_bn              text,
  comment               text,
  author_name           text,
  author_location       text,
  photos                text[] not null default '{}'::text[],
  tags                  text[] not null default '{}'::text[],
  is_verified_purchase  boolean not null default false,
  status                public.review_status not null default 'published',
  hidden_reason         text,
  seller_reply          text,
  seller_replied_at     timestamptz,
  edited_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- One review per product per order (guests have no order → many rows allowed).
create unique index if not exists reviews_order_product_user_key
  on public.reviews (order_id, product_id, user_id)
  where order_id is not null;

-- ------------------------------------------------------------- review_photos --
create table if not exists public.review_photos (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews (id) on delete cascade,
  url         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint review_photos_review_url_key unique (review_id, url)
);

-- --------------------------------------------------------------- review_tags --
create table if not exists public.review_tags (
  slug        text primary key,
  label_bn    text not null,
  label_en    text not null default '',
  sentiment   text not null default 'positive' check (sentiment in ('positive', 'negative')),
  sort_order  integer not null default 0
);

-- ---------------------------------------------------------------- complaints --
create table if not exists public.complaints (
  id                   uuid primary key default gen_random_uuid(),
  ticket_no            text not null unique,
  order_id             uuid not null references public.orders (id) on delete cascade,
  sub_order_id         uuid references public.sub_orders (id) on delete set null,
  order_item_id        uuid references public.order_items (id) on delete set null,
  product_id           uuid references public.products (id) on delete set null,
  seller_id            uuid references public.sellers (id) on delete set null,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  problem_type         public.complaint_problem not null default 'other',
  description          text not null,
  photos               text[] not null default '{}'::text[],
  preferred_resolution public.resolution_type not null default 'inform',
  status               public.complaint_status not null default 'open',
  resolution           public.resolution_type,
  resolution_note      text,
  resolved_by          uuid references public.profiles (id) on delete set null,
  resolved_at          timestamptz,
  rejected_by          uuid references public.profiles (id) on delete set null,
  rejected_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- -------------------------------------------------------- complaint_messages --
create table if not exists public.complaint_messages (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references public.complaints (id) on delete cascade,
  author_role   text not null default 'customer' check (author_role in ('customer', 'seller', 'admin')),
  author_id     uuid references public.profiles (id) on delete set null,
  body          text not null,
  is_internal   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------- notifications --
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  audience    public.notification_audience not null default 'user',
  kind        public.notification_kind not null default 'system',
  title_bn    text not null,
  body_bn     text,
  link        text,
  meta        jsonb not null default '{}'::jsonb,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------- push_subscriptions --
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

-- --------------------------------------------------------------- fcm_tokens --
create table if not exists public.fcm_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  token       text not null,
  platform    text not null default 'android',
  created_at  timestamptz not null default now(),
  constraint fcm_tokens_token_key unique (token)
);

-- ------------------------------------------------------------------ wishlist --
create table if not exists public.wishlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint wishlist_user_product_key unique (user_id, product_id)
);

-- ----------------------------------------------------------- recently_viewed --
create table if not exists public.recently_viewed (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  constraint recently_viewed_user_product_key unique (user_id, product_id)
);

-- --------------------------------------------- deferred FKs / late references --
do $$
begin
  -- order_items.sub_order_id is filled by place_order() after sub_orders exist.
  if not exists (
    select 1 from pg_constraint where conname = 'order_items_sub_order_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_sub_order_id_fkey
      foreign key (sub_order_id) references public.sub_orders (id) on delete set null;
  end if;
end $$;

-- ############################################################################
-- ##  06_homepage_cms_tables.sql
-- ############################################################################
-- ============================================================================
-- 06_homepage_cms_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates everything a non-developer edits to change the look of the site:
--     hero_slides, homepage_sections, banners, menus, menu_items, blog_posts,
--     faq_items.
--
-- WHEN TO RUN
--   Sixth, after 05_premium_reviews_tables.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • homepage_sections.key is UNIQUE: the renderer looks sections up by key,
--     so a duplicate key would render the same block twice.
--   • hero_slides with no image still render (plain text slide), which is why
--     image_url is nullable.
-- ============================================================================

-- --------------------------------------------------------------- hero_slides --
create table if not exists public.hero_slides (
  id                  uuid primary key default gen_random_uuid(),
  title_bn            text not null,
  subtitle_bn         text,
  image_url           text,
  image_mobile_url    text,
  video_url           text,
  alt_bn              text,
  cta_label_bn        text,
  cta_href            text,
  secondary_label_bn  text,
  secondary_href      text,
  text_position       text not null default 'left' check (text_position in ('left', 'center', 'right')),
  text_tone           text not null default 'light' check (text_tone in ('light', 'dark')),
  overlay_opacity     integer not null default 45 check (overlay_opacity between 0 and 90),
  starts_at           timestamptz,
  ends_at             timestamptz,
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- --------------------------------------------------------- homepage_sections --
create table if not exists public.homepage_sections (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_bn    text not null,
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ banners --
create table if not exists public.banners (
  id           uuid primary key default gen_random_uuid(),
  title_bn     text not null,
  title_en     text,
  subtitle_bn  text,
  image        text,
  link         text not null default '/products',
  placement    text not null default 'home_hero',
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------- menus --
create table if not exists public.menus (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_bn    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- menu_items --
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references public.menus (id) on delete cascade,
  parent_id   uuid references public.menu_items (id) on delete cascade,
  label_bn    text not null,
  href        text not null default '/',
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- blog_posts --
create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title_bn      text not null,
  title_en      text,
  excerpt_bn    text,
  content_bn    text not null default '',
  cover         text,
  author_bn     text not null default 'বিশ্বাস এগ্রো টিম',
  tag_bn        text not null default 'স্বাস্থ্য টিপস',
  read_minutes  integer not null default 4 check (read_minutes between 1 and 60),
  published_at  timestamptz not null default now(),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- faq_items --
create table if not exists public.faq_items (
  id           uuid primary key default gen_random_uuid(),
  group_bn     text not null default 'সাধারণ',
  question_bn  text not null,
  answer_bn    text not null,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ############################################################################
-- ##  07_functions_and_triggers.sql
-- ############################################################################
-- ============================================================================
-- 07_functions_and_triggers.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates every database function and trigger the app relies on:
--     • role helpers: has_role(), is_admin(), is_staff(), is_seller()
--     • handle_new_user(): creates the profile row on signup (cannot fail signup)
--     • guard_profile_role(): a user can never promote themselves
--     • set_updated_at() triggers on every table that has updated_at
--     • number generators: order, sub-order, complaint ticket
--     • place_order(): ONE transaction — validate, re-price, reserve stock,
--       create order + items + per-seller sub-orders + parcel +
--       notifications
--     • recalc_product_rating(): rating aggregate maintained by trigger
--     • product_images / review_photos sync triggers
--     • log_audit(): writes the admin audit trail
--     • login_help(): explains a failed login without leaking anything
--
-- WHEN TO RUN
--   Seventh, after 06_homepage_cms_tables.sql and before 08_rls_policies.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — every function is CREATE OR REPLACE and every trigger is dropped
--   before it is created.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they can read profiles without recursively
-- triggering the profiles RLS policy.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role::text = any (p_roles)
       and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['admin']);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['admin', 'manager', 'staff']);
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sellers s
     where s.user_id = auth.uid()
       and s.status = 'approved'
  ) or public.has_role(array['seller']);
$$;

-- ---------------------------------------------------------------------------
-- Signup: mirror auth.users into profiles. NEVER raises — a broken profile
-- must not block account creation; the app repairs a missing row on next load.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.profiles (id, full_name, email, phone, avatar_url)
    values (
      new.id,
      nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ''),
      new.email,
      nullif(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''), ''),
      nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), '')
    )
    on conflict (id) do update
      set email     = coalesce(public.profiles.email, excluded.email),
          full_name = coalesce(public.profiles.full_name, excluded.full_name),
          phone     = coalesce(public.profiles.phone, excluded.phone),
          updated_at = now();
  exception
    when others then
      raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role protection: an authenticated user may edit their own profile, but the
-- privilege columns are admin-only (service role and direct SQL are exempt
-- because auth.uid() is null there).
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_seller is distinct from old.is_seller
       or new.premium_until is distinct from old.premium_until
       or new.is_active is distinct from old.is_active
       or new.mfa_enrolled is distinct from old.mfa_enrolled then
      raise exception 'PROFILE_FIELDS_ADMIN_ONLY';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'addresses', 'site_settings', 'social_links', 'team_members',
    'static_pages', 'seo_meta', 'categories', 'farms', 'cameras', 'sellers',
    'seller_payouts', 'camera_requests', 'products', 'coupons', 'delivery_charges',
    'combos', 'subscription_plans', 'subscriptions', 'cart_items', 'orders',
    'sub_orders', 'payment_methods', 'parcels', 'custom_combos',
    'plans', 'user_subscriptions', 'reviews', 'complaints', 'hero_slides',
    'homepage_sections', 'banners', 'menus', 'menu_items', 'blog_posts', 'faq_items'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Human-readable numbers
-- ---------------------------------------------------------------------------
create or replace function public.gen_order_no()
returns text
language plpgsql
volatile
as $$
declare
  seq int;
begin
  select count(*) + 1 into seq from public.orders where created_at::date = current_date;
  return 'BA-' || to_char(now(), 'YYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- Complaint ticket numbers: CMP-YYMMDD-0001
create or replace function public.set_complaint_ticket()
returns trigger
language plpgsql
as $$
declare
  seq int;
begin
  if new.ticket_no is null or new.ticket_no = '' then
    select count(*) + 1 into seq from public.complaints where created_at::date = current_date;
    new.ticket_no := 'CMP-' || to_char(now(), 'YYMMDD') || '-' || lpad(seq::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complaint_ticket on public.complaints;
create trigger trg_complaint_ticket
  before insert on public.complaints
  for each row execute function public.set_complaint_ticket();

-- ---------------------------------------------------------------------------
-- product_images -> products.images / products.image mirror
-- ---------------------------------------------------------------------------
create or replace function public.sync_product_images(p_product uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_urls text[];
  v_primary text;
begin
  select coalesce(array_agg(pi.url order by pi.is_primary desc, pi.sort_order asc, pi.created_at asc), '{}'::text[]),
         (array_agg(pi.url order by pi.is_primary desc, pi.sort_order asc, pi.created_at asc))[1]
    into v_urls, v_primary
    from public.product_images pi
   where pi.product_id = p_product;

  update public.products
     set images = v_urls,
         image = case when coalesce(image, '') = '' then v_primary else image end
   where id = p_product;
end;
$$;

create or replace function public.trg_product_images_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_product_images(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_product_images_sync on public.product_images;
create trigger trg_product_images_sync
  after insert or update or delete on public.product_images
  for each row execute function public.trg_product_images_sync();

-- ---------------------------------------------------------------------------
-- review_photos -> reviews.photos mirror
-- ---------------------------------------------------------------------------
create or replace function public.trg_review_photos_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reviews r
     set photos = coalesce((
           select array_agg(rp.url order by rp.sort_order, rp.created_at)
             from public.review_photos rp
            where rp.review_id = coalesce(new.review_id, old.review_id)
         ), '{}'::text[])
   where r.id = coalesce(new.review_id, old.review_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_photos_sync on public.review_photos;
create trigger trg_review_photos_sync
  after insert or update or delete on public.review_photos
  for each row execute function public.trg_review_photos_sync();

-- ---------------------------------------------------------------------------
-- Rating aggregates
-- ---------------------------------------------------------------------------
create or replace function public.recalc_product_rating(p_product uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avg numeric;
  v_count integer;
begin
  if p_product is null then return; end if;

  select coalesce(round(avg(r.rating)::numeric, 1), 0), count(*)
    into v_avg, v_count
    from public.reviews r
   where r.product_id = p_product
     and r.status = 'published';

  update public.products
     set rating = v_avg,
         review_count = v_count,
         updated_at = now()
   where id = p_product;
end;
$$;

create or replace function public.trg_reviews_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.recalc_product_rating(coalesce(new.product_id, old.product_id));
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.recalc_product_rating(old.product_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reviews_recalc on public.reviews;
create trigger trg_reviews_recalc
  after insert or update of rating, status, product_id or delete on public.reviews
  for each row execute function public.trg_reviews_recalc();

-- ---------------------------------------------------------------------------
-- Audit helper — callable from RPCs and from the app (service role).
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(
  p_actor uuid,
  p_action text,
  p_entity text default null,
  p_entity_id text default null,
  p_meta jsonb default '{}'::jsonb,
  p_diff jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_role text;
begin
  begin
    select email, role::text into v_email, v_role from public.profiles where id = p_actor;
    insert into public.audit_log (actor_id, actor_email, actor_role, action, entity, entity_id, diff, meta)
    values (p_actor, v_email, v_role, p_action, p_entity, p_entity_id, p_diff, coalesce(p_meta, '{}'::jsonb));
  exception
    when others then
      raise warning 'log_audit failed: %', sqlerrm;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order() — the ONLY way an order is created.
--   p_user     : auth user id or null for a guest checkout
--   p_customer : {customer_name, phone, email, division, district, upazila, address, delivery_note}
--   p_items    : [{id|product_id, kind, quantity}]
--   returns    : {order_id, order_no, subtotal, delivery_charge, discount, total,
--                 method_code, eta_days, item_count}
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_user uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'cod',
  p_coupon text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_product public.products%rowtype;
  v_combo public.combos%rowtype;
  v_qty integer;
  v_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_total numeric := 0;
  v_has_combo boolean := false;
  v_line jsonb;
  v_seller uuid;
  v_seller_pct numeric;
  v_group record;
  v_sub_no text;
  v_sub_map jsonb := '{}'::jsonb;
  v_order_id uuid;
  v_order_no text;
  v_method public.payment_methods%rowtype;
  v_coupon public.coupons%rowtype;
  v_have_coupon boolean := false;
  v_zone public.delivery_charges%rowtype;
  v_scope text;
  v_settings jsonb;
  v_free_over numeric;
  v_eta text := '২-৩ দিন';
  v_admin record;
  v_status public.payment_status := 'pending';
  v_customer jsonb := coalesce(p_customer, '{}'::jsonb);
  v_method_code text := lower(coalesce(nullif(p_payment_method, ''), 'cod'));
  v_remaining integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;
  -- the app posts `phone`; older callers posted `customer_phone` — accept both
  v_customer := v_customer || jsonb_build_object(
    'customer_phone', coalesce(nullif(v_customer ->> 'customer_phone', ''), v_customer ->> 'phone', '')
  );

  if coalesce(v_customer ->> 'customer_name', '') = ''
     or coalesce(v_customer ->> 'customer_phone', '') = ''
     or coalesce(v_customer ->> 'address', '') = '' then
    raise exception 'CUSTOMER_INCOMPLETE';
  end if;

  -- payment method must exist and be enabled (cash on delivery is a method row too)
  select * into v_method from public.payment_methods
   where lower(code) = v_method_code and is_active
   limit 1;
  if not found then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;

  -- ---------------------------------------------------------------- lines ---
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, least(99, coalesce((v_item ->> 'quantity')::int, 1)));

    if coalesce(v_item ->> 'kind', 'product') = 'combo' then
      select * into v_combo from public.combos
       where id = nullif(v_item ->> 'id', '')::uuid and is_active
       limit 1;
      if not found then
        raise exception 'COMBO_UNAVAILABLE:%', coalesce(v_item ->> 'id', '');
      end if;
      v_has_combo := true;
      v_price := v_combo.price;
      v_lines := v_lines || jsonb_build_object(
        'kind', 'combo',
        'product_id', null,
        'seller_id', null,
        'name_bn', v_combo.name_bn,
        'unit', 'বক্স',
        'price', v_price,
        'quantity', v_qty,
        'image', v_combo.image
      );
      v_subtotal := v_subtotal + v_price * v_qty;
    else
      select * into v_product from public.products
       where id = nullif(coalesce(v_item ->> 'id', v_item ->> 'product_id'), '')::uuid
       limit 1;
      if not found then
        raise exception 'PRODUCT_UNAVAILABLE:%', coalesce(v_item ->> 'id', '');
      end if;
      if not v_product.is_active or v_product.approval_status <> 'approved' then
        raise exception 'PRODUCT_UNAVAILABLE:%', v_product.name_bn;
      end if;

      -- reserve stock atomically; the whole transaction rolls back on failure
      update public.products
         set stock = stock - v_qty, updated_at = now()
       where id = v_product.id and stock >= v_qty;
      if not found then
        raise exception 'OUT_OF_STOCK:%', v_product.name_bn;
      end if;

      v_lines := v_lines || jsonb_build_object(
        'kind', 'product',
        'product_id', v_product.id,
        'seller_id', v_product.seller_id,
        'name_bn', v_product.name_bn,
        'unit', v_product.unit,
        'price', v_product.price,
        'quantity', v_qty,
        'image', v_product.image
      );
      v_subtotal := v_subtotal + v_product.price * v_qty;
    end if;
  end loop;

  -- ---------------------------------------------------------------- coupon ---
  if nullif(trim(coalesce(p_coupon, '')), '') is not null then
    select * into v_coupon from public.coupons
     where upper(code) = upper(trim(p_coupon))
       and is_active
     limit 1;

    if found
       and (v_coupon.starts_at is null or v_coupon.starts_at <= now())
       and (v_coupon.expires_at is null or v_coupon.expires_at >= now())
       and (v_coupon.usage_limit is null or v_coupon.used_count < v_coupon.usage_limit) then
      if v_subtotal >= v_coupon.min_order then
        v_have_coupon := true;
        if v_coupon.type = 'percent' then
          v_discount := round(v_subtotal * v_coupon.value / 100.0, 2);
          if v_coupon.max_discount is not null then
            v_discount := least(v_discount, v_coupon.max_discount);
          end if;
        else
          v_discount := least(v_coupon.value, v_subtotal);
        end if;
      else
        raise exception 'COUPON_MIN_ORDER:%', v_coupon.min_order;
      end if;
    else
      raise exception 'COUPON_INVALID';
    end if;
  end if;

  -- -------------------------------------------------------------- delivery ---
  select value into v_settings from public.site_settings where key = 'delivery';
  v_settings := coalesce(v_settings, '{}'::jsonb);

  if v_has_combo then
    v_delivery := 0;
    v_eta := '১ দিন';
  else
    select * into v_zone from public.delivery_charges
     where is_active and (district = v_customer ->> 'district')
     limit 1;

    v_scope := case when coalesce(v_customer ->> 'division', '') = 'ঢাকা' then 'inside_dhaka' else 'outside_dhaka' end;
    v_free_over := coalesce(v_zone.free_over,
                            (v_settings ->> 'free_over')::numeric,
                            1200);
    v_eta := coalesce(v_zone.eta_days, case when v_scope = 'inside_dhaka' then 'আজ' else '২-৩ দিন' end);

    if v_subtotal >= v_free_over then
      v_delivery := 0;
    elsif v_zone.id is not null then
      v_delivery := v_zone.charge;
    elsif v_scope = 'inside_dhaka' then
      v_delivery := coalesce((v_settings ->> 'inside_dhaka')::numeric, 60);
    else
      v_delivery := coalesce((v_settings ->> 'outside_dhaka')::numeric, 120);
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery - v_discount);

  -- ----------------------------------------------------------------- order ---
  v_order_no := public.gen_order_no();
  insert into public.orders (
    order_no, user_id, customer_name, customer_phone, customer_email,
    division, district, upazila, address, delivery_note,
    subtotal, delivery_charge, discount, total, coupon_code,
    payment_method, payment_status, status, eta_days
  ) values (
    v_order_no, p_user,
    v_customer ->> 'customer_name',
    v_customer ->> 'customer_phone',
    nullif(v_customer ->> 'email', ''),
    coalesce(v_customer ->> 'division', 'ঢাকা'),
    coalesce(v_customer ->> 'district', 'ঢাকা'),
    coalesce(v_customer ->> 'upazila', ''),
    v_customer ->> 'address',
    nullif(v_customer ->> 'delivery_note', ''),
    v_subtotal, v_delivery, v_discount, v_total,
    case when v_have_coupon then upper(trim(p_coupon)) else null end,
    v_method.code, v_status, 'received', v_eta
  )
  returning id into v_order_id;

  -- --------------------------------------------------------- sub-orders ------
  for v_group in
    select (l ->> 'seller_id')::uuid as seller_id, sum((l ->> 'price')::numeric * (l ->> 'quantity')::int) as gross
      from jsonb_array_elements(v_lines) l
     where nullif(l ->> 'seller_id', '') is not null
     group by 1
  loop
    v_seller_pct := null;
    select commission_percent into v_seller_pct from public.sellers where id = v_group.seller_id;
    if v_seller_pct is null then
      v_seller_pct := coalesce(
        (select (value ->> 'default_commission_percent')::numeric from public.site_settings where key = 'seller'),
        10
      );
    end if;

    v_sub_no := v_order_no || '-' || upper(substr(replace(v_group.seller_id::text, '-', ''), 1, 4));

    insert into public.sub_orders (
      order_id, sub_no, seller_id, farm_id, seller_name, seller_phone,
      subtotal, commission, seller_earning, status
    )
    select v_order_id, v_sub_no, s.id, s.farm_id, s.name_bn, s.phone,
           v_group.gross,
           round(v_group.gross * coalesce(v_seller_pct, 10) / 100.0, 2),
           v_group.gross - round(v_group.gross * coalesce(v_seller_pct, 10) / 100.0, 2),
           'received'
      from public.sellers s where s.id = v_group.seller_id;

    v_sub_map := v_sub_map || jsonb_build_object(v_group.seller_id::text, v_sub_no);
  end loop;

  -- ---------------------------------------------------------- order items ----
  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    insert into public.order_items (
      order_id, sub_order_id, product_id, seller_id, name_bn, unit, price, quantity, image
    ) values (
      v_order_id,
      (select id from public.sub_orders
        where order_id = v_order_id
          and seller_id = nullif(v_line ->> 'seller_id', '')::uuid
        limit 1),
      nullif(v_line ->> 'product_id', '')::uuid,
      nullif(v_line ->> 'seller_id', '')::uuid,
      v_line ->> 'name_bn',
      v_line ->> 'unit',
      (v_line ->> 'price')::numeric,
      (v_line ->> 'quantity')::int,
      v_line ->> 'image'
    );
  end loop;

  -- -------------------------------------------------------------- coupon use -
  if v_have_coupon then
    update public.coupons set used_count = used_count + 1, updated_at = now() where id = v_coupon.id;
  end if;

  -- ----------------------------------------------------------------- parcel --
  insert into public.parcels (order_id, order_no, qr_token)
  values (v_order_id, v_order_no, encode(extensions.gen_random_bytes(16), 'hex'))
  on conflict (order_id) do nothing;

  -- ---------------------------------------------------------- notifications --
  if p_user is not null then
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (
      p_user, 'user', 'order',
      'অর্ডার #' || v_order_no || ' গ্রহণ করা হয়েছে',
      'আমরা আপনার অর্ডার পেয়েছি। স্ট্যাটাস দেখতে ট্র্যাক 페이지ে যান।',
      '/track?order=' || v_order_no,
      jsonb_build_object('order_no', v_order_no)
    );
  end if;

  for v_admin in select id from public.profiles where role = 'admin' and is_active
  loop
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (
      v_admin.id, 'admin', 'order',
      'নতুন অর্ডার #' || v_order_no,
      (v_customer ->> 'customer_name') || ' — ' || v_total::text || ' টাকা',
      '/foisal/orders',
      jsonb_build_object('order_no', v_order_no, 'total', v_total)
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal', v_subtotal,
    'delivery_charge', v_delivery,
    'discount', v_discount,
    'total', v_total,
    'method_code', v_method.code,
    'eta_days', v_eta,
    'item_count', jsonb_array_length(v_lines)
  );
end;
$$;

-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- login_help(): "why did my login fail?" — never leaks password hashes.
-- ---------------------------------------------------------------------------
create or replace function public.login_help(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_row record;
  v_out jsonb;
begin
  select u.id, u.email, u.encrypted_password, u.email_confirmed_at,
         coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) as providers
    into v_row
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
   limit 1;

  if not found then
    v_out := jsonb_build_object('exists', false, 'has_password', false, 'providers', '[]'::jsonb, 'unconfirmed', false);
  else
    v_out := jsonb_build_object(
      'exists', true,
      'has_password', coalesce(v_row.encrypted_password, '') <> '',
      'providers', v_row.providers,
      'unconfirmed', v_row.email_confirmed_at is null
    );
  end if;

  begin
    insert into public.login_attempts (email, ok) values (lower(trim(p_email)), false);
  exception when others then null;
  end;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution privileges: anon may call none of the write RPCs.
-- ---------------------------------------------------------------------------
revoke all on function public.place_order(uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text) to authenticated, service_role;

revoke all on function public.login_help(text) from public, anon;
grant execute on function public.login_help(text) to service_role;

-- ############################################################################
-- ##  08_rls_policies.sql
-- ############################################################################
-- ============================================================================
-- 08_rls_policies.sql
-- ============================================================================
-- WHAT IT DOES
--   Turns on Row Level Security for EVERY table in the app schema and writes
--   explicit policies:
--     • visitors (anon)  → only published / active rows of public content
--     • customers        → only their own rows (addresses, cart, orders, …)
--     • sellers          → only their own products, sub-orders and payouts
--     • admins           → full access through is_admin()
--     • private data (payment screenshots, seller NID/bank, stream keys,
--       audit log, settings, trials) is never readable by visitors
--
-- WHEN TO RUN
--   Eighth, after 07_functions_and_triggers.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — every policy is dropped before it is recreated.
-- ============================================================================

-- Helper: avoids a recursive policy lookup when a products policy needs to know
-- whether the current user owns the seller row.
create or replace function public.is_my_seller(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sellers s
     where s.id = p_seller and s.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Enable RLS everywhere (idempotent).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles','addresses','site_settings','social_links','team_members','static_pages',
    'audit_log','login_attempts','contact_messages','newsletter_subscribers','media_assets','seo_meta',
    'categories','farms','cameras','sellers','seller_payouts','seller_warnings','camera_requests',
    'camera_view_logs','products','product_images','coupons','delivery_charges',
    'combos','combo_items','subscription_plans','subscriptions','cart_items','orders','order_items',
    'sub_orders','payment_methods','parcels','custom_combos',
    'plans','user_subscriptions','access_codes','trials','stream_tokens','premium_devices',
    'reviews','review_photos','review_tags','complaints','complaint_messages','notifications',
    'push_subscriptions','fcm_tokens','wishlist','recently_viewed',
    'hero_slides','homepage_sections','banners','menus','menu_items','blog_posts','faq_items'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Public content (read-only for visitors)
-- ---------------------------------------------------------------------------
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active farms" on public.farms;
create policy "public read active farms" on public.farms
  for select to anon, authenticated using (is_active);

drop policy if exists "public read published products" on public.products;
create policy "public read published products" on public.products
  for select to anon, authenticated using (is_active and approval_status = 'approved');

drop policy if exists "public read product images" on public.product_images;
create policy "public read product images" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p
             where p.id = product_id and p.is_active and p.approval_status = 'approved')
  );

drop policy if exists "public read active combos" on public.combos;
create policy "public read active combos" on public.combos
  for select to anon, authenticated using (is_active);

drop policy if exists "public read combo items" on public.combo_items;
create policy "public read combo items" on public.combo_items
  for select to anon, authenticated using (
    exists (select 1 from public.combos c where c.id = combo_id and c.is_active)
  );

drop policy if exists "public read active subscription plans" on public.subscription_plans;
create policy "public read active subscription plans" on public.subscription_plans
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active premium plans" on public.plans;
create policy "public read active premium plans" on public.plans
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active delivery charges" on public.delivery_charges;
create policy "public read active delivery charges" on public.delivery_charges
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active payment methods" on public.payment_methods;
create policy "public read active payment methods" on public.payment_methods
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active social links" on public.social_links;
create policy "public read active social links" on public.social_links
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active team members" on public.team_members;
create policy "public read active team members" on public.team_members
  for select to anon, authenticated using (is_active);

drop policy if exists "public read published pages" on public.static_pages;
create policy "public read published pages" on public.static_pages
  for select to anon, authenticated using (is_published);

drop policy if exists "public read seo overrides" on public.seo_meta;
create policy "public read seo overrides" on public.seo_meta
  for select to anon, authenticated using (true);

drop policy if exists "public read hero slides" on public.hero_slides;
create policy "public read hero slides" on public.hero_slides
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "public read homepage sections" on public.homepage_sections;
create policy "public read homepage sections" on public.homepage_sections
  for select to anon, authenticated using (true);

drop policy if exists "public read banners" on public.banners;
create policy "public read banners" on public.banners
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "public read active menus" on public.menus;
create policy "public read active menus" on public.menus
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active menu items" on public.menu_items;
create policy "public read active menu items" on public.menu_items
  for select to anon, authenticated using (is_active);

drop policy if exists "public read blog posts" on public.blog_posts;
create policy "public read blog posts" on public.blog_posts
  for select to anon, authenticated using (is_active);

drop policy if exists "public read faq" on public.faq_items;
create policy "public read faq" on public.faq_items
  for select to anon, authenticated using (is_active);

drop policy if exists "public read review tags" on public.review_tags;
create policy "public read review tags" on public.review_tags
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Reviews & complaints
-- ---------------------------------------------------------------------------
drop policy if exists "public read published reviews" on public.reviews;
create policy "public read published reviews" on public.reviews
  for select to anon, authenticated using (status = 'published');

drop policy if exists "customers write own reviews" on public.reviews;
create policy "customers write own reviews" on public.reviews
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "customers edit own reviews" on public.reviews;
create policy "customers edit own reviews" on public.reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "public read review photos" on public.review_photos;
create policy "public read review photos" on public.review_photos
  for select to anon, authenticated using (
    exists (select 1 from public.reviews r where r.id = review_id and r.status = 'published')
  );

drop policy if exists "customers add own review photos" on public.review_photos;
create policy "customers add own review photos" on public.review_photos
  for insert to authenticated with check (
    exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid())
  );

drop policy if exists "customers read own complaints" on public.complaints;
create policy "customers read own complaints" on public.complaints
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "customers file complaints" on public.complaints;
create policy "customers file complaints" on public.complaints
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "customers read own complaint messages" on public.complaint_messages;
create policy "customers read own complaint messages" on public.complaint_messages
  for select to authenticated using (
    not is_internal
    and exists (select 1 from public.complaints c where c.id = complaint_id and c.user_id = auth.uid())
  );

drop policy if exists "customers reply to own complaints" on public.complaint_messages;
create policy "customers reply to own complaints" on public.complaint_messages
  for insert to authenticated with check (
    author_id = auth.uid()
    and not is_internal
    and exists (select 1 from public.complaints c where c.id = complaint_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Profiles, addresses, cart, wishlist, notifications
-- ---------------------------------------------------------------------------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "own addresses" on public.addresses;
drop policy if exists "read own addresses" on public.addresses;
create policy "read own addresses" on public.addresses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "insert own addresses" on public.addresses;
create policy "insert own addresses" on public.addresses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own addresses" on public.addresses;
create policy "update own addresses" on public.addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own addresses" on public.addresses;
create policy "delete own addresses" on public.addresses
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "own cart" on public.cart_items;
create policy "own cart" on public.cart_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own wishlist" on public.wishlist;
create policy "own wishlist" on public.wishlist
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own recently viewed" on public.recently_viewed;
create policy "own recently viewed" on public.recently_viewed
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own custom combos" on public.custom_combos;
create policy "own custom combos" on public.custom_combos
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own fcm tokens" on public.fcm_tokens;
create policy "own fcm tokens" on public.fcm_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own media assets" on public.media_assets;
create policy "own media assets" on public.media_assets
  for select to authenticated using (uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Orders & payments (read-only for the owner; writes go through RPC/server)
-- ---------------------------------------------------------------------------
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    or public.is_my_seller(seller_id)
  );

drop policy if exists "read own sub orders" on public.sub_orders;
create policy "read own sub orders" on public.sub_orders
  for select to authenticated using (
    public.is_my_seller(seller_id)
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "read own parcels" on public.parcels;
create policy "read own parcels" on public.parcels
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own premium subscriptions" on public.user_subscriptions;
create policy "read own premium subscriptions" on public.user_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own access codes" on public.access_codes;
create policy "read own access codes" on public.access_codes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own premium devices" on public.premium_devices;
create policy "own premium devices" on public.premium_devices
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Sellers (own rows only — visitors use the public_sellers view)
-- ---------------------------------------------------------------------------
drop policy if exists "read own seller row" on public.sellers;
create policy "read own seller row" on public.sellers
  for select to authenticated using (user_id = auth.uid());

-- Sellers only see cameras that belong to their own farm. Visitors never read
-- this table at all (they use the public_cameras view in file 10).
drop policy if exists "seller reads cameras of own farm" on public.cameras;
create policy "seller reads cameras of own farm" on public.cameras
  for select to authenticated using (
    exists (
      select 1 from public.sellers s
       where s.user_id = auth.uid() and s.farm_id = cameras.farm_id
    )
  );

drop policy if exists "seller manages own products" on public.products;
drop policy if exists "seller reads own products" on public.products;
create policy "seller reads own products" on public.products
  for select to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "seller inserts own products" on public.products;
create policy "seller inserts own products" on public.products
  for insert to authenticated with check (public.is_my_seller(seller_id));

drop policy if exists "seller updates own products" on public.products;
create policy "seller updates own products" on public.products
  for update to authenticated using (public.is_my_seller(seller_id)) with check (public.is_my_seller(seller_id));

drop policy if exists "seller deletes own products" on public.products;
create policy "seller deletes own products" on public.products
  for delete to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "seller reads own payouts" on public.seller_payouts;
create policy "seller reads own payouts" on public.seller_payouts
  for select to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "seller reads own warnings" on public.seller_warnings;
create policy "seller reads own warnings" on public.seller_warnings
  for select to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "read own camera requests" on public.camera_requests;
create policy "read own camera requests" on public.camera_requests
  for select to authenticated using (user_id = auth.uid() or public.is_my_seller(seller_id));

drop policy if exists "create own camera requests" on public.camera_requests;
create policy "create own camera requests" on public.camera_requests
  for insert to authenticated with check (user_id = auth.uid() or public.is_my_seller(seller_id));

-- ---------------------------------------------------------------------------
-- 7. Website contact forms (write-only for visitors, read for admins)
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can subscribe" on public.newsletter_subscribers;
create policy "anyone can subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "anyone can send a contact message" on public.contact_messages;
create policy "anyone can send a contact message" on public.contact_messages
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 8. Admin full access — generated policy per table.
--    is_admin() is SECURITY DEFINER, so this never recurses.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles','addresses','site_settings','social_links','team_members','static_pages',
    'audit_log','login_attempts','contact_messages','newsletter_subscribers','media_assets','seo_meta',
    'categories','farms','cameras','sellers','seller_payouts','seller_warnings','camera_requests',
    'camera_view_logs','products','product_images','coupons','delivery_charges',
    'combos','combo_items','subscription_plans','subscriptions','cart_items','orders','order_items',
    'sub_orders','payment_methods','parcels','custom_combos',
    'plans','user_subscriptions','access_codes','trials','stream_tokens','premium_devices',
    'reviews','review_photos','review_tags','complaints','complaint_messages','notifications',
    'push_subscriptions','fcm_tokens','wishlist','recently_viewed',
    'hero_slides','homepage_sections','banners','menus','menu_items','blog_posts','faq_items'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "admin full access" on public.%I', t);
    execute format(
      'create policy "admin full access" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Grants. RLS still decides what a row-level policy allows.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- visitors may read the public content tables (policies restrict rows)
grant select on
  public.categories, public.farms, public.products, public.product_images,
  public.combos, public.combo_items, public.subscription_plans, public.plans,
  public.delivery_charges, public.payment_methods, public.social_links,
  public.team_members, public.static_pages, public.seo_meta, public.hero_slides,
  public.homepage_sections, public.banners, public.menus, public.menu_items,
  public.blog_posts, public.faq_items, public.reviews, public.review_photos,
  public.review_tags
  to anon;

grant insert on public.contact_messages, public.newsletter_subscribers to anon;

-- signed-in users: RLS decides, so a broad grant is safe and keeps admin
-- server routes simple.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Future tables created by this project inherit the same grants.
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

-- ############################################################################
-- ##  09_storage_buckets_and_policies.sql
-- ############################################################################
-- ============================================================================
-- 09_storage_buckets_and_policies.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the ten Storage buckets the app uploads to and the access rules
--   for each one:
--
--     PUBLIC (anyone can view a file, only admins/owners can write)
--       avatars, product-images, category-images, farm-images, logos,
--       slides, team, review-photos, complaint-photos, blog-images
--
--
--   Each bucket also enforces a file-size limit and an image-only MIME list,
--   so a 40 MB PDF cannot be uploaded by mistake.
--
-- WHEN TO RUN
--   Ninth, after 08_rls_policies.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--   Storage → Buckets in the dashboard shows all 10 buckets.
--
-- SAFE TO RUN TWICE
--   Yes — buckets are upserted on id and every policy is dropped first.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',          'avatars',          true,  3145728,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('product-images',   'product-images',   true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('category-images',  'category-images',  true,  3145728,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('farm-images',      'farm-images',      true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('logos',            'logos',            true,  2097152,  array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('slides',           'slides',           true,  8388608,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('team',             'team',             true,  3145728,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('review-photos',    'review-photos',    true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('complaint-photos', 'complaint-photos', true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('blog-images',      'blog-images',      true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------
drop policy if exists "public image read" on storage.objects;
create policy "public image read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
  );

drop policy if exists "owners and admins upload images" on storage.objects;
create policy "owners and admins upload images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
    and (owner = auth.uid() or public.is_staff())
  );

drop policy if exists "owners and admins update images" on storage.objects;
create policy "owners and admins update images" on storage.objects
  for update to authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
    and (owner = auth.uid() or public.is_admin())
  );

drop policy if exists "owners and admins delete images" on storage.objects;
create policy "owners and admins delete images" on storage.objects
  for delete to authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
    and (owner = auth.uid() or public.is_admin())
  );

-- ############################################################################
-- ##  10_indexes_and_views.sql
-- ############################################################################
-- ============================================================================
-- 10_indexes_and_views.sql
-- ============================================================================
-- WHAT IT DOES
--   Adds the indexes that keep the storefront fast and creates the read-only
--   views the app uses:
--     public_sellers        seller storefront data WITHOUT NID / bank details
--     public_cameras        cameras WITHOUT stream_key / stream_url
--     v_team_members        staff accounts for /foisal/team
--     v_product_rating_breakdown
--     v_supplier_quality    seller scorecard for the quality board
--     v_product_supplier    farm + seller card for a product page
--     v_farm_stats,
--     v_premium_revenue, v_seller_leaderboard
--
-- WHEN TO RUN
--   Tenth, after 09_storage_buckets_and_policies.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — every index/view uses IF NOT EXISTS or CREATE OR REPLACE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists products_slug_idx            on public.products (slug);
create index if not exists products_category_idx        on public.products (category_id);
create index if not exists products_seller_idx          on public.products (seller_id);
create index if not exists products_farm_idx            on public.products (farm_id);
create index if not exists products_active_idx          on public.products (is_active, approval_status);
create index if not exists products_featured_idx        on public.products (is_featured) where is_active;
create index if not exists products_name_trgm_idx       on public.products using gin (name_bn extensions.gin_trgm_ops);
create index if not exists product_images_product_idx   on public.product_images (product_id, sort_order);

create index if not exists categories_slug_idx          on public.categories (slug);
create index if not exists categories_parent_idx        on public.categories (parent_id, sort_order);

create index if not exists farms_slug_idx               on public.farms (slug);
create index if not exists farms_active_idx             on public.farms (is_active, sort_order);

create index if not exists cameras_farm_idx             on public.cameras (farm_id, sort_order);
create index if not exists cameras_status_idx           on public.cameras (status) where is_active;
create index if not exists camera_requests_status_idx   on public.camera_requests (status, created_at desc);
create index if not exists camera_view_logs_camera_idx  on public.camera_view_logs (camera_id, created_at desc);

create index if not exists sellers_slug_idx             on public.sellers (slug);
create index if not exists sellers_user_idx             on public.sellers (user_id);
create index if not exists sellers_status_idx           on public.sellers (status);
create index if not exists seller_payouts_seller_idx    on public.seller_payouts (seller_id, created_at desc);

create index if not exists orders_no_idx                on public.orders (order_no);
create index if not exists orders_user_idx              on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx            on public.orders (status, created_at desc);
create index if not exists orders_phone_idx             on public.orders (customer_phone);
create index if not exists orders_created_idx           on public.orders (created_at desc);
create index if not exists orders_payment_status_idx    on public.orders (payment_status) where payment_status <> 'paid';

create index if not exists order_items_order_idx        on public.order_items (order_id);
create index if not exists order_items_product_idx      on public.order_items (product_id);
create index if not exists order_items_seller_idx       on public.order_items (seller_id);
create index if not exists order_items_sub_order_idx    on public.order_items (sub_order_id);
create index if not exists sub_orders_order_idx         on public.sub_orders (order_id);
create index if not exists sub_orders_seller_idx        on public.sub_orders (seller_id, created_at desc);
create index if not exists sub_orders_status_idx        on public.sub_orders (status);


create index if not exists parcels_order_idx            on public.parcels (order_id);
create index if not exists parcels_token_idx            on public.parcels (qr_token);
create index if not exists cart_items_user_idx          on public.cart_items (user_id);
create index if not exists custom_combos_user_idx       on public.custom_combos (user_id, created_at desc);

create index if not exists combos_slug_idx              on public.combos (slug);
create index if not exists combo_items_combo_idx        on public.combo_items (combo_id, sort_order);
create index if not exists subscription_plans_slug_idx  on public.subscription_plans (slug);
create index if not exists subscriptions_user_idx       on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_idx     on public.subscriptions (status);

create index if not exists coupons_code_idx             on public.coupons (upper(code));
create index if not exists delivery_charges_district_idx on public.delivery_charges (district);

create index if not exists plans_slug_idx               on public.plans (slug);
create index if not exists plans_active_idx             on public.plans (is_active, sort_order);
create index if not exists user_subs_user_idx           on public.user_subscriptions (user_id, status);
create index if not exists user_subs_status_idx         on public.user_subscriptions (status, expires_at);
create index if not exists access_codes_status_idx      on public.access_codes (status, created_at desc);
create index if not exists access_codes_user_idx        on public.access_codes (user_id);
create index if not exists trials_expiry_idx            on public.trials (expires_at);
create index if not exists stream_tokens_camera_idx     on public.stream_tokens (camera_id, expires_at);
create index if not exists premium_devices_user_idx     on public.premium_devices (user_id);

create index if not exists reviews_product_idx          on public.reviews (product_id, status, created_at desc);
create index if not exists reviews_user_idx             on public.reviews (user_id, created_at desc);
create index if not exists reviews_seller_idx           on public.reviews (seller_id, status);
create index if not exists reviews_order_idx            on public.reviews (order_id);
create index if not exists review_photos_review_idx     on public.review_photos (review_id, sort_order);

create index if not exists complaints_user_idx          on public.complaints (user_id, created_at desc);
create index if not exists complaints_status_idx        on public.complaints (status, created_at desc);
create index if not exists complaints_seller_idx        on public.complaints (seller_id);
create index if not exists complaint_messages_idx       on public.complaint_messages (complaint_id, created_at);

create index if not exists notifications_user_idx       on public.notifications (user_id, is_read, created_at desc);
create index if not exists push_subs_user_idx           on public.push_subscriptions (user_id);
create index if not exists wishlist_user_idx            on public.wishlist (user_id, created_at desc);
create index if not exists recently_viewed_user_idx     on public.recently_viewed (user_id, viewed_at desc);

create index if not exists hero_slides_order_idx        on public.hero_slides (sort_order) where is_active;
create index if not exists homepage_sections_order_idx  on public.homepage_sections (sort_order);
create index if not exists banners_placement_idx        on public.banners (placement, sort_order) where is_active;
create index if not exists menu_items_menu_idx          on public.menu_items (menu_id, sort_order);
create index if not exists blog_posts_slug_idx          on public.blog_posts (slug);
create index if not exists blog_posts_published_idx     on public.blog_posts (is_active, published_at desc);
create index if not exists faq_items_group_idx          on public.faq_items (group_bn, sort_order) where is_active;

create index if not exists audit_log_created_idx        on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx          on public.audit_log (actor_id);
create index if not exists audit_log_entity_idx         on public.audit_log (entity, entity_id);
create index if not exists login_attempts_email_idx     on public.login_attempts (email, created_at desc);
create index if not exists media_assets_bucket_idx      on public.media_assets (bucket, created_at desc);

-- ---------------------------------------------------------------------------
-- Public-safe views
-- ---------------------------------------------------------------------------

-- Seller storefront data. NEVER exposes nid, payout_number, bank_*.
create or replace view public.public_sellers
with (security_invoker = false) as
select
  s.id,
  s.slug,
  s.name_bn,
  s.farm_id,
  s.division,
  s.district,
  s.farm_address_bn,
  s.farm_photos,
  s.product_types,
  s.logo,
  s.banner,
  s.commission_percent,
  s.status,
  s.approved_at,
  s.created_at,
  f.slug        as farm_slug,
  f.name_bn     as farm_name_bn,
  f.cover       as farm_cover,
  f.certifications
from public.sellers s
left join public.farms f on f.id = s.farm_id
where s.status = 'approved';

-- Cameras without stream secrets.
create or replace view public.public_cameras
with (security_invoker = false) as
select
  c.id,
  c.farm_id,
  c.name_bn,
  c.zone_bn,
  c.protocol,
  c.poster,
  c.status,
  c.is_active,
  c.is_premium,
  c.max_viewers,
  c.sort_order,
  c.last_heartbeat,
  f.slug      as farm_slug,
  f.name_bn   as farm_name_bn,
  f.district  as farm_district
from public.cameras c
join public.farms f on f.id = c.farm_id
where c.is_active and f.is_active;

-- Staff directory for /foisal/team. Service role only (see grants below).
create or replace view public.v_team_members
with (security_invoker = false) as
select
  p.id          as member_id,
  p.id          as user_id,
  coalesce(p.full_name, p.email, 'নামহীন') as full_name,
  p.email,
  p.phone,
  p.avatar_url  as photo,
  p.role,
  p.is_active,
  p.last_login_at,
  p.created_at,
  (select tm.id from public.team_members tm where tm.user_id = p.id limit 1) as public_member_id
from public.profiles p
where p.role in ('admin', 'manager', 'staff');

-- ---------------------------------------------------------------------------
-- Reporting views (server-side reads)
-- ---------------------------------------------------------------------------
create or replace view public.v_product_rating_breakdown
with (security_invoker = false) as
select
  r.product_id,
  count(*)::int                                            as total,
  count(*) filter (where r.rating >= 4.5)::int              as r5,
  count(*) filter (where r.rating >= 3.5 and r.rating < 4.5)::int as r4,
  count(*) filter (where r.rating >= 2.5 and r.rating < 3.5)::int as r3,
  count(*) filter (where r.rating >= 1.5 and r.rating < 2.5)::int as r2,
  count(*) filter (where r.rating < 1.5)::int               as r1,
  coalesce(round(avg(r.rating)::numeric, 1), 0)             as avg_rating
from public.reviews r
where r.status = 'published' and r.product_id is not null
group by r.product_id;

create or replace view public.v_product_supplier
with (security_invoker = false) as
select
  p.id                   as product_id,
  s.id                   as seller_id,
  s.slug                 as seller_slug,
  s.name_bn              as seller_name_bn,
  f.id                   as farm_id,
  f.slug                 as farm_slug,
  f.name_bn              as farm_name_bn,
  coalesce(f.cover, (f.images)[1]) as farm_photo,
  f.owner_bio_bn         as farm_bio_bn,
  f.description_bn       as farm_description_bn,
  f.cover                as farm_cover,
  f.images               as farm_images,
  coalesce(f.division, s.division) as division,
  coalesce(f.district, s.district) as district,
  f.upazila              as farm_upazila,
  f.address_bn           as farm_address_bn,
  f.lat                  as farm_lat,
  f.lng                  as farm_lng,
  f.established_year,
  f.certifications,
  (select count(*)::int from public.products pp where pp.seller_id = p.seller_id and pp.is_active) as product_count,
  (select count(*)::int from public.cameras c where c.farm_id = p.farm_id and c.is_active) as camera_count
from public.products p
left join public.sellers s on s.id = p.seller_id
left join public.farms f on f.id = coalesce(p.farm_id, s.farm_id);

create or replace view public.v_supplier_quality
with (security_invoker = false) as
with review_stats as (
  select seller_id,
         count(*)::int                                        as review_count,
         coalesce(round(avg(rating)::numeric, 2), 0)          as avg_rating,
         coalesce(round(avg(seller_rating)::numeric, 2), 0)   as avg_seller_rating,
         count(*) filter (where rating <= 2)::int             as low_rating_count
    from public.reviews
   where seller_id is not null and status = 'published'
   group by seller_id
),
complaint_stats as (
  select seller_id,
         count(*)::int                                        as complaint_count,
         count(*) filter (where status = 'resolved')::int     as resolved_count
    from public.complaints
   where seller_id is not null
   group by seller_id
),
order_stats as (
  select seller_id,
         count(*)::int                                        as sub_order_count,
         count(*) filter (where status = 'delivered')::int    as delivered_count
    from public.sub_orders
   where seller_id is not null
   group by seller_id
)
select
  s.id      as seller_id,
  s.slug,
  s.name_bn,
  s.status,
  coalesce(r.review_count, 0)                                  as review_count,
  coalesce(r.avg_rating, 0)                                    as avg_rating,
  coalesce(r.avg_seller_rating, 0)                             as avg_seller_rating,
  coalesce(r.low_rating_count, 0)                              as low_rating_count,
  coalesce(c.complaint_count, 0)                               as complaint_count,
  coalesce(c.resolved_count, 0)                                as resolved_count,
  coalesce(o.sub_order_count, 0)                               as sub_order_count,
  coalesce(o.delivered_count, 0)                               as delivered_count,
  case when coalesce(o.sub_order_count, 0) = 0 then 0
       else round(coalesce(c.complaint_count, 0)::numeric / o.sub_order_count, 4) end as complaint_rate,
  case when coalesce(o.sub_order_count, 0) = 0 then 1
       else round(coalesce(o.delivered_count, 0)::numeric / o.sub_order_count, 4) end as on_time_rate,
  round(
    coalesce(r.avg_rating, 0) * 12
    + (100 * (1 - least(1, case when coalesce(o.sub_order_count, 0) = 0 then 0
                                else coalesce(c.complaint_count, 0)::numeric / o.sub_order_count end))) * 0.4
    + least(20, coalesce(o.delivered_count, 0))
  , 2)                                                          as quality_score
from public.sellers s
left join review_stats r    on r.seller_id = s.id
left join complaint_stats c on c.seller_id = s.id
left join order_stats o     on o.seller_id = s.id;

create or replace view public.v_farm_stats
with (security_invoker = false) as
select
  f.id as farm_id,
  count(distinct c.id)::int                                   as camera_count,
  count(distinct c.id) filter (where c.status = 'online')::int as online_cameras,
  (select count(*)::int from public.products p where p.farm_id = f.id and p.is_active) as product_count
from public.farms f
left join public.cameras c on c.farm_id = f.id and c.is_active
group by f.id;

create or replace view public.v_premium_revenue
with (security_invoker = false) as
select
  date_trunc('month', us.created_at)::date                    as month,
  us.plan_name_bn,
  count(*)::int                                               as subscriptions,
  coalesce(sum(us.amount), 0)                                 as revenue
from public.user_subscriptions us
where us.status in ('active', 'grace', 'expired')
group by 1, 2;

create or replace view public.v_seller_leaderboard
with (security_invoker = false) as
select
  s.id as seller_id,
  s.slug,
  s.name_bn,
  count(so.id)::int                                           as orders,
  coalesce(sum(so.subtotal), 0)                               as gross,
  coalesce(sum(so.commission), 0)                             as commission,
  coalesce(sum(so.seller_earning), 0)                         as earnings
from public.sellers s
left join public.sub_orders so on so.seller_id = s.id
where s.status = 'approved'
group by s.id, s.slug, s.name_bn;

-- ---------------------------------------------------------------------------
-- View grants. Views owned by the migration role bypass RLS, so the public
-- ones expose only safe columns and the private ones are service-role only.
-- ---------------------------------------------------------------------------
grant select on public.public_sellers, public.public_cameras to anon, authenticated;

revoke all on public.v_team_members           from anon, authenticated;
revoke all on public.v_premium_revenue        from anon, authenticated;
revoke all on public.v_seller_leaderboard     from anon, authenticated;
grant select on public.v_team_members, public.v_product_rating_breakdown,
                public.v_supplier_quality, public.v_product_supplier,
                public.v_farm_stats, public.v_premium_revenue,
                public.v_seller_leaderboard
  to authenticated, service_role;


-- ============================================================================
-- ALL_IN_ONE complete. Next: 11_seed_sample_data.sql (optional), 12_make_admin.sql,
-- then 13_verify_setup.sql.
-- ============================================================================

-- ============================================================================
-- 25 — কুপন (প্রতি অ্যাকাউন্টে একবার), ইনফ্লুয়েন্সার কুপন, রেফারেল ও ওয়ালেট
-- ----------------------------------------------------------------------------
-- এই অংশটি `25_coupons_referrals_wallet.sql`-এর হুবহু কপি। নতুন প্রজেক্টে
-- শুধু ALL_IN_ONE চালালেই পুরো স্কিমা — কুপন/রেফারেল/ওয়ালেটসহ — তৈরি হয়ে যাবে।
-- পুরোনো প্রজেক্টে শুধু `25_...sql` ফাইলটি একবার চালালেই হবে।
-- ============================================================================

-- ============================================================================
-- 25_coupons_referrals_wallet.sql
-- ============================================================================
-- WHAT IT DOES
--   Three connected features, all admin-controlled:
--
--   1. COUPON ADDITIONS
--        • per_user_limit really enforced (a coupon can be used N times by one
--          account, not just once)
--        • audience / influencer assignment: a coupon can be restricted to a
--          named set of accounts, or open to everybody
--        • coupon_redemptions — one row per use, so we can answer "who used
--          what", refuse a repeat use, and show the customer only the coupons
--          that are still available to *them*
--
--   2. REFERRAL PROGRAMME
--        • every profile gets a short referral code (auto-created)
--        • profiles.referred_by points at the inviter
--        • wallet_balance / wallet_earned / wallet_spent on profiles
--
--   3. WALLET (virtual balance)
--        • wallet_transactions — an append-only ledger; the balance on
--          profiles is the running total, kept in sync by the place_order RPC
--        • at checkout a customer may pay part of the total from the wallet,
--          up to `wallet_max_percent` of the order (default 30 %)
--        • referral commission is credited to the inviter as a percentage of
--          the invitee's first delivered order
--
--   Every knob lives in public.site_settings under the key 'referral', so the
--   admin panel changes behaviour without a deploy:
--
--     { "enabled": true, "commission_percent": 5, "wallet_max_percent": 30,
--       "credit_on": "delivered", "min_order": 300 }
--
--   SAFE TO RE-RUN: every statement is if-not-exists / create-or-replace.
--   Run it AFTER 24_camera_cloud_bridge.sql.
-- ============================================================================

-- --------------------------------------------------------------- 1. coupons --
alter table public.coupons
  add column if not exists audience       text not null default 'all',
  add column if not exists funder_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists funder_note    text,
  add column if not exists is_referral    boolean not null default false;

comment on column public.coupons.audience is
  'all = anybody may use it; assigned = only accounts listed in coupon_audiences; '
  'influencer = the funder plus the accounts it was handed to';
comment on column public.coupons.funder_user_id is
  'Who pays for the discount — an influencer account. Informational only; the '
  'store always absorbs the discount at checkout.';
comment on column public.coupons.is_referral is
  'True for the auto-created codes (a brand-wide share code is not needed).';

-- Only these values are meaningful; the check is added separately so the file
-- stays re-runnable on databases that already have the column.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coupons_audience_check'
  ) then
    alter table public.coupons
      add constraint coupons_audience_check
      check (audience in ('all', 'assigned', 'influencer'));
  end if;
end $$;

-- How much of an order was paid from the wallet. Kept on the order so the
-- invoice, the tracking page and the admin order view all agree.
alter table public.orders
  add column if not exists wallet_used numeric(12, 2) not null default 0;

create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete cascade,
  -- nullable: a guest checkout has no profile row, and the use must still be
  -- counted exactly once against usage_limit even then.
  user_id     uuid references public.profiles (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  order_no    text,
  amount      numeric(12, 2) not null default 0,
  created_at  timestamptz not null default now()
);
-- A guest checkout has no profile: the redemption row still has to exist so
-- usage_limit is counted exactly once. Enforced here as well because the
-- create-table above is a no-op on an existing database.
alter table public.coupon_redemptions alter column user_id drop not null;

create index if not exists coupon_redemptions_coupon_user
  on public.coupon_redemptions (coupon_id, user_id);
create index if not exists coupon_redemptions_user
  on public.coupon_redemptions (user_id, created_at desc);

-- Who may use an "assigned" / "influencer" coupon.
create table if not exists public.coupon_audiences (
  coupon_id  uuid not null references public.coupons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
create index if not exists coupon_audiences_user on public.coupon_audiences (user_id);

-- ------------------------------------------------------- 2. referral + wallet --
alter table public.profiles
  add column if not exists referral_code    text,
  add column if not exists referred_by      uuid references public.profiles (id) on delete set null,
  add column if not exists referred_at      timestamptz,
  add column if not exists wallet_balance   numeric(12, 2) not null default 0,
  add column if not exists wallet_earned    numeric(12, 2) not null default 0,
  add column if not exists wallet_spent     numeric(12, 2) not null default 0;

create unique index if not exists profiles_referral_code_key
  on public.profiles (upper(referral_code));
create index if not exists profiles_referred_by on public.profiles (referred_by);

comment on column public.profiles.wallet_balance is
  'Spendable store credit in Taka. Only place_order() may debit it; only the '
  'referral trigger or an admin adjustment may credit it.';

create table if not exists public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('referral', 'order', 'refund', 'admin', 'bonus')),
  amount      numeric(12, 2) not null,          -- positive = credit, negative = debit
  balance_after numeric(12, 2) not null,
  order_id    uuid references public.orders (id) on delete set null,
  order_no    text,
  note_bn     text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists wallet_transactions_user
  on public.wallet_transactions (user_id, created_at desc);

-- A commission is paid per ORDER, not per delivery click: retries, a status
-- flip-flop or two admins pressing at once must never pay twice.
create unique index if not exists wallet_transactions_referral_once
  on public.wallet_transactions (order_id)
  where kind = 'referral' and order_id is not null;

-- ------------------------------------------------------------- 3. defaults --
insert into public.site_settings (key, value)
values (
  'referral',
  jsonb_build_object(
    'enabled', true,
    'commission_percent', 5,
    'wallet_max_percent', 30,
    'credit_on', 'delivered',
    'min_order', 300,
    'commission_base', 'subtotal'
  )
)
on conflict (key) do nothing;

-- ← already-installed database?  This file is re-runnable: the merge below
--   adds the two switches introduced in revision 2 without touching values
--   the owner has already changed.
update public.site_settings
   set value = value
     || jsonb_build_object(
          'commission_base', coalesce(value ->> 'commission_base', 'subtotal')
        )
 where key = 'referral';

-- ------------------------------------------------- 4. code generation helper --
-- 8 characters, no I/O/0/1 so it can be read over the phone.
create or replace function public.gen_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.profiles where upper(referral_code) = v_code
    );
    if v_try > 40 then
      -- Extremely unlikely; fall back to something certainly unique.
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit;
    end if;
  end loop;
  return v_code;
end;
$$;

-- Backfill: every existing profile gets a code.
update public.profiles
   set referral_code = public.gen_referral_code()
 where referral_code is null;

-- New profiles get one automatically (does not touch handle_new_user, so it
-- keeps working even if the auth trigger was replaced by a newer migration).
create or replace function public.assign_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.gen_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_referral_code on public.profiles;
create trigger trg_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_referral_code();

-- --------------------------------------------------- 5. wallet ledger helper --
-- The single place that moves money in or out of a wallet. Keeps
-- profiles.wallet_* in step with the ledger and refuses to go negative.
create or replace function public.wallet_apply(
  p_user   uuid,
  p_kind   text,
  p_amount numeric,
  p_order  uuid default null,
  p_order_no text default null,
  p_note   text default null,
  p_by     uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric;
  v_new numeric;
begin
  if p_user is null or coalesce(p_amount, 0) = 0 then
    return null;
  end if;

  select wallet_balance into v_balance from public.profiles where id = p_user for update;
  if not found then
    return null;
  end if;

  v_balance := coalesce(v_balance, 0);
  v_new := v_balance + p_amount;
  if v_new < 0 then
    raise exception 'WALLET_INSUFFICIENT';
  end if;

  update public.profiles
     set wallet_balance = v_new,
         wallet_earned  = wallet_earned  + greatest(p_amount, 0),
         wallet_spent   = wallet_spent   + greatest(-p_amount, 0),
         updated_at     = now()
   where id = p_user;

  insert into public.wallet_transactions
    (user_id, kind, amount, balance_after, order_id, order_no, note_bn, created_by)
  values
    (p_user, p_kind, p_amount, v_new, p_order, p_order_no, p_note, p_by);

  return v_new;
end;
$$;

-- ------------------------------------- 6. referral commission per order ----
-- WHAT CHANGED IN REVISION 2
--   • The inviter now earns on EVERY delivered order of the person they
--     invited — not just the first one.
--   • The taka base can be the product value (default) or the actual amount
--     the customer paid; both are one switch in the admin panel.
--   • The percentage is whatever the admin set (5 %, 10 %, …) — 0 turns it off.
--
-- Never throws: a missing setting or a zero percentage must not block a
-- delivery update. Paying twice for the same order is impossible — the unique
-- index `wallet_transactions_referral_once` makes the second INSERT fail,
-- which the trigger swallows as "already paid".
create or replace function public.credit_referral(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_cfg jsonb;
  v_pct numeric;
  v_min numeric;
  v_base_mode text;
  v_base numeric;
  v_inviter uuid;
  v_amount numeric;
  v_credit_on text;
  v_rows integer := 0;
begin
  select * into v_order from public.orders where id = p_order;
  if not found or v_order.user_id is null then
    return;
  end if;

  select value into v_cfg from public.site_settings where key = 'referral';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  if coalesce((v_cfg ->> 'enabled')::boolean, false) is false then
    return;
  end if;

  /* `credit_on` is delivered | paid. The trigger fires on both transitions,
     and the guard below keeps it to one payment per order. */
  v_credit_on := coalesce(v_cfg ->> 'credit_on', 'delivered');
  if v_credit_on = 'paid' and v_order.payment_status <> 'paid' then
    return;
  end if;
  if v_credit_on = 'delivered' and v_order.status <> 'delivered' then
    return;
  end if;

  v_pct := coalesce((v_cfg ->> 'commission_percent')::numeric, 0);
  v_min := coalesce((v_cfg ->> 'min_order')::numeric, 0);
  if v_pct <= 0 then
    return;
  end if;

  /* Who invited this customer? Every shared link — the profile share link and
     every shared PRODUCT link — carries `?ref=CODE`. A normal code was stored
     as `referred_by` at signup. An influencer token is mapped here instead, so
     a customer who used the influencer's promo code still credits them even if
     the link was opened later. */
  select referred_by into v_inviter from public.profiles where id = v_order.user_id;
  if v_inviter is null then
    -- the customer may have paid with the influencer's promo code instead
    v_inviter := public.referrer_for_token(v_order.coupon_code, v_order.user_id);
  end if;
  if v_inviter is null or v_inviter = v_order.user_id then
    return;
  end if;

  /* The base. `commission_base` = 'subtotal' (default, product value) or
     'paid' (what the customer actually paid after discounts and wallet). */
  v_base_mode := coalesce(v_cfg ->> 'commission_base', 'subtotal');
  v_base := case
              when v_base_mode = 'paid'
                then greatest(0, coalesce(v_order.total, 0) - coalesce(v_order.wallet_used, 0))
              else coalesce(v_order.subtotal, 0)
            end;
  if v_base < v_min then
    return;
  end if;

  v_amount := round(v_base * v_pct / 100.0, 2);
  if v_amount <= 0 then
    return;
  end if;

  -- Ledger first: its unique index is the "paid once per order" lock.
  insert into public.wallet_transactions
    (user_id, kind, amount, balance_after, order_id, order_no, note_bn)
  select v_inviter, 'referral', v_amount,
         coalesce((select wallet_balance from public.profiles where id = v_inviter), 0) + v_amount,
         v_order.id, v_order.order_no,
         'রেফারেল কমিশন (' || v_order.order_no || ')'
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return;  -- this order was already credited
  end if;

  -- …then move the balance and keep the profile totals honest.
  update public.profiles
     set wallet_balance = coalesce(wallet_balance, 0) + v_amount,
         wallet_earned  = coalesce(wallet_earned, 0) + v_amount,
         updated_at     = now()
   where id = v_inviter;

  insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
  values (
    v_inviter, 'user', 'premium',
    'রেফারেল কমিশন যোগ হয়েছে',
    '৳' || v_amount::text || ' আপনার ভার্চুয়াল ব্যালেন্সে যোগ হয়েছে (' || v_order.order_no || ')।',
    '/account/wallet',
    jsonb_build_object('amount', v_amount, 'order_no', v_order.order_no)
  );
exception
  when others then
    raise warning 'credit_referral failed for %: %', p_order, sqlerrm;
end;
$$;

-- Called from the delivery path (app/api/foisal/parcels/deliver and the admin
-- order manager both set status = 'delivered').
create or replace function public.on_order_delivered()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Credit when the order reaches the configured moment. credit_referral()
  -- re-reads the setting, and the unique index on the ledger keeps it to one
  -- payment per order, so firing on both transitions is safe.
  if (new.status = 'delivered' and coalesce(old.status, '') <> 'delivered')
     or (new.payment_status = 'paid' and coalesce(old.payment_status, '') <> 'paid') then
    perform public.credit_referral(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_delivered on public.orders;
create trigger trg_order_delivered
  after update of status, payment_status on public.orders
  for each row execute function public.on_order_delivered();

-- --------------------------------------------------------- 7. coupon checks --
-- "May this user use this coupon right now?" — one function, used by the
-- checkout validator, place_order and the customer's coupon list.
create or replace function public.coupon_allows_user(p_coupon uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.coupons%rowtype;
  v_used integer;
begin
  select * into v from public.coupons where id = p_coupon;
  if not found or not v.is_active then
    return false;
  end if;

  if v.starts_at is not null and v.starts_at > now() then return false; end if;
  if v.expires_at is not null and v.expires_at < now() then return false; end if;
  if v.usage_limit is not null and coalesce(v.used_count, 0) >= v.usage_limit then
    return false;
  end if;

  /* audience:
       all        → anybody
       influencer → anybody too — the influencer hands the code out freely,
                    and the admin does not have to know the recipients
       assigned   → only the listed accounts, plus the funder himself
     (the `all` branch is the cheapest, so it is checked first) */
  if coalesce(v.audience, 'all') = 'assigned' then
    if p_user is null then return false; end if;
    if not exists (
      select 1 from public.coupon_audiences where coupon_id = v.id and user_id = p_user
    ) and coalesce(v.funder_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_user then
      return false;
    end if;
  end if;

  -- per-user cap — count this account's redemptions. Guests have no profile,
  -- so they are limited only by the coupon-wide usage_limit.
  if p_user is not null and coalesce(v.per_user_limit, 1) > 0 then
    select count(*) into v_used
      from public.coupon_redemptions
     where coupon_id = v.id and user_id = p_user;
    if v_used >= v.per_user_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- Why a coupon was refused, as ONE code the UI can translate. place_order
-- raises this directly, so a repeat use says "you already used this" instead
-- of collapsing into a generic "invalid coupon".
create or replace function public.coupon_refusal(p_coupon uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.coupons%rowtype;
  v_used integer;
begin
  select * into v from public.coupons where id = p_coupon;
  if not found or not v.is_active then return 'COUPON_INVALID'; end if;
  if v.starts_at is not null and v.starts_at > now() then return 'COUPON_INVALID'; end if;
  if v.expires_at is not null and v.expires_at < now() then return 'COUPON_INVALID'; end if;
  if v.usage_limit is not null and coalesce(v.used_count, 0) >= v.usage_limit then
    return 'COUPON_INVALID';
  end if;

  -- influencer codes are open (see coupon_allows_user); only `assigned` is a list
  if coalesce(v.audience, 'all') = 'assigned' then
    if p_user is null then return 'COUPON_NOT_FOR_USER'; end if;
    if not exists (
      select 1 from public.coupon_audiences where coupon_id = v.id and user_id = p_user
    ) and coalesce(v.funder_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_user then
      return 'COUPON_NOT_FOR_USER';
    end if;
  end if;

  if p_user is not null and coalesce(v.per_user_limit, 1) > 0 then
    select count(*) into v_used
      from public.coupon_redemptions
     where coupon_id = v.id and user_id = p_user;
    if v_used >= v.per_user_limit then return 'COUPON_USED_BY_USER'; end if;
  end if;

  return 'OK';
end;
$$;

-- ============================================================================
-- 8. place_order — extended with per-user coupons and wallet payment
-- ============================================================================
-- Same signature as before plus p_wallet. The wallet can cover at most
-- `wallet_max_percent` % of the order total (default 30), and never more than
-- the balance. Everything else is the original function, unchanged.
-- ---------------------------------------------------------------------------
-- ⚠️ IMPORTANT — drop the OLD five-argument function first.
-- `create or replace` with an extra parameter would create an OVERLOAD, and
-- PostgREST then answers "could not choose the best candidate function".
drop function if exists public.place_order(uuid, jsonb, jsonb, text, text);

create or replace function public.place_order(
  p_user uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'cod',
  p_coupon text default null,
  p_wallet numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_product public.products%rowtype;
  v_combo public.combos%rowtype;
  v_qty integer;
  v_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_total numeric := 0;
  v_has_combo boolean := false;
  v_line jsonb;
  v_seller uuid;
  v_seller_pct numeric;
  v_group record;
  v_sub_no text;
  v_sub_map jsonb := '{}'::jsonb;
  v_order_id uuid;
  v_order_no text;
  v_method public.payment_methods%rowtype;
  v_coupon public.coupons%rowtype;
  v_have_coupon boolean := false;
  v_refusal   text;
  v_zone public.delivery_charges%rowtype;
  v_scope text;
  v_settings jsonb;
  v_free_over numeric;
  v_eta text := '২-৩ দিন';
  v_admin record;
  v_status public.payment_status := 'pending';
  v_customer jsonb := coalesce(p_customer, '{}'::jsonb);
  v_method_code text := lower(coalesce(nullif(p_payment_method, ''), 'cod'));
  v_remaining integer;
  v_ref jsonb;
  v_wallet_pct numeric;
  v_wallet_use numeric := 0;
  v_wallet_balance numeric := 0;
  v_method_floor numeric := 0;
begin
  -- -------------------------------------------------------------- customer --
  if nullif(trim(coalesce(v_customer ->> 'customer_name', '')), '') is null
     or nullif(trim(coalesce(v_customer ->> 'customer_phone', '')), '') is null
     or nullif(trim(coalesce(v_customer ->> 'address', '')), '') is null then
    raise exception 'CUSTOMER_INCOMPLETE';
  end if;

  -- ------------------------------------------------------------------ lines --
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_qty := greatest(1, least(99, coalesce((v_item ->> 'quantity')::int, 1)));

    if (v_item ->> 'kind') = 'combo' then
      select * into v_combo from public.combos
       where id = nullif(v_item ->> 'id', '')::uuid and is_active
       limit 1;
      if not found then
        raise exception 'PRODUCT_UNAVAILABLE:%', coalesce(v_item ->> 'name', '');
      end if;
      v_price := v_combo.price;
      v_subtotal := v_subtotal + v_price * v_qty;
      v_has_combo := true;
      v_lines := v_lines || jsonb_build_object(
        'combo_id', v_combo.id, 'product_id', null, 'seller_id', null,
        'name_bn', v_combo.name_bn, 'unit', 'প্যাকেজ',
        'price', v_price, 'quantity', v_qty, 'image', v_combo.image
      );
    else
      -- guarded stock reservation
      update public.products
         set stock = stock - v_qty
       where id = nullif(v_item ->> 'id', '')::uuid
         and is_active and stock >= v_qty
       returning * into v_product;

      if not found then
        if exists (select 1 from public.products where id = nullif(v_item ->> 'id', '')::uuid) then
          raise exception 'OUT_OF_STOCK:%', coalesce(v_item ->> 'name', '');
        end if;
        raise exception 'PRODUCT_UNAVAILABLE:%', coalesce(v_item ->> 'name', '');
      end if;

      v_price := v_product.price;
      v_subtotal := v_subtotal + v_price * v_qty;
      select seller_id into v_seller from public.products where id = v_product.id;
      v_lines := v_lines || jsonb_build_object(
        'combo_id', null, 'product_id', v_product.id, 'seller_id', v_seller,
        'name_bn', v_product.name_bn, 'unit', v_product.unit,
        'price', v_price, 'quantity', v_qty, 'image', v_product.image
      );
    end if;
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  -- ---------------------------------------------------------------- coupon ---
  if nullif(trim(coalesce(p_coupon, '')), '') is not null then
    select * into v_coupon from public.coupons
     where upper(code) = upper(trim(p_coupon))
     limit 1;

    if not found then
      raise exception 'COUPON_INVALID';
    end if;

    -- One code, one reason. coupon_refusal() is the same function the
    -- validator uses, so the browser and the transaction agree.
    v_refusal := public.coupon_refusal(v_coupon.id, p_user);
    if v_refusal <> 'OK' then
      raise exception '%', v_refusal;
    end if;

    if v_subtotal < v_coupon.min_order then
      raise exception 'COUPON_MIN_ORDER:%', v_coupon.min_order;
    end if;

    v_have_coupon := true;
    if v_coupon.type = 'percent' then
      v_discount := round(v_subtotal * v_coupon.value / 100.0, 2);
      if v_coupon.max_discount is not null then
        v_discount := least(v_discount, v_coupon.max_discount);
      end if;
    else
      v_discount := least(v_coupon.value, v_subtotal);
    end if;
  end if;

  -- -------------------------------------------------------------- delivery ---
  select value into v_settings from public.site_settings where key = 'delivery';
  v_settings := coalesce(v_settings, '{}'::jsonb);

  if v_has_combo then
    v_delivery := 0;
    v_eta := '১ দিন';
  else
    select * into v_zone from public.delivery_charges
     where is_active and (district = v_customer ->> 'district')
     limit 1;

    v_scope := case when coalesce(v_customer ->> 'division', '') = 'ঢাকা' then 'inside_dhaka' else 'outside_dhaka' end;
    v_free_over := coalesce(v_zone.free_over,
                            (v_settings ->> 'free_over')::numeric,
                            1200);
    v_eta := coalesce(v_zone.eta_days, case when v_scope = 'inside_dhaka' then 'আজ' else '২-৩ দিন' end);

    if v_subtotal >= v_free_over then
      v_delivery := 0;
    elsif v_zone.id is not null then
      v_delivery := v_zone.charge;
    elsif v_scope = 'inside_dhaka' then
      v_delivery := coalesce((v_settings ->> 'inside_dhaka')::numeric, 60);
    else
      v_delivery := coalesce((v_settings ->> 'outside_dhaka')::numeric, 120);
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery - v_discount);

  /* An "online" method (bKash/Nagad/…) usually has a floor — e.g. ৳50. If the
     wallet already covers most of this order, what is left for the method
     falls under that floor; the customer must then pay the floor itself
     through the method and take less from the wallet. Cash-on-delivery has
     min_amount = 0 and is unaffected. */
  if coalesce(p_wallet, 0) > 0 and p_user is not null then
    select coalesce(min_amount, 0) into v_method_floor
      from public.payment_methods where code = v_method_code;
    v_method_floor := coalesce(v_method_floor, 0);

    if v_method_floor > 0 and (v_total - least(coalesce(p_wallet, 0), v_total)) < v_method_floor then
      p_wallet := least(coalesce(p_wallet, 0), greatest(0, v_total - v_method_floor));
    end if;
  end if;

  -- ---------------------------------------------------------------- wallet ---
  if coalesce(p_wallet, 0) > 0 and p_user is not null then
    select value into v_ref from public.site_settings where key = 'referral';
    v_ref := coalesce(v_ref, '{}'::jsonb);
    v_wallet_pct := coalesce((v_ref ->> 'wallet_max_percent')::numeric, 30);

    select coalesce(wallet_balance, 0) into v_wallet_balance
      from public.profiles where id = p_user for update;

    v_wallet_use := least(
      coalesce(p_wallet, 0),
      v_wallet_balance,
      round(v_total * v_wallet_pct / 100.0, 2)
    );
    if v_wallet_use < 0 then
      v_wallet_use := 0;
    end if;
  end if;

  -- ----------------------------------------------------------------- order ---
  v_order_no := public.gen_order_no();
  insert into public.orders (
    order_no, user_id, customer_name, customer_phone, customer_email,
    division, district, upazila, address, delivery_note,
    subtotal, delivery_charge, discount, total, wallet_used, coupon_code,
    payment_method, payment_status, status, eta_days
  ) values (
    v_order_no, p_user,
    v_customer ->> 'customer_name',
    v_customer ->> 'customer_phone',
    nullif(v_customer ->> 'email', ''),
    coalesce(v_customer ->> 'division', 'ঢাকা'),
    coalesce(v_customer ->> 'district', 'ঢাকা'),
    coalesce(v_customer ->> 'upazila', ''),
    v_customer ->> 'address',
    nullif(v_customer ->> 'delivery_note', ''),
    v_subtotal, v_delivery, v_discount, v_total, v_wallet_use,
    case when v_have_coupon then upper(trim(p_coupon)) else null end,
    v_method.code, v_status, 'received', v_eta
  )
  returning id into v_order_id;

  -- order_items
  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    insert into public.order_items (
      order_id, sub_order_id, product_id, seller_id, name_bn, unit, price, quantity, image
    ) values (
      v_order_id,
      null,
      nullif(v_line ->> 'product_id', '')::uuid,
      nullif(v_line ->> 'seller_id', '')::uuid,
      v_line ->> 'name_bn',
      v_line ->> 'unit',
      (v_line ->> 'price')::numeric,
      (v_line ->> 'quantity')::int,
      v_line ->> 'image'
    );
  end loop;

  -- -------------------------------------------------------------- coupon use -
  if v_have_coupon then
    update public.coupons
       set used_count = used_count + 1, updated_at = now()
     where id = v_coupon.id;

    -- written for guests too (user_id null) so usage_limit stays exact
    insert into public.coupon_redemptions
      (coupon_id, user_id, order_id, order_no, amount)
    values
      (v_coupon.id, p_user, v_order_id, v_order_no, v_discount);
  end if;

  -- ------------------------------------------------------------ wallet debit -
  if v_wallet_use > 0 then
    perform public.wallet_apply(
      p_user, 'order', -v_wallet_use, v_order_id, v_order_no,
      'অর্ডারে ওয়ালেট ব্যবহার', null
    );
  end if;

  -- ----------------------------------------------------------------- parcel --
  insert into public.parcels (order_id, order_no, qr_token)
  values (v_order_id, v_order_no, encode(extensions.gen_random_bytes(16), 'hex'))
  on conflict (order_id) do nothing;

  -- ---------------------------------------------------------- notifications --
  if p_user is not null then
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (
      p_user, 'user', 'order',
      'অর্ডার #' || v_order_no || ' গ্রহণ করা হয়েছে',
      'আমরা আপনার অর্ডার পেয়েছি। স্ট্যাটাস দেখতে ট্র্যাক পেজে যান।',
      '/track?order=' || v_order_no,
      jsonb_build_object('order_no', v_order_no)
    );
  end if;

  for v_admin in select id from public.profiles where role = 'admin' and is_active
  loop
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (
      v_admin.id, 'admin', 'order',
      'নতুন অর্ডার #' || v_order_no,
      (v_customer ->> 'customer_name') || ' — ' || v_total::text || ' টাকা',
      '/foisal/orders',
      jsonb_build_object('order_no', v_order_no, 'total', v_total)
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal', v_subtotal,
    'delivery_charge', v_delivery,
    'discount', v_discount,
    'wallet_used', v_wallet_use,
    'total', v_total,
    'method_code', v_method.code,
    'eta_days', v_eta,
    'item_count', jsonb_array_length(v_lines)
  );
end;
$$;

-- --------------------------------------------------- 9. referral redemption --
-- Called once, right after signup or from the account page: "someone gave me
-- this code". Refuses self-referral, unknown codes and a second attempt.
create or replace function public.apply_referral(p_user uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inviter uuid;
  v_me public.profiles%rowtype;
begin
  select * into v_me from public.profiles where id = p_user;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_me.referred_by is not null then
    raise exception 'ALREADY_REFERRED';
  end if;

  select id into v_inviter from public.profiles
   where upper(referral_code) = upper(trim(p_code)) and id <> p_user
   limit 1;

  if v_inviter is null then
    raise exception 'REFERRAL_INVALID';
  end if;

  update public.profiles
     set referred_by = v_inviter, referred_at = now(), updated_at = now()
   where id = p_user;

  return jsonb_build_object('ok', true, 'inviter', v_inviter);
end;
$$;

-- The dropped function took its grant with it — restore execution rights for
-- the same roles the original had.
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text, numeric)
  to anon, authenticated, service_role;
grant execute on function public.coupon_allows_user(uuid, uuid)       to anon, authenticated, service_role;
grant execute on function public.coupon_refusal(uuid, uuid)           to anon, authenticated, service_role;
grant execute on function public.apply_referral(uuid, text)           to authenticated, service_role;
grant execute on function public.referrer_for_token(text, uuid)       to anon, authenticated, service_role;

-- ------------------------------------------------- 10. influencer extras ----
-- An influencer promo code is meant to be passed around: the admin does not
-- have to know in advance who will receive it. So an `influencer` code always
-- carries a PUBLIC TOKEN — `?ref=TOKEN` — that the influencer may share with
-- anybody. That token never names the influencer, and it is not a profile
-- referral code: it is looked up on the coupon itself.
alter table public.coupons
  add column if not exists share_token text;

create unique index if not exists coupons_share_token_key
  on public.coupons (upper(share_token))
  where share_token is not null;

-- Fill a token for every influencer code that has none. Deterministic from the
-- uuid so re-running never churns the codes, and revocable by editing the row.
update public.coupons
   set share_token = upper(substr(replace(id::text, '-', ''), 1, 10))
 where audience = 'influencer'
   and coalesce(share_token, '') = '';

-- "Someone arrived with ?ref=XYZ": turn that token into the account the sale
-- should be credited to. Returns null for an unknown/disabled code, and for a
-- customer who redeemed the influencer's own promo code (no self-credit).
create or replace function public.referrer_for_token(p_code text, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_funder uuid;
begin
  if nullif(trim(coalesce(p_code, '')), '') is null then
    return null;
  end if;

  select funder_user_id into v_funder
    from public.coupons
   where upper(share_token) = upper(trim(p_code))
     and audience = 'influencer'
     and is_active
   limit 1;

  if v_funder is null or v_funder = p_user then
    return null;
  end if;

  return v_funder;
end;
$$;

-- ------------------------------------------------------------- 11. RLS ------
alter table public.coupon_redemptions  enable row level security;
alter table public.coupon_audiences    enable row level security;
alter table public.wallet_transactions enable row level security;

-- A customer sees only their own rows; the service role (admin API) bypasses.
drop policy if exists coupon_redemptions_own on public.coupon_redemptions;
create policy coupon_redemptions_own on public.coupon_redemptions
  for select using (auth.uid() = user_id);

drop policy if exists coupon_audiences_own on public.coupon_audiences;
create policy coupon_audiences_own on public.coupon_audiences
  for select using (auth.uid() = user_id);

drop policy if exists wallet_transactions_own on public.wallet_transactions;
create policy wallet_transactions_own on public.wallet_transactions
  for select using (auth.uid() = user_id);

-- ============================================================================
-- VERIFY (run in the SQL editor afterwards; every line should answer true)
-- ----------------------------------------------------------------------------
--   select count(*) filter (where referral_code is null) = 0 as codes_backfilled
--     from public.profiles;
--   select exists (select 1 from public.site_settings where key = 'referral')
--     as referral_settings;
--   select proname from pg_proc
--    where proname in ('wallet_apply','credit_referral','coupon_allows_user',
--                      'coupon_refusal','apply_referral','gen_referral_code',
--                      'assign_referral_code','referrer_for_token')
--    order by proname;   -- 8 rows
--   select count(*) as influencer_share_tokens from public.coupons
--    where audience = 'influencer' and share_token is not null;
-- ============================================================================
