-- ============================================================================
-- বিশ্বাস এগ্রো (Biswas Agro) — initial schema
-- Run with:  supabase db push   OR paste into the Supabase SQL editor.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- categories
create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name_bn       text not null,
  name_en       text not null,
  description_bn text,
  icon          text default '🌿',
  image         text,
  sort_order    int  default 0,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------------ products
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  category_id    uuid references categories(id) on delete set null,
  name_bn        text not null,
  name_en        text not null,
  description_bn text,
  unit           text not null default 'কেজি',
  unit_en        text default 'kg',
  price          numeric(10,2) not null check (price >= 0),
  compare_price  numeric(10,2),
  stock          int not null default 0 check (stock >= 0),
  image          text,
  images         text[] default '{}',
  farm_source_bn text,
  harvest_date   date,
  badge_bn       text,
  rating         numeric(2,1) default 5.0,
  review_count   int default 0,
  is_featured    boolean default false,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists products_category_idx on products(category_id);
create index if not exists products_active_idx   on products(is_active);

-- --------------------------------------------------------- combo boxes / plans
create table if not exists combos (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name_bn        text not null,
  name_en        text,
  description_bn text,
  kind           text not null default 'daily' check (kind in ('daily','weekly','monthly')),
  price          numeric(10,2) not null,
  original_price numeric(10,2),
  contents       jsonb not null default '[]'::jsonb,
  image          text,
  is_active      boolean default true,
  sort_order     int default 0,
  created_at     timestamptz default now()
);

create table if not exists packages (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name_bn        text not null,
  name_en        text,
  members_label  text not null,
  members_min    int not null default 2,
  members_max    int not null default 3,
  price_monthly  numeric(10,2) not null,
  saving_label   text,
  features       jsonb not null default '[]'::jsonb,
  image          text,
  is_popular     boolean default false,
  is_active      boolean default true,
  sort_order     int default 0,
  created_at     timestamptz default now()
);

-- --------------------------------------------------------------------- users
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text unique,
  phone         text unique,
  password_hash text,
  role          text not null default 'customer' check (role in ('customer','admin')),
  phone_verified boolean default false,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

create table if not exists otp_codes (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  code_hash  text not null,
  purpose    text default 'login',
  attempts   int default 0,
  expires_at timestamptz not null,
  consumed   boolean default false,
  created_at timestamptz default now()
);
create index if not exists otp_phone_idx on otp_codes(phone);

create table if not exists addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  label       text default 'বাসা',
  full_name   text not null,
  phone       text not null,
  division    text not null,
  district    text not null,
  upazila     text not null,
  address     text not null,
  is_default  boolean default false,
  created_at  timestamptz default now()
);

-- -------------------------------------------------------------------- orders
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique not null,
  user_id        uuid references users(id) on delete set null,
  customer_name  text not null,
  phone          text not null,
  email          text,
  division       text not null,
  district       text not null,
  upazila        text not null,
  address        text not null,
  delivery_note  text,
  subtotal       numeric(10,2) not null default 0,
  delivery_charge numeric(10,2) not null default 0,
  discount       numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  coupon_code    text,
  payment_method text not null default 'cod' check (payment_method in ('cod','bkash','nagad','sslcommerz')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  payment_ref    text,
  status         text not null default 'received'
                 check (status in ('received','packing','shipped','delivered','cancelled')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists orders_phone_idx  on orders(phone);
create index if not exists orders_created_idx on orders(created_at desc);

create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_bn    text not null,
  unit       text,
  price      numeric(10,2) not null,
  quantity   int not null check (quantity > 0),
  image      text
);

-- -------------------------------------------------------------- subscriptions
create table if not exists subscriptions (
  id               uuid primary key default gen_random_uuid(),
  sub_no           text unique not null,
  user_id          uuid references users(id) on delete set null,
  package_id       uuid references packages(id) on delete set null,
  package_name     text not null,
  customer_name    text not null,
  phone            text not null,
  division         text not null,
  district         text not null,
  upazila          text not null,
  address          text not null,
  members          int not null default 3,
  start_date       date not null,
  frequency        text not null default 'weekly' check (frequency in ('weekly','biweekly','monthly')),
  price_monthly    numeric(10,2) not null,
  status           text not null default 'active' check (status in ('active','paused','cancelled')),
  paused_until     date,
  created_at       timestamptz default now()
);

-- ------------------------------------------------------------------- coupons
create table if not exists coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  type          text not null default 'percent' check (type in ('percent','fixed')),
  value         numeric(10,2) not null,
  min_order     numeric(10,2) default 0,
  max_discount  numeric(10,2),
  usage_limit   int,
  used_count    int default 0,
  expires_at    timestamptz,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- -------------------------------------------------------------- delivery zones
create table if not exists delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  district    text unique not null,
  district_en text,
  division    text not null,
  scope       text not null default 'outside_dhaka' check (scope in ('inside_dhaka','outside_dhaka')),
  charge      numeric(10,2) not null default 120,
  free_over   numeric(10,2),
  eta_days    text default '২-৩ দিন',
  is_active   boolean default true
);

-- ------------------------------------------------------------------- reviews
create table if not exists reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  user_id    uuid references users(id) on delete set null,
  name_bn    text not null,
  location_bn text,
  rating     int not null check (rating between 1 and 5),
  comment    text not null,
  is_approved boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------- blog posts
create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title_bn     text not null,
  excerpt_bn   text,
  content_bn   text not null,
  cover        text,
  author_bn    text default 'বিশ্বাস এগ্রো টিম',
  tag_bn       text default 'স্বাস্থ্য টিপস',
  read_minutes int default 4,
  published_at timestamptz default now(),
  is_active    boolean default true
);

-- ------------------------------------------------------------------- farmers
create table if not exists farmers (
  id          uuid primary key default gen_random_uuid(),
  name_bn     text not null,
  location_bn text,
  specialty_bn text,
  story_bn    text,
  years       int default 10,
  image       text,
  is_active   boolean default true,
  sort_order  int default 0
);

-- ------------------------------------------------------- banners & site pieces
create table if not exists banners (
  id         uuid primary key default gen_random_uuid(),
  title_bn   text not null,
  subtitle_bn text,
  image      text,
  link       text default '/products',
  placement  text default 'home_hero',
  is_active  boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz default now()
);

create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  phone      text,
  message    text not null,
  is_read    boolean default false,
  created_at timestamptz default now()
);

create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- ============================================================== row level security
alter table categories            enable row level security;
alter table products              enable row level security;
alter table combos                enable row level security;
alter table packages              enable row level security;
alter table users                 enable row level security;
alter table otp_codes             enable row level security;
alter table addresses             enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table subscriptions         enable row level security;
alter table coupons               enable row level security;
alter table delivery_zones        enable row level security;
alter table reviews               enable row level security;
alter table blog_posts            enable row level security;
alter table farmers               enable row level security;
alter table banners               enable row level security;
alter table newsletter_subscribers enable row level security;
alter table contact_messages      enable row level security;
alter table settings              enable row level security;

-- Public catalog data is readable by anyone (anon key); writes stay server-side
-- (service role bypasses RLS) so no write policies are declared on purpose.
do $$
declare t text;
begin
  foreach t in array array['categories','products','combos','packages','blog_posts','farmers','banners','delivery_zones','settings']
  loop
    execute format('drop policy if exists "%s_public_read" on %I', t, t);
    execute format('create policy "%s_public_read" on %I for select using (true)', t, t);
  end loop;
end $$;

drop policy if exists "reviews_public_read" on reviews;
create policy "reviews_public_read" on reviews for select using (is_approved = true);

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
for each row execute function set_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
for each row execute function set_updated_at();
