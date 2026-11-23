-- ============================================================================
-- 14_storage_fix.sql
-- ============================================================================
-- WHAT IT DOES
--   Fixes "Bucket not found" and storage permission errors by ensuring all 11
--   Supabase Storage buckets exist with proper public flags, size limits, and
--   MIME types, and sets up idempotent RLS policies on storage.objects:
--     • Public read for public buckets (logos, product-images, farm-images, etc.)
--     • Admin full manage via public.is_admin()
--     • Sellers can upload/update/delete in product-images/{seller_id}/... and
--       farm-images/{seller_id}/...
--     • Users can upload/update/delete their own avatars, review-photos,
--       complaint-photos, and private payment-proofs
--
-- WHEN TO RUN
--   After 13_verify_setup.sql (or anytime "Bucket not found" occurs).
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--   Storage → Buckets shows all 11 buckets, and Admin → System Check is green.
--
-- SAFE TO RUN TWICE
--   Yes — uses ON CONFLICT DO UPDATE and DROP POLICY IF EXISTS.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',          'avatars',          true,  3145728,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('product-images',   'product-images',   true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('category-images',  'category-images',  true,  3145728,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('farm-images',      'farm-images',      true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('logos',            'logos',            true,  2097152,  array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('slides',           'slides',           true,  8388608,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('team',             'team',             true,  3145728,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('review-photos',    'review-photos',    true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('complaint-photos', 'complaint-photos', true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('blog-images',      'blog-images',      true,  6291456,  array['image/jpeg','image/png','image/webp','image/avif']),
  ('payment-proofs',   'payment-proofs',   false, 6291456,  array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read for public buckets
drop policy if exists "public image read" on storage.objects;
create policy "public image read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
  );

-- Admin full access on all buckets
drop policy if exists "admin manage all storage" on storage.objects;
create policy "admin manage all storage" on storage.objects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Users manage their own avatars, review-photos, complaint-photos
drop policy if exists "users upload own public images" on storage.objects;
create policy "users upload own public images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'review-photos', 'complaint-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own public images" on storage.objects;
create policy "users update own public images" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'review-photos', 'complaint-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own public images" on storage.objects;
create policy "users delete own public images" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'review-photos', 'complaint-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Sellers manage their own product-images/{seller_id}/... and farm-images/{seller_id}/...
drop policy if exists "sellers manage own media" on storage.objects;
create policy "sellers manage own media" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('product-images', 'farm-images')
    and exists (
      select 1 from public.sellers s
      where s.user_id = auth.uid()
        and (storage.foldername(name))[1] = s.id::text
    )
  )
  with check (
    bucket_id in ('product-images', 'farm-images')
    and exists (
      select 1 from public.sellers s
      where s.user_id = auth.uid()
        and (storage.foldername(name))[1] = s.id::text
    )
  );

-- Payment proofs: owner + admin only
drop policy if exists "payment proof owner read" on storage.objects;
create policy "payment proof owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "payment proof owner upload" on storage.objects;
create policy "payment proof owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
