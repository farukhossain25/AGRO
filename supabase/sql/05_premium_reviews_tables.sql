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
