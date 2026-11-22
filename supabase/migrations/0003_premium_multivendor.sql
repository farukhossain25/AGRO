-- ============================================================================
-- 0003 — Premium multi-vendor platform: farms, CCTV, premium plans,
--        sellers, sub-orders, custom combos, notifications, parcels, audit
-- ============================================================================
-- Run after 0001_init.sql and 0002_otp.sql.

-- ---------------------------------------------------------------- roles
-- users.role gains 'seller' and 'premium'. Premium is also derived from an
-- active premium_subscriptions row — the role is only a denormalised hint.
alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('customer', 'premium', 'seller', 'admin'));

alter table users
  add column if not exists premium_until timestamptz,
  add column if not exists avatar        text,
  add column if not exists locale        text default 'bn';

-- users can be both a seller and a premium customer; keep a flag for the UI
alter table users add column if not exists is_seller boolean default false;

-- ============================================================== farms
create table if not exists farms (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name_bn           text not null,
  name_en           text,
  -- vegetables | dairy | poultry | fish | fruits
  type              text not null default 'vegetables'
                    check (type in ('vegetables','dairy','poultry','fish','fruits')),
  owner_user_id     uuid references users(id) on delete set null,
  owner_name_bn     text,
  owner_phone       text,
  owner_photo       text,
  owner_bio_bn      text,
  division          text not null default 'ঢাকা',
  district          text not null default 'ঢাকা',
  upazila           text,
  address_bn        text,
  lat               numeric(10, 7),
  lng               numeric(10, 7),
  -- [[lng, lat], [lng, lat], …] closed polygon
  boundary          jsonb,
  -- [{ month: "বৈশাখ", crops: ["পালং", "ঢেঁড়স"] }, …]
  harvest_calendar  jsonb default '[]'::jsonb,
  description_bn    text,
  story_bn          text,
  cover             text,
  images            text[] default '{}',
  -- recorded daily production numbers for the dairy live page
  daily_output      jsonb default '{}'::jsonb,
  established_year  int,
  certifications    text[] default '{}',
  is_active         boolean default true,
  is_premium        boolean default true,
  sort_order        int default 0,
  created_at        timestamptz default now()
);
create index if not exists farms_type_idx     on farms(type);
create index if not exists farms_district_idx on farms(district);
create index if not exists farms_owner_idx    on farms(owner_user_id);

-- ============================================================ cameras
create table if not exists cameras (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references farms(id) on delete cascade,
  name_bn         text not null,
  -- জমি | গোয়ালঘর | প্যাকিং | মুরগিঘর | পুকুর
  zone_bn         text default 'জমি',
  -- NEVER exposed to the browser. Only the server reads this to mint tokens.
  stream_key      text unique not null,
  -- hls | webrtc (webrtc goes through go2rtc, hls through MediaMTX)
  protocol        text not null default 'hls' check (protocol in ('hls','webrtc')),
  -- optional absolute override (private network / tunnel); also server-only
  stream_url      text,
  poster          text,
  location_lat    numeric(10, 7),
  location_lng    numeric(10, 7),
  status          text not null default 'offline' check (status in ('online','offline','maintenance')),
  last_heartbeat  timestamptz,
  is_active       boolean default true,
  is_premium      boolean default true,
  max_viewers     int default 50,
  sort_order      int default 0,
  created_at      timestamptz default now()
);
create index if not exists cameras_farm_idx   on cameras(farm_id);
create index if not exists cameras_status_idx on cameras(status);

-- viewer telemetry → "most-watched farms" report
create table if not exists camera_view_logs (
  id         bigserial primary key,
  camera_id  uuid references cameras(id) on delete cascade,
  farm_id    uuid references farms(id) on delete cascade,
  user_id    uuid references users(id) on delete set null,
  seconds    int not null default 0,
  created_at timestamptz default now()
);
create index if not exists view_logs_camera_idx on camera_view_logs(camera_id);
create index if not exists view_logs_created_idx on camera_view_logs(created_at desc);

-- ======================================================= premium plans
create table if not exists premium_plans (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name_bn        text not null,
  name_en        text,
  -- basic = a handful of farms, full = every farm & camera
  tier           text not null default 'full' check (tier in ('basic','full')),
  -- monthly | half_yearly | yearly
  interval       text not null default 'monthly' check (interval in ('monthly','half_yearly','yearly')),
  price          numeric(10, 2) not null,
  compare_price  numeric(10, 2),
  duration_days  int not null default 30,
  max_devices    int not null default 2,
  features       jsonb default '[]'::jsonb,
  is_active      boolean default true,
  is_popular     boolean default false,
  sort_order     int default 0,
  created_at     timestamptz default now()
);

-- ================================================ premium subscriptions
create table if not exists premium_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  sub_no          text unique not null,
  user_id         uuid references users(id) on delete cascade,
  plan_id         uuid references premium_plans(id) on delete set null,
  plan_name_bn    text not null,
  tier            text not null default 'full',
  amount          numeric(10, 2) not null default 0,
  status          text not null default 'pending'
                  check (status in ('pending','active','grace','expired','cancelled')),
  started_at      timestamptz,
  expires_at      timestamptz,
  grace_until     timestamptz,
  -- web | android (Play Billing)
  platform        text not null default 'web' check (platform in ('web','android')),
  payment_method  text default 'bkash',
  payment_ref     text,
  auto_renew      boolean default false,
  device_limit    int default 2,
  reminded_7d     boolean default false,
  reminded_3d     boolean default false,
  reminded_1d     boolean default false,
  created_at      timestamptz default now()
);
create index if not exists premium_subs_user_idx   on premium_subscriptions(user_id);
create index if not exists premium_subs_status_idx on premium_subscriptions(status);
create index if not exists premium_subs_expiry_idx on premium_subscriptions(expires_at);

-- ================================================= premium access codes
create table if not exists premium_access_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  plan_id          uuid references premium_plans(id) on delete set null,
  user_id          uuid references users(id) on delete set null,
  subscription_id  uuid references premium_subscriptions(id) on delete set null,
  status           text not null default 'unused'
                   check (status in ('unused','used','revoked','expired')),
  issued_at        timestamptz default now(),
  used_at          timestamptz,
  expires_at       timestamptz,
  note             text
);
create index if not exists access_codes_user_idx   on premium_access_codes(user_id);
create index if not exists access_codes_status_idx on premium_access_codes(status);

-- ============================================ premium device registry
create table if not exists premium_devices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references users(id) on delete cascade,
  subscription_id  uuid references premium_subscriptions(id) on delete cascade,
  fingerprint      text not null,
  label            text,
  user_agent       text,
  last_seen        timestamptz default now(),
  created_at       timestamptz default now(),
  unique (user_id, fingerprint)
);

-- ==================================================== free trial grants
-- Server-side trial enforcement. The browser never decides when the trial ends.
create table if not exists trial_grants (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null,
  user_id      uuid references users(id) on delete set null,
  minutes      int not null default 10,
  ip_hash      text,
  started_at   timestamptz default now(),
  expires_at   timestamptz not null,
  created_at   timestamptz default now(),
  unique (fingerprint)
);
create index if not exists trial_expiry_idx on trial_grants(expires_at);

-- short-lived viewer sessions → concurrent-viewer cap + revocation
create table if not exists stream_sessions (
  jti         uuid primary key default gen_random_uuid(),
  camera_id   uuid references cameras(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  fingerprint text,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);
create index if not exists stream_sessions_cam_idx on stream_sessions(camera_id);

-- ============================================================= sellers
create table if not exists sellers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references users(id) on delete cascade,
  slug               text unique not null,
  farm_id            uuid references farms(id) on delete set null,
  name_bn            text not null,
  phone              text not null,
  email              text,
  nid                text,
  farm_address_bn    text,
  division           text default 'ঢাকা',
  district           text default 'ঢাকা',
  farm_photos        text[] default '{}',
  product_types      text[] default '{}',
  payout_method      text default 'bkash' check (payout_method in ('bkash','nagad','bank')),
  payout_number      text,
  bank_name          text,
  bank_account       text,
  commission_percent numeric(5, 2) default 10,
  status             text not null default 'pending'
                     check (status in ('pending','approved','rejected','suspended')),
  rejection_reason   text,
  approved_at        timestamptz,
  created_at         timestamptz default now()
);
create index if not exists sellers_status_idx on sellers(status);
create index if not exists sellers_user_idx   on sellers(user_id);

create table if not exists seller_payouts (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid references sellers(id) on delete cascade,
  period_from date not null,
  period_to   date not null,
  orders_count int default 0,
  gross       numeric(12, 2) not null default 0,
  commission  numeric(12, 2) not null default 0,
  net         numeric(12, 2) not null default 0,
  status      text not null default 'pending' check (status in ('pending','paid','cancelled')),
  method      text,
  reference   text,
  paid_at     timestamptz,
  created_at  timestamptz default now()
);
create index if not exists payouts_seller_idx on seller_payouts(seller_id);

-- camera setup requests raised by sellers
create table if not exists camera_requests (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid references sellers(id) on delete cascade,
  farm_id     uuid references farms(id) on delete set null,
  note_bn     text,
  camera_count int default 1,
  status      text not null default 'pending' check (status in ('pending','approved','rejected','installed')),
  admin_note  text,
  created_at  timestamptz default now()
);

-- products gain seller ownership + an approval queue
alter table products
  add column if not exists seller_id       uuid references sellers(id) on delete set null,
  add column if not exists farm_id         uuid references farms(id) on delete set null,
  add column if not exists approval_status text default 'approved'
    check (approval_status in ('pending','approved','rejected')),
  add column if not exists approval_note   text,
  add column if not exists weight_grams    int,
  add column if not exists commission_percent numeric(5,2);
create index if not exists products_seller_idx   on products(seller_id);
create index if not exists products_approval_idx on products(approval_status);

-- ============================================== sub-orders per seller
create table if not exists sub_orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  sub_no          text unique not null,
  seller_id       uuid references sellers(id) on delete set null,
  farm_id         uuid references farms(id) on delete set null,
  seller_name     text,
  subtotal        numeric(10, 2) not null default 0,
  commission      numeric(10, 2) not null default 0,
  seller_earning  numeric(10, 2) not null default 0,
  status          text not null default 'received'
                  check (status in ('received','packing','shipped','delivered','cancelled')),
  created_at      timestamptz default now()
);
create index if not exists sub_orders_order_idx  on sub_orders(order_id);
create index if not exists sub_orders_seller_idx on sub_orders(seller_id);

-- order_items belong to a seller via the sub-order
alter table order_items
  add column if not exists sub_order_id uuid references sub_orders(id) on delete cascade,
  add column if not exists seller_id    uuid references sellers(id) on delete set null,
  add column if not exists weight_grams int;

-- ==================================================== custom combos
create table if not exists custom_combos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  name_bn         text not null default 'আমার কম্বো',
  -- [{ productId, slug, name_bn, unit, price, qty, sellerId, image }]
  items           jsonb not null default '[]'::jsonb,
  item_count      int not null default 0,
  price_cached    numeric(10, 2) not null default 0,
  repeat_interval text default 'none' check (repeat_interval in ('none','weekly','monthly')),
  is_active       boolean default true,
  created_at      timestamptz default now()
);
create index if not exists custom_combos_user_idx on custom_combos(user_id);

-- ===================================================== notifications
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  audience   text not null default 'user' check (audience in ('user','seller','admin')),
  kind       text not null default 'system'
             check (kind in ('order','status','premium','seller','product','camera','system')),
  title_bn   text not null,
  body_bn    text,
  link       text,
  meta       jsonb default '{}'::jsonb,
  is_read    boolean default false,
  created_at timestamptz default now()
);
create index if not exists notif_user_idx    on notifications(user_id, is_read);
create index if not exists notif_created_idx on notifications(created_at desc);

-- web push (VAPID) endpoints
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz default now()
);

-- Firebase Cloud Messaging device tokens (Capacitor Android app)
create table if not exists fcm_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  token      text unique not null,
  platform   text default 'android' check (platform in ('android','ios','web')),
  created_at timestamptz default now()
);

-- ================================================ parcels / QR labels
create table if not exists parcels (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  sub_order_id uuid references sub_orders(id) on delete cascade,
  order_no     text not null,
  qr_token     text unique not null,
  label        jsonb default '{}'::jsonb,
  printed_count int default 0,
  delivered_at timestamptz,
  delivered_by uuid references users(id) on delete set null,
  created_at   timestamptz default now()
);
create index if not exists parcels_order_idx on parcels(order_id);

-- ======================================================= audit logs
create table if not exists audit_logs (
  id          bigserial primary key,
  actor_id    uuid references users(id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text,
  entity_id   text,
  meta        jsonb default '{}'::jsonb,
  ip          text,
  created_at  timestamptz default now()
);
create index if not exists audit_created_idx on audit_logs(created_at desc);

-- ============================================================ settings
insert into settings (key, value) values
  ('premium', '{"trial_minutes": 10, "grace_days": 3, "default_device_limit": 2, "max_viewers_per_camera": 50}'::jsonb),
  ('seller',  '{"default_commission_percent": 10, "auto_approve": false}'::jsonb)
on conflict (key) do nothing;

-- ======================================================== row level sec.
alter table farms                  enable row level security;
alter table cameras                enable row level security;
alter table camera_view_logs       enable row level security;
alter table premium_plans          enable row level security;
alter table premium_subscriptions  enable row level security;
alter table premium_access_codes   enable row level security;
alter table premium_devices        enable row level security;
alter table trial_grants           enable row level security;
alter table stream_sessions        enable row level security;
alter table sellers                enable row level security;
alter table seller_payouts         enable row level security;
alter table camera_requests        enable row level security;
alter table sub_orders             enable row level security;
alter table custom_combos          enable row level security;
alter table notifications          enable row level security;
alter table push_subscriptions     enable row level security;
alter table fcm_tokens             enable row level security;
alter table parcels                enable row level security;
alter table audit_logs             enable row level security;

-- Public catalogue reads (writes always go through the service role)
drop policy if exists "public read farms"    on farms;
create policy "public read farms" on farms for select using (is_active = true);

drop policy if exists "public read cameras"  on cameras;
create policy "public read cameras" on cameras for select
  using (is_active = true and is_premium = true);   -- stream_url/stream_key never selected client-side

drop policy if exists "public read plans"    on premium_plans;
create policy "public read plans" on premium_plans for select using (is_active = true);

-- Everything else: service-role only. No public policies by design.

-- ======================================================== helper views
create or replace view v_farm_stats as
select
  f.id,
  f.slug,
  f.name_bn,
  f.type,
  f.district,
  count(distinct c.id)                                    as camera_count,
  count(distinct c.id) filter (where c.status = 'online') as online_cameras,
  count(distinct p.id) filter (where p.is_active)         as product_count
from farms f
left join cameras  c on c.farm_id = f.id
left join products p on p.farm_id = f.id
group by f.id;

create or replace view v_premium_revenue as
select
  date_trunc('month', coalesce(s.started_at, s.created_at)) as month,
  count(*) filter (where s.status in ('active','grace'))    as active_count,
  sum(case when s.status in ('active','grace') then s.amount else 0 end) as revenue
from premium_subscriptions s
group by 1
order by 1 desc;

create or replace view v_seller_leaderboard as
select
  se.id,
  se.name_bn,
  se.status,
  count(so.id)                                              as orders,
  coalesce(sum(so.subtotal), 0)                             as gross,
  coalesce(sum(so.commission), 0)                           as commission,
  coalesce(sum(so.seller_earning), 0)                       as earnings
from sellers se
left join sub_orders so on so.seller_id = se.id
group by se.id;
