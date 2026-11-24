-- ============================================================================
-- 22_seller_logo_banner.sql
-- ============================================================================
-- WHAT IT DOES
--   1. Adds `logo` and `banner` to public.sellers — the store's own brand
--      images. The seller uploads them from the dashboard (/seller → স্টোরের
--      লোগো ও ব্যানার) straight from the phone gallery / camera / desktop;
--      the app writes the public URL of the stored file here.
--   2. Recreates the public_sellers view so the storefront (market page,
--      marketplace cards) reads the two columns too. The view is dropped and
--      recreated because CREATE OR REPLACE cannot add columns in the middle.
--
--   No storage change: uploads go through /api/upload (service role) into the
--   public buckets `logos` and `farm-images` that already exist.
--
-- WHEN TO RUN
--   After 21_payments_seed.sql — or any time. Idempotent.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — add column if not exists, drop view if exists, create or replace.
-- ============================================================================

-- 1. Store brand columns
alter table public.sellers
  add column if not exists logo   text,
  add column if not exists banner text;

-- 2. Storefront view (NEVER exposes nid, payout_number, bank_*)
drop view if exists public.public_sellers;

create view public.public_sellers
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

grant select on public.public_sellers to anon, authenticated;
