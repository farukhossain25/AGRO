-- 0018_rls_hardening_and_payments.sql
--
-- Part C of the audit: make Postgres the security boundary.
--
-- Before this migration 30+ tables in `public` had RLS switched OFF. With the
-- anon key (which is public by design, it ships in the browser bundle) anyone
-- could insert/update/delete rows in products, categories, payment_methods,
-- hero_slides, homepage_sections, settings … The admin panel never relied on
-- that, but nothing stopped it either.
--
-- This migration:
--   1. seeds the three payment methods so checkout can offer bKash/Nagad/COD
--   2. takes every write privilege away from `anon`
--   3. turns RLS on everywhere it was off, with explicit policies:
--        public read  → published/active content only
--        admin all    → is_admin() (SECURITY DEFINER, reads profiles.role)
--        own row      → auth.uid() = user_id
--   4. gives the storage buckets real policies (public read for public assets,
--      admin-only write, payment proofs private to their owner)

/* ============================================================ 1. payments */
insert into public.payment_methods
  (code, name_bn, name_en, kind, account_type, account_number, account_name, instruction_bn, min_amount, requires_trx, requires_sender, is_active, sort_order)
values
  ('bkash', 'বিকাশ', 'bKash', 'mfs', 'personal',
   '01700000000', 'বিশ্বাস এগ্রো',
   'বিকাশ অ্যাপ থেকে "সেন্ড মানি" করুন উপরের নম্বরে, তারপর ট্রানজেকশন আইডি (TrxID) লিখে দিন।',
   1, true, true, true, 1),
  ('nagad', 'নগদ', 'Nagad', 'mfs', 'personal',
   '01700000000', 'বিশ্বাস এগ্রো',
   'নগদ অ্যাপ থেকে "সেন্ড মানি" করুন উপরের নম্বরে, তারপর ট্রানজেকশন আইডি লিখে দিন।',
   1, true, true, true, 2),
  ('cod', 'ক্যাশ অন ডেলিভারি', 'Cash on delivery', 'cod', null, null, null,
   'পণ্য হাতে পেয়ে টাকা দিন। অগ্রিম কিছু লাগবে না।',
   1, false, false, true, 3)
on conflict (code) do nothing;

/* ================================================== 2. anon writes are gone */
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke usage, select on all sequences in schema public from anon;
alter default privileges in schema public revoke insert, update, delete on tables from anon;

/* ============================================================ 3. RLS + RLS */
alter table public.notifications      enable row level security;
alter table public.order_items        enable row level security;
alter table public.payments           enable row level security;
alter table public.sub_orders         enable row level security;
alter table public.parcels            enable row level security;
alter table public.sellers            enable row level security;
alter table public.settings           enable row level security;
alter table public.wishlists          enable row level security;
alter table public.banners            enable row level security;
alter table public.cameras            enable row level security;
alter table public.combos             enable row level security;
alter table public.farmers            enable row level security;
alter table public.packages           enable row level security;
alter table public.hero_slides        enable row level security;
alter table public.homepage_sections  enable row level security;
alter table public.delivery_zones     enable row level security;
alter table public.payment_methods    enable row level security;
alter table public.social_links       enable row level security;
alter table public.faq_items          enable row level security;
alter table public.media_assets       enable row level security;
alter table public.contact_messages   enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.recently_viewed    enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.fcm_tokens         enable row level security;
alter table public.seller_applications enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.payouts            enable row level security;
alter table public.coupons            enable row level security;
alter table public.audit_logs         enable row level security;

/* ---- public read on published content (anon + authenticated) ------------ */
do $$
declare t text;
begin
  foreach t in array array[
    'banners','cameras','combos','farmers','packages','hero_slides','homepage_sections',
    'delivery_zones','social_links','faq_items','media_assets','coupons'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end $$;

/* payment methods: only active ones are public */
drop policy if exists payment_methods_public_read on public.payment_methods;
create policy payment_methods_public_read on public.payment_methods
  for select to anon, authenticated using (is_active = true);

/* ---- admin full control (is_admin() is SECURITY DEFINER over profiles) --- */
do $$
declare t text;
begin
  foreach t in array array[
    'banners','cameras','combos','farmers','packages','hero_slides','homepage_sections',
    'delivery_zones','payment_methods','social_links','faq_items','media_assets','coupons',
    'settings','sellers','seller_applications','subscriptions','payouts','contact_messages',
    'newsletter_subscribers','parcels','order_items','payments','notifications','sub_orders'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_admin_all', t);
  end loop;
end $$;

/* orders / products / categories / reviews already have admin policies; make
   sure an admin can also insert and delete an order (needed by the panel). */
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated with check (is_admin());

/* ---- own rows ------------------------------------------------------------ */
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
    or seller_id = auth.uid()
    or is_admin()
  );

drop policy if exists sub_orders_seller_update on public.sub_orders;
create policy sub_orders_seller_update on public.sub_orders for update to authenticated
  using (seller_id = auth.uid() or is_admin()) with check (seller_id = auth.uid() or is_admin());

drop policy if exists wishlists_own on public.wishlists;
create policy wishlists_own on public.wishlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists recently_viewed_own on public.recently_viewed;
create policy recently_viewed_own on public.recently_viewed for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists fcm_tokens_own on public.fcm_tokens;
create policy fcm_tokens_own on public.fcm_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sellers_public_read on public.sellers;
create policy sellers_public_read on public.sellers for select to anon, authenticated using (true);

drop policy if exists parcels_read_own on public.parcels;
create policy parcels_read_own on public.parcels for select to authenticated
  using (exists (select 1 from public.orders o where o.id = parcels.order_id and o.user_id = auth.uid()) or is_admin());

/* ================================================ 4. storage bucket policies */
do $$
declare
  b text;
  pub boolean;
begin
  foreach b in array array['product-images','Product-images','review-photos','complaint-photos','catalog-media','Fram-images'] loop
    execute format('update storage.buckets set public = true where id = %L', b);
    execute format('drop policy if exists %I on storage.objects', b || '_public_read');
    execute format('create policy %I on storage.objects for select using (bucket_id = %L)', b || '_public_read', b);
    execute format('drop policy if exists %I on storage.objects', b || '_admin_write');
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and is_admin())', b || '_admin_write', b);
    execute format('drop policy if exists %I on storage.objects', b || '_admin_update');
    execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and is_admin())', b || '_admin_update', b);
    execute format('drop policy if exists %I on storage.objects', b || '_admin_delete');
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and is_admin())', b || '_admin_delete', b);
  end loop;
end $$;

/* payment proofs are private: the owner (path starts with their uid) and admin */
update storage.buckets set public = false where id = 'payment-proofs';

drop policy if exists payment_proofs_owner_read on storage.objects;
create policy payment_proofs_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text));

drop policy if exists payment_proofs_owner_write on storage.objects;
create policy payment_proofs_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists payment_proofs_admin_all on storage.objects;
create policy payment_proofs_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'payment-proofs' and is_admin()) with check (bucket_id = 'payment-proofs' and is_admin());
