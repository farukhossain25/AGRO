-- ============================================================================
-- 10_indexes_and_views.sql
-- ============================================================================
-- WHAT IT DOES
--   Adds the indexes that keep the storefront fast and creates the read-only
--   views the app uses:
--     public_sellers        seller storefront data WITHOUT NID / bank details
--     public_cameras        cameras WITHOUT stream_key / stream_url
--     v_team_members        staff accounts for /foisal/team
--     v_product_rating_breakdown
--     v_supplier_quality    seller scorecard for the quality board
--     v_product_supplier    farm + seller card for a product page
--     v_farm_stats,
--     v_premium_revenue, v_seller_leaderboard
--
-- WHEN TO RUN
--   Tenth, after 09_storage_buckets_and_policies.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — every index/view uses IF NOT EXISTS or CREATE OR REPLACE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists products_slug_idx            on public.products (slug);
create index if not exists products_category_idx        on public.products (category_id);
create index if not exists products_seller_idx          on public.products (seller_id);
create index if not exists products_farm_idx            on public.products (farm_id);
create index if not exists products_active_idx          on public.products (is_active, approval_status);
create index if not exists products_featured_idx        on public.products (is_featured) where is_active;
create index if not exists products_name_trgm_idx       on public.products using gin (name_bn extensions.gin_trgm_ops);
create index if not exists product_images_product_idx   on public.product_images (product_id, sort_order);

create index if not exists categories_slug_idx          on public.categories (slug);
create index if not exists categories_parent_idx        on public.categories (parent_id, sort_order);

create index if not exists farms_slug_idx               on public.farms (slug);
create index if not exists farms_active_idx             on public.farms (is_active, sort_order);

create index if not exists cameras_farm_idx             on public.cameras (farm_id, sort_order);
create index if not exists cameras_status_idx           on public.cameras (status) where is_active;
create index if not exists camera_requests_status_idx   on public.camera_requests (status, created_at desc);
create index if not exists camera_view_logs_camera_idx  on public.camera_view_logs (camera_id, created_at desc);

create index if not exists sellers_slug_idx             on public.sellers (slug);
create index if not exists sellers_user_idx             on public.sellers (user_id);
create index if not exists sellers_status_idx           on public.sellers (status);
create index if not exists seller_payouts_seller_idx    on public.seller_payouts (seller_id, created_at desc);

create index if not exists orders_no_idx                on public.orders (order_no);
create index if not exists orders_user_idx              on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx            on public.orders (status, created_at desc);
create index if not exists orders_phone_idx             on public.orders (customer_phone);
create index if not exists orders_created_idx           on public.orders (created_at desc);
create index if not exists orders_payment_status_idx    on public.orders (payment_status) where payment_status <> 'paid';

create index if not exists order_items_order_idx        on public.order_items (order_id);
create index if not exists order_items_product_idx      on public.order_items (product_id);
create index if not exists order_items_seller_idx       on public.order_items (seller_id);
create index if not exists order_items_sub_order_idx    on public.order_items (sub_order_id);
create index if not exists sub_orders_order_idx         on public.sub_orders (order_id);
create index if not exists sub_orders_seller_idx        on public.sub_orders (seller_id, created_at desc);
create index if not exists sub_orders_status_idx        on public.sub_orders (status);


create index if not exists parcels_order_idx            on public.parcels (order_id);
create index if not exists parcels_token_idx            on public.parcels (qr_token);
create index if not exists cart_items_user_idx          on public.cart_items (user_id);
create index if not exists custom_combos_user_idx       on public.custom_combos (user_id, created_at desc);

create index if not exists combos_slug_idx              on public.combos (slug);
create index if not exists combo_items_combo_idx        on public.combo_items (combo_id, sort_order);
create index if not exists subscription_plans_slug_idx  on public.subscription_plans (slug);
create index if not exists subscriptions_user_idx       on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_idx     on public.subscriptions (status);

create index if not exists coupons_code_idx             on public.coupons (upper(code));
create index if not exists delivery_charges_district_idx on public.delivery_charges (district);

create index if not exists plans_slug_idx               on public.plans (slug);
create index if not exists plans_active_idx             on public.plans (is_active, sort_order);
create index if not exists user_subs_user_idx           on public.user_subscriptions (user_id, status);
create index if not exists user_subs_status_idx         on public.user_subscriptions (status, expires_at);
create index if not exists access_codes_status_idx      on public.access_codes (status, created_at desc);
create index if not exists access_codes_user_idx        on public.access_codes (user_id);
create index if not exists trials_expiry_idx            on public.trials (expires_at);
create index if not exists stream_tokens_camera_idx     on public.stream_tokens (camera_id, expires_at);
create index if not exists premium_devices_user_idx     on public.premium_devices (user_id);

create index if not exists reviews_product_idx          on public.reviews (product_id, status, created_at desc);
create index if not exists reviews_user_idx             on public.reviews (user_id, created_at desc);
create index if not exists reviews_seller_idx           on public.reviews (seller_id, status);
create index if not exists reviews_order_idx            on public.reviews (order_id);
create index if not exists review_photos_review_idx     on public.review_photos (review_id, sort_order);

create index if not exists complaints_user_idx          on public.complaints (user_id, created_at desc);
create index if not exists complaints_status_idx        on public.complaints (status, created_at desc);
create index if not exists complaints_seller_idx        on public.complaints (seller_id);
create index if not exists complaint_messages_idx       on public.complaint_messages (complaint_id, created_at);

create index if not exists notifications_user_idx       on public.notifications (user_id, is_read, created_at desc);
create index if not exists push_subs_user_idx           on public.push_subscriptions (user_id);
create index if not exists wishlist_user_idx            on public.wishlist (user_id, created_at desc);
create index if not exists recently_viewed_user_idx     on public.recently_viewed (user_id, viewed_at desc);

create index if not exists hero_slides_order_idx        on public.hero_slides (sort_order) where is_active;
create index if not exists homepage_sections_order_idx  on public.homepage_sections (sort_order);
create index if not exists banners_placement_idx        on public.banners (placement, sort_order) where is_active;
create index if not exists menu_items_menu_idx          on public.menu_items (menu_id, sort_order);
create index if not exists blog_posts_slug_idx          on public.blog_posts (slug);
create index if not exists blog_posts_published_idx     on public.blog_posts (is_active, published_at desc);
create index if not exists faq_items_group_idx          on public.faq_items (group_bn, sort_order) where is_active;

create index if not exists audit_log_created_idx        on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx          on public.audit_log (actor_id);
create index if not exists audit_log_entity_idx         on public.audit_log (entity, entity_id);
create index if not exists login_attempts_email_idx     on public.login_attempts (email, created_at desc);
create index if not exists media_assets_bucket_idx      on public.media_assets (bucket, created_at desc);

-- ---------------------------------------------------------------------------
-- Public-safe views
-- ---------------------------------------------------------------------------

-- Seller storefront data. NEVER exposes nid, payout_number, bank_*.
create or replace view public.public_sellers
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

-- Cameras without stream secrets.
create or replace view public.public_cameras
with (security_invoker = false) as
select
  c.id,
  c.farm_id,
  c.name_bn,
  c.zone_bn,
  c.protocol,
  c.poster,
  c.status,
  c.is_active,
  c.is_premium,
  c.max_viewers,
  c.sort_order,
  c.last_heartbeat,
  f.slug      as farm_slug,
  f.name_bn   as farm_name_bn,
  f.district  as farm_district
from public.cameras c
join public.farms f on f.id = c.farm_id
where c.is_active and f.is_active;

-- Staff directory for /foisal/team. Service role only (see grants below).
create or replace view public.v_team_members
with (security_invoker = false) as
select
  p.id          as member_id,
  p.id          as user_id,
  coalesce(p.full_name, p.email, 'নামহীন') as full_name,
  p.email,
  p.phone,
  p.avatar_url  as photo,
  p.role,
  p.is_active,
  p.last_login_at,
  p.created_at,
  (select tm.id from public.team_members tm where tm.user_id = p.id limit 1) as public_member_id
from public.profiles p
where p.role in ('admin', 'manager', 'staff');

-- ---------------------------------------------------------------------------
-- Reporting views (server-side reads)
-- ---------------------------------------------------------------------------
create or replace view public.v_product_rating_breakdown
with (security_invoker = false) as
select
  r.product_id,
  count(*)::int                                            as total,
  count(*) filter (where r.rating >= 4.5)::int              as r5,
  count(*) filter (where r.rating >= 3.5 and r.rating < 4.5)::int as r4,
  count(*) filter (where r.rating >= 2.5 and r.rating < 3.5)::int as r3,
  count(*) filter (where r.rating >= 1.5 and r.rating < 2.5)::int as r2,
  count(*) filter (where r.rating < 1.5)::int               as r1,
  coalesce(round(avg(r.rating)::numeric, 1), 0)             as avg_rating
from public.reviews r
where r.status = 'published' and r.product_id is not null
group by r.product_id;

create or replace view public.v_product_supplier
with (security_invoker = false) as
select
  p.id                   as product_id,
  s.id                   as seller_id,
  s.slug                 as seller_slug,
  s.name_bn              as seller_name_bn,
  f.id                   as farm_id,
  f.slug                 as farm_slug,
  f.name_bn              as farm_name_bn,
  coalesce(f.cover, (f.images)[1]) as farm_photo,
  f.owner_bio_bn         as farm_bio_bn,
  f.description_bn       as farm_description_bn,
  f.cover                as farm_cover,
  f.images               as farm_images,
  coalesce(f.division, s.division) as division,
  coalesce(f.district, s.district) as district,
  f.upazila              as farm_upazila,
  f.address_bn           as farm_address_bn,
  f.lat                  as farm_lat,
  f.lng                  as farm_lng,
  f.established_year,
  f.certifications,
  (select count(*)::int from public.products pp where pp.seller_id = p.seller_id and pp.is_active) as product_count,
  (select count(*)::int from public.cameras c where c.farm_id = p.farm_id and c.is_active) as camera_count
from public.products p
left join public.sellers s on s.id = p.seller_id
left join public.farms f on f.id = coalesce(p.farm_id, s.farm_id);

create or replace view public.v_supplier_quality
with (security_invoker = false) as
with review_stats as (
  select seller_id,
         count(*)::int                                        as review_count,
         coalesce(round(avg(rating)::numeric, 2), 0)          as avg_rating,
         coalesce(round(avg(seller_rating)::numeric, 2), 0)   as avg_seller_rating,
         count(*) filter (where rating <= 2)::int             as low_rating_count
    from public.reviews
   where seller_id is not null and status = 'published'
   group by seller_id
),
complaint_stats as (
  select seller_id,
         count(*)::int                                        as complaint_count,
         count(*) filter (where status = 'resolved')::int     as resolved_count
    from public.complaints
   where seller_id is not null
   group by seller_id
),
order_stats as (
  select seller_id,
         count(*)::int                                        as sub_order_count,
         count(*) filter (where status = 'delivered')::int    as delivered_count
    from public.sub_orders
   where seller_id is not null
   group by seller_id
)
select
  s.id      as seller_id,
  s.slug,
  s.name_bn,
  s.status,
  coalesce(r.review_count, 0)                                  as review_count,
  coalesce(r.avg_rating, 0)                                    as avg_rating,
  coalesce(r.avg_seller_rating, 0)                             as avg_seller_rating,
  coalesce(r.low_rating_count, 0)                              as low_rating_count,
  coalesce(c.complaint_count, 0)                               as complaint_count,
  coalesce(c.resolved_count, 0)                                as resolved_count,
  coalesce(o.sub_order_count, 0)                               as sub_order_count,
  coalesce(o.delivered_count, 0)                               as delivered_count,
  case when coalesce(o.sub_order_count, 0) = 0 then 0
       else round(coalesce(c.complaint_count, 0)::numeric / o.sub_order_count, 4) end as complaint_rate,
  case when coalesce(o.sub_order_count, 0) = 0 then 1
       else round(coalesce(o.delivered_count, 0)::numeric / o.sub_order_count, 4) end as on_time_rate,
  round(
    coalesce(r.avg_rating, 0) * 12
    + (100 * (1 - least(1, case when coalesce(o.sub_order_count, 0) = 0 then 0
                                else coalesce(c.complaint_count, 0)::numeric / o.sub_order_count end))) * 0.4
    + least(20, coalesce(o.delivered_count, 0))
  , 2)                                                          as quality_score
from public.sellers s
left join review_stats r    on r.seller_id = s.id
left join complaint_stats c on c.seller_id = s.id
left join order_stats o     on o.seller_id = s.id;

create or replace view public.v_farm_stats
with (security_invoker = false) as
select
  f.id as farm_id,
  count(distinct c.id)::int                                   as camera_count,
  count(distinct c.id) filter (where c.status = 'online')::int as online_cameras,
  (select count(*)::int from public.products p where p.farm_id = f.id and p.is_active) as product_count
from public.farms f
left join public.cameras c on c.farm_id = f.id and c.is_active
group by f.id;

create or replace view public.v_premium_revenue
with (security_invoker = false) as
select
  date_trunc('month', us.created_at)::date                    as month,
  us.plan_name_bn,
  count(*)::int                                               as subscriptions,
  coalesce(sum(us.amount), 0)                                 as revenue
from public.user_subscriptions us
where us.status in ('active', 'grace', 'expired')
group by 1, 2;

create or replace view public.v_seller_leaderboard
with (security_invoker = false) as
select
  s.id as seller_id,
  s.slug,
  s.name_bn,
  count(so.id)::int                                           as orders,
  coalesce(sum(so.subtotal), 0)                               as gross,
  coalesce(sum(so.commission), 0)                             as commission,
  coalesce(sum(so.seller_earning), 0)                         as earnings
from public.sellers s
left join public.sub_orders so on so.seller_id = s.id
where s.status = 'approved'
group by s.id, s.slug, s.name_bn;

-- ---------------------------------------------------------------------------
-- View grants. Views owned by the migration role bypass RLS, so the public
-- ones expose only safe columns and the private ones are service-role only.
-- ---------------------------------------------------------------------------
grant select on public.public_sellers, public.public_cameras to anon, authenticated;

revoke all on public.v_team_members           from anon, authenticated;
revoke all on public.v_premium_revenue        from anon, authenticated;
revoke all on public.v_seller_leaderboard     from anon, authenticated;
grant select on public.v_team_members, public.v_product_rating_breakdown,
                public.v_supplier_quality, public.v_product_supplier,
                public.v_farm_stats, public.v_premium_revenue,
                public.v_seller_leaderboard
  to authenticated, service_role;
