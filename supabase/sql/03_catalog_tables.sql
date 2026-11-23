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
