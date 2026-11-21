-- ============================================================
-- 0002 — OTP codes, storage bucket, and admin helper indexes
-- Run after 0001_init.sql
-- ============================================================

-- OTP table is already created by 0001; this makes the intent explicit and
-- adds the columns used by app/api/auth/otp/*.
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

create index if not exists otp_phone_idx     on otp_codes(phone);
create index if not exists otp_expires_idx   on otp_codes(expires_at);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_no_idx     on orders(order_no);
create index if not exists subs_status_idx   on subscriptions(status);
create index if not exists products_slug_idx on products(slug);

alter table otp_codes enable row level security;
-- No public policies: OTP rows are only ever touched with the service role.

-- Supabase Storage bucket for admin product image uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  4194304,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 4194304;

-- Public read of uploaded product images; writes go through the service role.
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');
