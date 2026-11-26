-- ============================================================================
-- 13_verify_setup.sql
-- ============================================================================
-- WHAT IT DOES
--   READ-ONLY health check of the whole database. It writes nothing.
--   Run it after 12_make_admin.sql, and again any time something looks wrong.
--   The /foisal → System Check page runs the same checks in the app.
--
-- WHEN TO RUN
--   Last, after 12_make_admin.sql. Also after any manual change.
--
-- WHAT YOU SHOULD SEE
--   One result table with columns: section | item | status | detail
--     PASS  = good
--     WARN  = works, but optional data / placeholder is missing
--     INFO  = a row count (seeds are optional)
--     FAIL  = something is missing — read `detail` and re-run the file named
--             in the detail column.
--   Aim for zero FAIL rows before going live.
-- ============================================================================

with expected_tables(name) as (
  values
    ('profiles'),('addresses'),('site_settings'),('social_links'),('team_members'),
    ('static_pages'),('audit_log'),('login_attempts'),('contact_messages'),
    ('newsletter_subscribers'),('media_assets'),('seo_meta'),
    ('categories'),('farms'),('cameras'),('sellers'),('seller_payouts'),
    ('seller_warnings'),('camera_requests'),('camera_view_logs'),('products'),
    ('product_images'),('coupons'),('delivery_charges'),
    ('combos'),('combo_items'),('subscription_plans'),('subscriptions'),
    ('cart_items'),('orders'),('order_items'),('sub_orders'),('payment_methods'),
    ('parcels'),('custom_combos'),
    ('plans'),('user_subscriptions'),('access_codes'),('trials'),('stream_tokens'),
    ('premium_devices'),('reviews'),('review_photos'),('review_tags'),('complaints'),
    ('complaint_messages'),('notifications'),('push_subscriptions'),('fcm_tokens'),
    ('wishlist'),('recently_viewed'),
    ('hero_slides'),('homepage_sections'),('banners'),('menus'),('menu_items'),
    ('blog_posts'),('faq_items')
),
expected_functions(name) as (
  values
    ('is_admin'),('is_staff'),('is_seller'),('has_role'),('handle_new_user'),
    ('guard_profile_role'),('set_updated_at'),('place_order'),
    ('recalc_product_rating'),('log_audit'),('login_help'),('gen_order_no'),
    ('set_complaint_ticket'),('sync_product_images'),
    ('is_my_seller')
),
expected_views(name) as (
  values
    ('public_sellers'),('public_cameras'),('v_team_members'),
    ('v_product_rating_breakdown'),('v_supplier_quality'),('v_product_supplier'),
    ('v_farm_stats'),
    ('v_premium_revenue'),('v_seller_leaderboard')
),
expected_triggers(name) as (
  values
    ('on_auth_user_created'),('trg_guard_profile_role'),('trg_reviews_recalc'),
    ('trg_product_images_sync'),('trg_review_photos_sync'),('trg_complaint_ticket')
),
expected_buckets(name) as (
  values
    ('avatars'),('product-images'),('category-images'),('farm-images'),('logos'),
    ('slides'),('team'),('review-photos'),('complaint-photos'),('blog-images')
)

select * from (

-- 1) tables + RLS -----------------------------------------------------------
select
  'TABLES' as section,
  e.name as item,
  case when c.oid is null then 'FAIL'
       when c.relrowsecurity then 'PASS'
       else 'FAIL' end as status,
  case when c.oid is null then 'টেবিল নেই — ফাইলটি আবার চালান'
       when c.relrowsecurity then 'RLS on'
       else 'RLS OFF — 08_rls_policies.sql চালান' end as detail
from expected_tables e
left join pg_class c
       on c.relname = e.name
      and c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'

union all

-- 2) tables without any policy ---------------------------------------------
select
  'POLICIES',
  c.relname,
  case when count(p.policyname) = 0 then 'FAIL' else 'PASS' end,
  count(p.policyname)::text || ' policy(ies)'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (select name from expected_tables)
group by c.relname

union all

-- 3) functions --------------------------------------------------------------
select
  'FUNCTIONS',
  e.name,
  case when exists (
         select 1 from pg_proc pr
          join pg_namespace n on n.oid = pr.pronamespace
         where n.nspname = 'public' and pr.proname = e.name
       ) then 'PASS' else 'FAIL' end,
  case when exists (
         select 1 from pg_proc pr
          join pg_namespace n on n.oid = pr.pronamespace
         where n.nspname = 'public' and pr.proname = e.name
       ) then 'exists' else 'নেই — 07_functions_and_triggers.sql চালান' end
from expected_functions e

union all

-- 4) views ------------------------------------------------------------------
select
  'VIEWS',
  e.name,
  case when exists (
         select 1 from pg_class c
          where c.relnamespace = 'public'::regnamespace
            and c.relname = e.name and c.relkind in ('v','m')
       ) then 'PASS' else 'FAIL' end,
  'view'
from expected_views e

union all

-- 5) triggers ---------------------------------------------------------------
select
  'TRIGGERS',
  e.name,
  case when exists (select 1 from pg_trigger t where t.tgname = e.name and not t.tgisinternal)
       then 'PASS' else 'FAIL' end,
  'trigger'
from expected_triggers e

union all

-- 6) storage buckets --------------------------------------------------------
select
  'STORAGE',
  e.name,
  case when b.id is null then 'FAIL'
       else 'PASS' end,
  case when b.id is null then 'bucket নেই — 09_storage_buckets_and_policies.sql চালান'
       else case when b.public then 'public' else 'PUBLIC হওয়া উচিত!' end end
from expected_buckets e
left join storage.buckets b on b.id = e.name

union all

-- 7) enum types -------------------------------------------------------------
select
  'ENUMS',
  'enum types',
  case when count(*) >= 15 then 'PASS' else 'FAIL' end,
  count(*)::text || ' types'
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typtype = 'e'

union all

-- 8) admin account ----------------------------------------------------------
select
  'ADMIN',
  'profiles.role = admin',
  case when exists (select 1 from public.profiles where role = 'admin' and is_active)
       then 'PASS' else 'WARN' end,
  case when exists (select 1 from public.profiles where role = 'admin' and is_active)
       then 'admin আছে'
       else 'কোনো অ্যাডমিন নেই — 12_make_admin.sql চালান' end

union all

-- 9) payment numbers still placeholders ------------------------------------
select
  'PAYMENTS',
  'account numbers',
  case when count(*) filter (where account_number like '01XXX%') > 0 then 'WARN'
       else 'PASS' end,
  count(*) filter (where account_number like '01XXX%')::text
    || ' placeholder number(s) — /foisal → পেমেন্ট মাধ্যম এ বদলান'
from public.payment_methods

union all

-- 9b) rev 16: wallet/payment/stream hardening actually applied --------------
select 'SECURITY', 'wallet_apply closed to clients',
  case when to_regprocedure('public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid)') is null
         then 'FAIL'
       when has_function_privilege('authenticated',
              'public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid)','execute')
         then 'FAIL' else 'PASS' end,
  '29_security_hardening.sql §1'

union all select 'SECURITY', 'place_order closed to clients',
  case when to_regprocedure('public.place_order(uuid,jsonb,jsonb,text,text,numeric)') is null
         then 'FAIL'
       when has_function_privilege('anon',
              'public.place_order(uuid,jsonb,jsonb,text,text,numeric)','execute')
         then 'FAIL' else 'PASS' end,
  '29_security_hardening.sql §3'

union all select 'SECURITY', 'apply_referral closed to clients',
  case when to_regprocedure('public.apply_referral(uuid,text)') is null
         then 'FAIL'
       when has_function_privilege('authenticated','public.apply_referral(uuid,text)','execute')
         then 'FAIL' else 'PASS' end,
  '29_security_hardening.sql §4'

union all select 'SECURITY', 'payment_refs unique index',
  case when exists (select 1 from pg_indexes
                     where schemaname='public' and tablename='payment_refs'
                       and indexname='payment_refs_unique')
       then 'PASS' else 'FAIL' end,
  '29_security_hardening.sql §5'

union all select 'SECURITY', 'complaint-photos is private',
  case when coalesce((select public from storage.buckets where id='complaint-photos'), true)
       then 'FAIL' else 'PASS' end,
  '29_security_hardening.sql §7'

union all

-- 10) seed row counts (optional, so INFO/WARN only) ------------------------
select 'SEED', 'categories',       case when count(*) >= 9 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.categories
union all select 'SEED', 'products',        case when count(*) >= 30 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.products
union all select 'SEED', 'farms',           case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.farms
union all select 'SEED', 'cameras',         case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.cameras
union all select 'SEED', 'sellers',         case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.sellers
union all select 'SEED', 'payment_methods', case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.payment_methods
union all select 'SEED', 'plans',           case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.plans
union all select 'SEED', 'homepage_sections', case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.homepage_sections
union all select 'SEED', 'hero_slides',     case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.hero_slides
union all select 'SEED', 'delivery_charges',case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.delivery_charges
union all select 'SEED', 'site_settings',   case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.site_settings
union all select 'SEED', 'faq_items',       case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.faq_items
union all select 'SEED', 'blog_posts',      case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.blog_posts
union all select 'SEED', 'coupons',         case when count(*) >= 1 then 'INFO' else 'WARN' end, count(*)::text || ' rows' from public.coupons

) as checks
order by
  case section
    when 'TABLES' then 1 when 'POLICIES' then 2 when 'FUNCTIONS' then 3
    when 'VIEWS' then 4 when 'TRIGGERS' then 5 when 'STORAGE' then 6
    when 'ENUMS' then 7 when 'ADMIN' then 8 when 'PAYMENTS' then 9
    when 'SECURITY' then 9 else 10 end,
  item;
