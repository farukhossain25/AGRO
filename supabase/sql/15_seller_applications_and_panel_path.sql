-- ============================================================================
-- 15_seller_applications_and_panel_path.sql
-- ============================================================================
-- WHAT IT DOES
--   1. Adds `seller_panel_path` to `site_settings` (default 'seller') and
--      `panel_path` + `auto_approve_products` to `sellers`.
--   2. Creates `public.seller_applications` table with RLS (applicant + admin).
--   3. Enables Supabase Realtime on `public.notifications` (idempotent).
--   4. Adds `AFTER INSERT` triggers on `orders` and `sub_orders` so both
--      admins and every involved seller receive an in-app notification inside
--      the same transaction.
--
-- WHEN TO RUN
--   After 14_storage_fix.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — uses IF NOT EXISTS, DROP POLICY IF EXISTS, and CREATE OR REPLACE.
-- ============================================================================

-- 1. Seller panel path columns
alter table public.site_settings
  add column if not exists seller_panel_path text not null default 'seller';

alter table public.sellers
  add column if not exists panel_path text,
  add column if not exists auto_approve_products boolean not null default false;

create unique index if not exists idx_sellers_panel_path_unique
  on public.sellers (lower(panel_path))
  where panel_path is not null;

-- 2. Seller applications table
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_name text not null,
  phone text not null,
  address text not null,
  farm_photos text[] not null default '{}',
  product_types text not null default '',
  nid_number text not null,
  payout_details text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seller_applications_user_id on public.seller_applications (user_id);
create index if not exists idx_seller_applications_status on public.seller_applications (status);

alter table public.seller_applications enable row level security;

drop policy if exists "seller_applications_own_read" on public.seller_applications;
create policy "seller_applications_own_read" on public.seller_applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "seller_applications_own_insert" on public.seller_applications;
create policy "seller_applications_own_insert" on public.seller_applications
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "seller_applications_admin_all" on public.seller_applications;
create policy "seller_applications_admin_all" on public.seller_applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Enable Realtime on notifications (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- 4. Order & Sub-order instant notification triggers
create or replace function public.notify_admins_on_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_rec record;
begin
  for admin_rec in
    select id from public.profiles where role = 'admin'
  loop
    insert into public.notifications (user_id, title, body, link, kind, meta)
    values (
      admin_rec.id,
      'নতুন অর্ডার এসেছে!',
      format('অর্ডার #%s — মোট ৳%s', coalesce(new.order_number, left(new.id::text, 8)), coalesce(new.total::text, '0')),
      '/foisal/orders',
      'order',
      jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
    );
  end loop;
  return new;
exception when others then
  -- Never block order creation if notification fails
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_on_new_order on public.orders;
create trigger trg_notify_admins_on_new_order
  after insert on public.orders
  for each row
  execute function public.notify_admins_on_new_order();

create or replace function public.notify_seller_on_new_sub_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_uid uuid;
  seller_path text;
  default_path text;
begin
  select user_id, panel_path into seller_uid, seller_path
    from public.sellers
   where id = new.seller_id;

  if seller_uid is null then
    return new;
  end if;

  select coalesce(nullif(seller_panel_path, ''), 'seller') into default_path
    from public.site_settings
   limit 1;

  insert into public.notifications (user_id, title, body, link, kind, meta)
  values (
    seller_uid,
    'নতুন বিক্রয় অর্ডার!',
    format('সাব-অর্ডার #%s — ৳%s', left(new.id::text, 8), coalesce(new.subtotal::text, '0')),
    '/' || coalesce(nullif(seller_path, ''), default_path, 'seller') || '/orders',
    'order',
    jsonb_build_object('order_id', new.order_id, 'sub_order_id', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_notify_seller_on_new_sub_order on public.sub_orders;
create trigger trg_notify_seller_on_new_sub_order
  after insert on public.sub_orders
  for each row
  execute function public.notify_seller_on_new_sub_order();
