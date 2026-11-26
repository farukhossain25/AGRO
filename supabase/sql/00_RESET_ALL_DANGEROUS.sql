-- ============================================================================
-- 00_RESET_ALL_DANGEROUS.sql
-- ============================================================================
--   ███  THIS DELETES ALL DATA. RUN ONLY ON A FRESH/TEST PROJECT  ███
--   ███  OR AFTER YOU HAVE TAKEN A BACKUP.                        ███
--
-- WHAT IT DOES
--   Removes every object this project created, in dependency order:
--     views → tables (+ their policies, indexes, triggers)
--     → functions → enum types
--     → app storage policies → app storage buckets
--
-- WHAT IT NEVER TOUCHES
--   • auth.users (your login accounts) and the rest of the auth schema
--   • Supabase internal schemas (storage tables, extensions, realtime,
--     graphql, vault …) — only this app's bucket rows/policies are removed.
--
-- WHEN TO RUN
--   Only when you want a full clean slate, as the FIRST file, before
--   01_extensions_and_enums.sql.
--   If you are starting from a brand-new Supabase project you do NOT need it.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- BEFORE YOU RUN IT
--   1. Supabase Dashboard → Database → Backups → confirm daily backups exist
--      (or download a dump from Database → Backups).
--   2. Understand that this also deletes customer orders and payments.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Views (they depend on tables)
-- ---------------------------------------------------------------------------
do $$
declare
  v record;
begin
  for v in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('drop view if exists public.%I cascade', v.relname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables (cascade removes indexes, triggers, policies, FKs)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'audit_log','login_attempts','contact_messages','newsletter_subscribers','media_assets','seo_meta',
    'addresses','profiles',
    'site_settings','social_links','team_members','static_pages',
    'product_images','products','cameras','camera_requests','camera_view_logs',
    'seller_payouts','seller_warnings','sellers','farms','categories',
    'coupons','delivery_charges',
    'order_items','sub_orders','parcels','orders',
    'cart_items','payment_methods','custom_combos',
    'combo_items','combos','subscriptions','subscription_plans',
    'reviews','review_photos','review_tags','complaints','complaint_messages',
    'notifications','push_subscriptions','fcm_tokens','wishlist','recently_viewed',
    'access_codes','user_subscriptions','premium_devices','trials','stream_tokens','plans',
    'hero_slides','homepage_sections','banners','menus','menu_items','blog_posts','faq_items',
    -- migration 25/26 tables: without these three the reset leaves them
    -- behind (and 13_verify then reads a half-reset database)
    'wallet_transactions','coupon_redemptions','coupon_audiences',
    'seller_applications',
    -- migration 27: live chat. Without these two the reset leaves them behind.
    'support_messages','support_chats'
  ];
begin
  foreach t in array tables loop
    execute format('drop table if exists public.%I cascade', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Functions (every function in the public schema belongs to this app)
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

-- The signup trigger lives on auth.users, so it must be dropped explicitly
-- (this does not delete any user, only the app's trigger).
drop trigger if exists on_auth_user_created on auth.users;

-- ---------------------------------------------------------------------------
-- 4. Enum types
-- ---------------------------------------------------------------------------
do $$
declare
  e record;
begin
  for e in
    select t.typname
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', e.typname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Storage policies
--    Note: Supabase blocks direct SQL DELETE on storage.buckets / storage.objects
--    (storage.protect_delete trigger). Existing buckets are left intact and will
--    be reused by 09_storage_buckets_and_policies.sql. To empty or delete a
--    bucket, use Supabase Dashboard → Storage.
-- ---------------------------------------------------------------------------
drop policy if exists "public image read" on storage.objects;
drop policy if exists "owners and admins upload images" on storage.objects;
drop policy if exists "owners and admins update images" on storage.objects;
drop policy if exists "owners and admins delete images" on storage.objects;

-- ---------------------------------------------------------------------------
-- 6. Final confirmation
-- ---------------------------------------------------------------------------
select 'reset complete — now run 01_extensions_and_enums.sql' as next_step;
