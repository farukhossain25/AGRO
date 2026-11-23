-- ============================================================================
-- 08_rls_policies.sql
-- ============================================================================
-- WHAT IT DOES
--   Turns on Row Level Security for EVERY table in the app schema and writes
--   explicit policies:
--     • visitors (anon)  → only published / active rows of public content
--     • customers        → only their own rows (addresses, cart, orders, …)
--     • sellers          → only their own products, sub-orders and payouts
--     • admins           → full access through is_admin()
--     • private data (payment screenshots, seller NID/bank, stream keys,
--       audit log, settings, trials) is never readable by visitors
--
-- WHEN TO RUN
--   Eighth, after 07_functions_and_triggers.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — every policy is dropped before it is recreated.
-- ============================================================================

-- Helper: avoids a recursive policy lookup when a products policy needs to know
-- whether the current user owns the seller row.
create or replace function public.is_my_seller(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sellers s
     where s.id = p_seller and s.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Enable RLS everywhere (idempotent).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles','addresses','site_settings','social_links','team_members','static_pages',
    'audit_log','login_attempts','contact_messages','newsletter_subscribers','media_assets','seo_meta',
    'categories','farms','cameras','sellers','seller_payouts','seller_warnings','camera_requests',
    'camera_view_logs','products','product_images','coupons','delivery_charges',
    'combos','combo_items','subscription_plans','subscriptions','cart_items','orders','order_items',
    'sub_orders','payment_methods','payments','payment_logs','parcels','custom_combos',
    'plans','user_subscriptions','access_codes','trials','stream_tokens','premium_devices',
    'reviews','review_photos','review_tags','complaints','complaint_messages','notifications',
    'push_subscriptions','fcm_tokens','wishlist','recently_viewed',
    'hero_slides','homepage_sections','banners','menus','menu_items','blog_posts','faq_items'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Public content (read-only for visitors)
-- ---------------------------------------------------------------------------
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active farms" on public.farms;
create policy "public read active farms" on public.farms
  for select to anon, authenticated using (is_active);

drop policy if exists "public read published products" on public.products;
create policy "public read published products" on public.products
  for select to anon, authenticated using (is_active and approval_status = 'approved');

drop policy if exists "public read product images" on public.product_images;
create policy "public read product images" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p
             where p.id = product_id and p.is_active and p.approval_status = 'approved')
  );

drop policy if exists "public read active combos" on public.combos;
create policy "public read active combos" on public.combos
  for select to anon, authenticated using (is_active);

drop policy if exists "public read combo items" on public.combo_items;
create policy "public read combo items" on public.combo_items
  for select to anon, authenticated using (
    exists (select 1 from public.combos c where c.id = combo_id and c.is_active)
  );

drop policy if exists "public read active subscription plans" on public.subscription_plans;
create policy "public read active subscription plans" on public.subscription_plans
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active premium plans" on public.plans;
create policy "public read active premium plans" on public.plans
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active delivery charges" on public.delivery_charges;
create policy "public read active delivery charges" on public.delivery_charges
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active payment methods" on public.payment_methods;
create policy "public read active payment methods" on public.payment_methods
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active social links" on public.social_links;
create policy "public read active social links" on public.social_links
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active team members" on public.team_members;
create policy "public read active team members" on public.team_members
  for select to anon, authenticated using (is_active);

drop policy if exists "public read published pages" on public.static_pages;
create policy "public read published pages" on public.static_pages
  for select to anon, authenticated using (is_published);

drop policy if exists "public read seo overrides" on public.seo_meta;
create policy "public read seo overrides" on public.seo_meta
  for select to anon, authenticated using (true);

drop policy if exists "public read hero slides" on public.hero_slides;
create policy "public read hero slides" on public.hero_slides
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "public read homepage sections" on public.homepage_sections;
create policy "public read homepage sections" on public.homepage_sections
  for select to anon, authenticated using (true);

drop policy if exists "public read banners" on public.banners;
create policy "public read banners" on public.banners
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "public read active menus" on public.menus;
create policy "public read active menus" on public.menus
  for select to anon, authenticated using (is_active);

drop policy if exists "public read active menu items" on public.menu_items;
create policy "public read active menu items" on public.menu_items
  for select to anon, authenticated using (is_active);

drop policy if exists "public read blog posts" on public.blog_posts;
create policy "public read blog posts" on public.blog_posts
  for select to anon, authenticated using (is_active);

drop policy if exists "public read faq" on public.faq_items;
create policy "public read faq" on public.faq_items
  for select to anon, authenticated using (is_active);

drop policy if exists "public read review tags" on public.review_tags;
create policy "public read review tags" on public.review_tags
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Reviews & complaints
-- ---------------------------------------------------------------------------
drop policy if exists "public read published reviews" on public.reviews;
create policy "public read published reviews" on public.reviews
  for select to anon, authenticated using (status = 'published');

drop policy if exists "customers write own reviews" on public.reviews;
create policy "customers write own reviews" on public.reviews
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "customers edit own reviews" on public.reviews;
create policy "customers edit own reviews" on public.reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "public read review photos" on public.review_photos;
create policy "public read review photos" on public.review_photos
  for select to anon, authenticated using (
    exists (select 1 from public.reviews r where r.id = review_id and r.status = 'published')
  );

drop policy if exists "customers add own review photos" on public.review_photos;
create policy "customers add own review photos" on public.review_photos
  for insert to authenticated with check (
    exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid())
  );

drop policy if exists "customers read own complaints" on public.complaints;
create policy "customers read own complaints" on public.complaints
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "customers file complaints" on public.complaints;
create policy "customers file complaints" on public.complaints
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "customers read own complaint messages" on public.complaint_messages;
create policy "customers read own complaint messages" on public.complaint_messages
  for select to authenticated using (
    not is_internal
    and exists (select 1 from public.complaints c where c.id = complaint_id and c.user_id = auth.uid())
  );

drop policy if exists "customers reply to own complaints" on public.complaint_messages;
create policy "customers reply to own complaints" on public.complaint_messages
  for insert to authenticated with check (
    author_id = auth.uid()
    and not is_internal
    and exists (select 1 from public.complaints c where c.id = complaint_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Profiles, addresses, cart, wishlist, notifications
-- ---------------------------------------------------------------------------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "own addresses" on public.addresses;
drop policy if exists "read own addresses" on public.addresses;
create policy "read own addresses" on public.addresses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "insert own addresses" on public.addresses;
create policy "insert own addresses" on public.addresses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own addresses" on public.addresses;
create policy "update own addresses" on public.addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own addresses" on public.addresses;
create policy "delete own addresses" on public.addresses
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "own cart" on public.cart_items;
create policy "own cart" on public.cart_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own wishlist" on public.wishlist;
create policy "own wishlist" on public.wishlist
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own recently viewed" on public.recently_viewed;
create policy "own recently viewed" on public.recently_viewed
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own custom combos" on public.custom_combos;
create policy "own custom combos" on public.custom_combos
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own fcm tokens" on public.fcm_tokens;
create policy "own fcm tokens" on public.fcm_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own media assets" on public.media_assets;
create policy "own media assets" on public.media_assets
  for select to authenticated using (uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Orders & payments (read-only for the owner; writes go through RPC/server)
-- ---------------------------------------------------------------------------
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    or public.is_my_seller(seller_id)
  );

drop policy if exists "read own sub orders" on public.sub_orders;
create policy "read own sub orders" on public.sub_orders
  for select to authenticated using (
    public.is_my_seller(seller_id)
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own payment logs" on public.payment_logs;
create policy "read own payment logs" on public.payment_logs
  for select to authenticated using (
    exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid())
  );

drop policy if exists "read own parcels" on public.parcels;
create policy "read own parcels" on public.parcels
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own premium subscriptions" on public.user_subscriptions;
create policy "read own premium subscriptions" on public.user_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own access codes" on public.access_codes;
create policy "read own access codes" on public.access_codes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own premium devices" on public.premium_devices;
create policy "own premium devices" on public.premium_devices
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Sellers (own rows only — visitors use the public_sellers view)
-- ---------------------------------------------------------------------------
drop policy if exists "read own seller row" on public.sellers;
create policy "read own seller row" on public.sellers
  for select to authenticated using (user_id = auth.uid());

-- Sellers only see cameras that belong to their own farm. Visitors never read
-- this table at all (they use the public_cameras view in file 10).
drop policy if exists "seller reads cameras of own farm" on public.cameras;
create policy "seller reads cameras of own farm" on public.cameras
  for select to authenticated using (
    exists (
      select 1 from public.sellers s
       where s.user_id = auth.uid() and s.farm_id = cameras.farm_id
    )
  );

drop policy if exists "seller manages own products" on public.products;
drop policy if exists "seller reads own products" on public.products;
create policy "seller reads own products" on public.products
  for select to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "seller inserts own products" on public.products;
create policy "seller inserts own products" on public.products
  for insert to authenticated with check (public.is_my_seller(seller_id));

drop policy if exists "seller updates own products" on public.products;
create policy "seller updates own products" on public.products
  for update to authenticated using (public.is_my_seller(seller_id)) with check (public.is_my_seller(seller_id));

drop policy if exists "seller deletes own products" on public.products;
create policy "seller deletes own products" on public.products
  for delete to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "seller reads own payouts" on public.seller_payouts;
create policy "seller reads own payouts" on public.seller_payouts
  for select to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "seller reads own warnings" on public.seller_warnings;
create policy "seller reads own warnings" on public.seller_warnings
  for select to authenticated using (public.is_my_seller(seller_id));

drop policy if exists "read own camera requests" on public.camera_requests;
create policy "read own camera requests" on public.camera_requests
  for select to authenticated using (user_id = auth.uid() or public.is_my_seller(seller_id));

drop policy if exists "create own camera requests" on public.camera_requests;
create policy "create own camera requests" on public.camera_requests
  for insert to authenticated with check (user_id = auth.uid() or public.is_my_seller(seller_id));

-- ---------------------------------------------------------------------------
-- 7. Website contact forms (write-only for visitors, read for admins)
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can subscribe" on public.newsletter_subscribers;
create policy "anyone can subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

drop policy if exists "anyone can send a contact message" on public.contact_messages;
create policy "anyone can send a contact message" on public.contact_messages
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 8. Admin full access — generated policy per table.
--    is_admin() is SECURITY DEFINER, so this never recurses.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles','addresses','site_settings','social_links','team_members','static_pages',
    'audit_log','login_attempts','contact_messages','newsletter_subscribers','media_assets','seo_meta',
    'categories','farms','cameras','sellers','seller_payouts','seller_warnings','camera_requests',
    'camera_view_logs','products','product_images','coupons','delivery_charges',
    'combos','combo_items','subscription_plans','subscriptions','cart_items','orders','order_items',
    'sub_orders','payment_methods','payments','payment_logs','parcels','custom_combos',
    'plans','user_subscriptions','access_codes','trials','stream_tokens','premium_devices',
    'reviews','review_photos','review_tags','complaints','complaint_messages','notifications',
    'push_subscriptions','fcm_tokens','wishlist','recently_viewed',
    'hero_slides','homepage_sections','banners','menus','menu_items','blog_posts','faq_items'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "admin full access" on public.%I', t);
    execute format(
      'create policy "admin full access" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Grants. RLS still decides what a row-level policy allows.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- visitors may read the public content tables (policies restrict rows)
grant select on
  public.categories, public.farms, public.products, public.product_images,
  public.combos, public.combo_items, public.subscription_plans, public.plans,
  public.delivery_charges, public.payment_methods, public.social_links,
  public.team_members, public.static_pages, public.seo_meta, public.hero_slides,
  public.homepage_sections, public.banners, public.menus, public.menu_items,
  public.blog_posts, public.faq_items, public.reviews, public.review_photos,
  public.review_tags
  to anon;

grant insert on public.contact_messages, public.newsletter_subscribers to anon;

-- signed-in users: RLS decides, so a broad grant is safe and keeps admin
-- server routes simple.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Future tables created by this project inherit the same grants.
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
