-- ============================================================================
-- 0004 — Supabase Auth: profiles, wishlists, recently-viewed, storage buckets
--        and full Row Level Security for every table.
-- ============================================================================
-- Run AFTER 0001_init.sql, 0002_otp.sql and 0003_premium_multivendor.sql.
--
-- Design note (dual-mode auth)
-- ---------------------------------------------------------------------------
--   auth.users  ← Supabase Auth owns credentials (email+password, Google, MFA)
--   public.users ← the app's existing table: orders, addresses, farms all
--                  reference users(id). Kept as the "application identity".
--   public.profiles ← 1:1 with auth.users, holds the public-facing profile
--                     fields + a legacy_user_id bridge to public.users.
--
--   So:  auth.uid() = profiles.id   and   profiles.legacy_user_id = users.id
--
--   Server routes keep minting the existing ba_session cookie (users.id) after
--   verifying the Supabase session, which is why none of the 50+ existing
--   routes had to change.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================== profiles
create table if not exists profiles (
  -- 1:1 with auth.users; cascade so deleting the auth user cleans up
  id               uuid primary key references auth.users(id) on delete cascade,
  -- bridge to the app's own users table (orders / addresses / farms use it)
  legacy_user_id   uuid unique references users(id) on delete set null,
  full_name        text,
  phone            text,
  avatar_url       text,
  bio              text,
  role             text not null default 'customer'
                   check (role in ('customer', 'seller', 'premium', 'admin')),
  language         text not null default 'bn' check (language in ('bn', 'en')),
  theme            text not null default 'dark' check (theme in ('dark', 'light')),
  -- {"email": true, "push": true, "sms": false}
  notifications    jsonb not null default '{"email": true, "push": true, "sms": false}'::jsonb,
  -- flips to true once the user finishes the "complete your profile" prompt
  onboarded        boolean not null default false,
  -- admin-only: TOTP enrolled through Supabase MFA
  mfa_enrolled     boolean not null default false,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists profiles_legacy_idx on profiles(legacy_user_id);
create index if not exists profiles_role_idx   on profiles(role);

-- ====================================================== security helpers
-- SECURITY DEFINER so policies can read profiles without recursing into the
-- profiles RLS policy itself.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'seller')
  );
$$;

-- Maps a Supabase Auth user to the app's users.id (used by order/address RLS).
create or replace function public.app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select legacy_user_id from profiles where id = auth.uid();
$$;


-- ============================================ auth.users → profiles trigger
-- Creates (or links) the app row on every first signup, whichever provider.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_email    text := lower(coalesce(new.email, ''));
  v_name     text := coalesce(
                       new.raw_user_meta_data ->> 'full_name',
                       new.raw_user_meta_data ->> 'name',
                       split_part(coalesce(new.email, ''), '@', 1)
                     );
  v_avatar   text := new.raw_user_meta_data ->> 'avatar_url';
  v_phone    text := nullif(new.raw_user_meta_data ->> 'phone', '');
begin
  -- 1. find an existing app user by email, otherwise create one
  if v_email <> '' then
    select id into v_user_id from users where lower(email) = v_email limit 1;
  end if;

  if v_user_id is null then
    insert into users (name, email, phone, role)
    values (v_name, nullif(v_email, ''), v_phone, 'customer')
    returning id into v_user_id;
  else
    update users
       set name  = coalesce(name, v_name),
           phone = coalesce(phone, v_phone)
     where id = v_user_id;
  end if;

  -- 2. create the profile, preserving an existing role if this user is
  --    re-linking after an email change
  insert into profiles (id, legacy_user_id, full_name, phone, avatar_url, role)
  values (new.id, v_user_id, v_name, v_phone, v_avatar, 'customer')
  on conflict (id) do update
    set legacy_user_id = coalesce(profiles.legacy_user_id, excluded.legacy_user_id),
        full_name      = coalesce(profiles.full_name, excluded.full_name),
        avatar_url     = coalesce(profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- updated_at bookkeeping
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
  for each row execute function public.touch_updated_at();

-- ===================================================== wishlist / history
create table if not exists wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists wishlists_user_idx on wishlists(user_id);

create table if not exists recently_viewed (
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists recently_viewed_user_idx on recently_viewed(user_id, viewed_at desc);

-- ============================================ rate limiting (durable)
-- The in-memory limiter in lib/api.ts is per-instance; serverless needs this.
create table if not exists login_attempts (
  id         bigserial primary key,
  identifier text not null,
  scope      text not null default 'login',
  ip         text,
  ok         boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_lookup_idx
  on login_attempts(identifier, scope, created_at desc);

create or replace function public.recent_failures(p_identifier text, p_window int default 900)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from login_attempts
  where identifier = lower(p_identifier)
    and ok = false
    and created_at > now() - make_interval(secs => p_window);
$$;

-- Housekeeping: keep 7 days of attempts.
create or replace function public.prune_login_attempts()
returns void language sql security definer set search_path = public as $$
  delete from login_attempts where created_at < now() - interval '7 days';
$$;

-- ================================================= profile completeness
create or replace view v_profile_completion
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.bio,
  p.language,
  p.role,
  p.onboarded,
  (p.full_name is not null and length(btrim(p.full_name)) > 1) as has_name,
  (p.phone     is not null and length(btrim(p.phone))     > 5) as has_phone,
  (p.avatar_url is not null)                                   as has_avatar,
  exists (select 1 from addresses a where a.user_id = p.legacy_user_id) as has_address,
  (
    (p.full_name is not null and length(btrim(p.full_name)) > 1)
    and (p.phone  is not null and length(btrim(p.phone)) > 5)
    and exists (select 1 from addresses a where a.user_id = p.legacy_user_id)
  ) as is_complete
from profiles p;

-- ============================================ public supplier directory
-- The product page needs farm/seller details but MUST NOT leak NID, bank
-- account, or the seller's personal phone. A definer-rights view exposes only
-- whitelisted columns of *approved* sellers (and bypasses base-table RLS).
create or replace view public_sellers
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
  s.status,
  s.approved_at,
  s.created_at,
  f.name_bn        as farm_name_bn,
  f.owner_photo    as farm_photo,
  f.owner_bio_bn   as farm_bio_bn,
  f.description_bn as farm_description_bn,
  f.cover          as farm_cover,
  f.images         as farm_images,
  f.division       as farm_division,
  f.district       as farm_district,
  f.upazila        as farm_upazila,
  f.address_bn     as farm_address,
  f.lat            as farm_lat,
  f.lng            as farm_lng,
  f.established_year,
  f.certifications,
  f.slug           as farm_slug
from sellers s
left join farms f on f.id = s.farm_id
where s.status = 'approved';

-- Products joined to their public supplier — one row per active product.
-- Farm fields come straight from farms (a farm can exist without a seller);
-- seller fields are layered on top only when an approved seller exists.
create or replace view v_product_supplier
with (security_invoker = false) as
select
  p.id            as product_id,
  p.slug          as product_slug,
  p.farm_id,
  p.seller_id,
  ps.id           as public_seller_id,
  ps.slug         as seller_slug,
  ps.name_bn      as seller_name_bn,
  coalesce(f.name_bn, ps.farm_name_bn)                 as farm_name_bn,
  coalesce(ps.farm_photo, f.owner_photo)               as farm_photo,
  coalesce(ps.farm_bio_bn, f.owner_bio_bn)             as farm_bio_bn,
  coalesce(ps.farm_description_bn, f.description_bn)   as farm_description_bn,
  coalesce(ps.farm_cover, f.cover)                     as farm_cover,
  coalesce(ps.farm_images, f.images)                   as farm_images,
  coalesce(ps.farm_division, f.division)               as division,
  coalesce(ps.farm_district, f.district)               as district,
  coalesce(ps.farm_upazila, f.upazila)                 as farm_upazila,
  coalesce(ps.farm_address, f.address_bn)              as farm_address_bn,
  coalesce(ps.farm_lat, f.lat)                         as farm_lat,
  coalesce(ps.farm_lng, f.lng)                         as farm_lng,
  coalesce(ps.established_year, f.established_year)    as established_year,
  coalesce(ps.certifications, f.certifications)        as certifications,
  f.slug          as farm_slug,
  (select count(*) from products p2
     where p2.is_active and p2.farm_id = p.farm_id)     as product_count,
  (select count(*) from cameras c
     where c.farm_id = p.farm_id and c.is_active)        as camera_count
from products p
left join farms f on f.id = p.farm_id
left join public_sellers ps
  on ps.id = p.seller_id
  or (p.seller_id is null and ps.farm_id = p.farm_id and ps.status = 'approved');

grant select on public_sellers, v_product_supplier to anon, authenticated;

-- =============================================================== RLS on
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','wishlists','recently_viewed','login_attempts',
    'users','addresses','orders','order_items','subscriptions',
    'categories','products','combos','packages','coupons','delivery_zones',
    'reviews','blog_posts','farmers','banners','settings','otp_codes',
    'newsletter_subscribers','contact_messages',
    'farms','cameras','camera_view_logs','premium_plans','premium_subscriptions',
    'premium_access_codes','premium_devices','trial_grants','stream_sessions',
    'sellers','seller_payouts','camera_requests','sub_orders','custom_combos',
    'notifications','push_subscriptions','fcm_tokens','parcels','audit_logs'
  ]
  loop
    begin
      execute format('alter table %I enable row level security', t);
    exception when undefined_table then
      raise notice 'skipping missing table %', t;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------- profiles
drop policy if exists "profiles_select_own"   on profiles;
drop policy if exists "profiles_update_own"   on profiles;
drop policy if exists "profiles_staff_read"   on profiles;
drop policy if exists "profiles_admin_all"    on profiles;

-- a user reads only their own profile …
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

-- … and edits only their own (role is guarded below by a trigger)
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- staff (admin + sellers) can read profiles for support/CRM
create policy "profiles_staff_read" on profiles
  for select using (public.is_staff());

-- admins can do anything
create policy "profiles_admin_all" on profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Privilege escalation guard: a non-admin can never change their own role,
-- and nobody can self-grant admin through a plain UPDATE.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    -- allow the service role (server-side seed / admin panel) to change it
    if auth.uid() is not null then
      raise exception 'role change not permitted' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role before update on profiles
  for each row execute function public.guard_profile_role();

-- -------------------------------------------------------------- wishlists
drop policy if exists "wishlists_own" on wishlists;
create policy "wishlists_own" on wishlists
  for all
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

-- --------------------------------------------------------- recently_viewed
drop policy if exists "recently_viewed_own" on recently_viewed;
create policy "recently_viewed_own" on recently_viewed
  for all
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

-- ---------------------------------------------------------- login_attempts
-- Only the service role touches this table; no client policy at all means
-- anon/authenticated are denied by default.
revoke all on login_attempts from anon, authenticated;

-- ---------------------------------------------------------------- users
drop policy if exists "users_select_own" on users;
drop policy if exists "users_update_own" on users;
drop policy if exists "users_staff_read" on users;
create policy "users_select_own" on users
  for select using (id = public.app_user_id());
create policy "users_update_own" on users
  for update using (id = public.app_user_id())
  with check (id = public.app_user_id());
create policy "users_staff_read" on users
  for select using (public.is_staff());

-- ------------------------------------------------------------- addresses
drop policy if exists "addresses_own" on addresses;
drop policy if exists "addresses_staff_read" on addresses;
create policy "addresses_own" on addresses
  for all
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());
create policy "addresses_staff_read" on addresses
  for select using (public.is_staff());

-- ---------------------------------------------------------------- orders
drop policy if exists "orders_select_own" on orders;
drop policy if exists "orders_staff_read" on orders;
drop policy if exists "orders_insert_own" on orders;
create policy "orders_select_own" on orders
  for select using (user_id = public.app_user_id());
create policy "orders_insert_own" on orders
  for insert with check (user_id = public.app_user_id());
create policy "orders_staff_read" on orders
  for select using (public.is_staff());

drop policy if exists "order_items_select_own" on order_items;
drop policy if exists "order_items_staff_read" on order_items;
create policy "order_items_select_own" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id and o.user_id = public.app_user_id()
    )
  );
create policy "order_items_staff_read" on order_items
  for select using (public.is_staff());

-- -------------------------------------------------------- subscriptions
drop policy if exists "subscriptions_own" on subscriptions;
drop policy if exists "subscriptions_staff_read" on subscriptions;
create policy "subscriptions_own" on subscriptions
  for select using (user_id = public.app_user_id());
create policy "subscriptions_staff_read" on subscriptions
  for select using (public.is_staff());

-- ------------------------------------------------- premium subscriptions
drop policy if exists "premium_subs_own" on premium_subscriptions;
drop policy if exists "premium_subs_staff" on premium_subscriptions;
create policy "premium_subs_own" on premium_subscriptions
  for select using (user_id = public.app_user_id());
create policy "premium_subs_staff" on premium_subscriptions
  for select using (public.is_admin());

-- ------------------------------------------------------ premium devices
drop policy if exists "premium_devices_own" on premium_devices;
create policy "premium_devices_own" on premium_devices
  for select using (user_id = public.app_user_id());

-- ---------------------------------------------------------- stream sessions
drop policy if exists "stream_sessions_own" on stream_sessions;
create policy "stream_sessions_own" on stream_sessions
  for select using (user_id = public.app_user_id());

-- ------------------------------------------------------------ notifications
drop policy if exists "notifications_own" on notifications;
create policy "notifications_own" on notifications
  for all
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

drop policy if exists "push_subscriptions_own" on push_subscriptions;
create policy "push_subscriptions_own" on push_subscriptions
  for all
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

-- ------------------------------------------------------------- sellers
-- Sellers see their own row; the public sees only the whitelisted view above.
drop policy if exists "sellers_own" on sellers;
drop policy if exists "sellers_admin" on sellers;
create policy "sellers_own" on sellers
  for select using (user_id = public.app_user_id());
create policy "sellers_admin" on sellers
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------- products
-- Public catalogue read already exists from 0001. Sellers may insert/update
-- only their own pending products; admins approve/reject.
drop policy if exists "products_seller_write" on products;
create policy "products_seller_write" on products
  for insert with check (
    exists (
      select 1 from sellers s
      where s.id = products.seller_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "products_seller_update" on products;
create policy "products_seller_update" on products
  for update
  using (
    exists (
      select 1 from sellers s
      where s.user_id = public.app_user_id() and s.id = products.seller_id
    )
  )
  with check (
    exists (
      select 1 from sellers s
      where s.user_id = public.app_user_id() and s.id = products.seller_id
    )
    -- a seller can never self-approve
    and products.approval_status <> 'approved'
  );

-- --------------------------------------------------------- farms/cameras
drop policy if exists "farms_public_read" on farms;
drop policy if exists "farms_owner_read" on farms;
create policy "farms_public_read" on farms
  for select using (is_active = true);
create policy "farms_owner_read" on farms
  for select using (owner_user_id = public.app_user_id());

-- CAMERAS — the most sensitive table in the schema (stream_key would let
-- anyone pull the RTSP feed). Defence in depth:
--   1. column-level grants: stream_key / stream_url are never selectable by
--      anon or authenticated, regardless of row policies
--   2. row policy: only active cameras, plus a farm owner's own cameras
drop policy if exists "public read cameras" on cameras;
drop policy if exists "cameras_public_read" on cameras;
drop policy if exists "cameras_owner_read" on cameras;

revoke select on cameras from anon, authenticated;
grant select (
  id, farm_id, name_bn, zone_bn, protocol, poster, location_lat, location_lng,
  status, last_heartbeat, is_active, is_premium, max_viewers, sort_order
) on cameras to anon, authenticated;

create policy "cameras_public_read" on cameras
  for select using (is_active = true);

create policy "cameras_owner_read" on cameras
  for select using (
    exists (select 1 from farms f where f.id = cameras.farm_id and f.owner_user_id = public.app_user_id())
  );

-- -------------------------------------------------------------- reviews
drop policy if exists "reviews_insert_own" on reviews;
create policy "reviews_insert_own" on reviews
  for insert with check (user_id = public.app_user_id());

-- ============================================================ storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',        'avatars',        true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('product-images', 'product-images', true,  5242880,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('farm-images',    'farm-images',    true,  8388608,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Avatars: world-readable, each user may only write inside their own folder
-- named after their auth uid (avatars/<uid>/photo.webp).
drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_own_write"    on storage.objects;
drop policy if exists "avatars_own_update"   on storage.objects;
drop policy if exists "avatars_own_delete"   on storage.objects;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_own_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Product / farm images: public read, writes via the server (service role)
-- or an admin/seller. Deliberately no client INSERT policy → uploads go
-- through /api/admin/upload which checks the role server-side.
drop policy if exists "catalogue_images_public_read" on storage.objects;
create policy "catalogue_images_public_read" on storage.objects
  for select using (bucket_id in ('product-images', 'farm-images'));

-- ============================================================ grants
grant usage on schema public to anon, authenticated;
grant select on public_sellers, v_product_supplier, v_profile_completion to anon, authenticated;
grant select, insert, update, delete on wishlists, recently_viewed to authenticated;
grant select, update on profiles to authenticated;

-- ============================================================ settings
insert into settings (key, value)
values
  ('auth', '{"admin_session_hours": 12, "max_failed_logins": 5, "lockout_minutes": 15, "require_admin_mfa": false}'::jsonb),
  ('profile', '{"prompt_after_signup": true}'::jsonb)
on conflict (key) do nothing;

-- ================================================== migration of existing users
-- Existing bcrypt accounts keep working through the fallback path. This block
-- links them to profiles as soon as they exist in auth.users (after you run
-- the seed-admin function or a user resets their password).
insert into profiles (id, legacy_user_id, full_name, phone, avatar_url, role)
select
  au.id,
  u.id,
  coalesce(u.name, split_part(au.email, '@', 1)),
  u.phone,
  u.avatar,
  case when u.role = 'admin' then 'admin'
       when u.role = 'seller' then 'seller'
       when u.role = 'premium' then 'premium'
       else 'customer' end
from auth.users au
join users u on lower(u.email) = lower(au.email)
on conflict (id) do nothing;

-- ============================================================ admin 2FA
-- Secrets are service-role only: RLS is on with NO policy, so neither the
-- anon key nor an authenticated user can read the TOTP secret.
create table if not exists admin_mfa (
  user_id        uuid primary key references users(id) on delete cascade,
  secret         text not null,
  enabled        boolean not null default false,
  recovery_hashes text[] default '{}',
  created_at     timestamptz not null default now(),
  enabled_at     timestamptz
);

alter table admin_mfa enable row level security;
revoke all on admin_mfa from anon, authenticated;

-- login_attempts is written only by the server
alter table login_attempts enable row level security;
revoke all on login_attempts from anon, authenticated;
