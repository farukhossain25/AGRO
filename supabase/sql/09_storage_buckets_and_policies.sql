-- ============================================================================
-- 09_storage_buckets_and_policies.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the eleven Storage buckets the app uploads to and the access rules
--   for each one:
--
--     PUBLIC (anyone can view a file, only admins/owners can write)
--       avatars, product-images, category-images, farm-images, logos,
--       slides, team, review-photos, complaint-photos, blog-images
--
--     PRIVATE (owner + admin only, served with short-lived signed URLs)
--       payment-proofs
--
--   Each bucket also enforces a file-size limit and an image-only MIME list,
--   so a 40 MB PDF cannot be uploaded by mistake.
--
-- WHEN TO RUN
--   Ninth, after 08_rls_policies.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--   Storage → Buckets in the dashboard shows all 11 buckets.
--
-- SAFE TO RUN TWICE
--   Yes — buckets are upserted on id and every policy is dropped first.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------
drop policy if exists "public image read" on storage.objects;
create policy "public image read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
  );

drop policy if exists "owners and admins upload images" on storage.objects;
create policy "owners and admins upload images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
    and (owner = auth.uid() or public.is_staff())
  );

drop policy if exists "owners and admins update images" on storage.objects;
create policy "owners and admins update images" on storage.objects
  for update to authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
    and (owner = auth.uid() or public.is_admin())
  );

drop policy if exists "owners and admins delete images" on storage.objects;
create policy "owners and admins delete images" on storage.objects
  for delete to authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'complaint-photos', 'blog-images'
    )
    and (owner = auth.uid() or public.is_admin())
  );

-- payment-proofs: uploader + admin can read; nobody anonymous
drop policy if exists "payment proof owner read" on storage.objects;
create policy "payment proof owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "payment proof owner upload" on storage.objects;
create policy "payment proof owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and owner = auth.uid());

drop policy if exists "payment proof admin manage" on storage.objects;
create policy "payment proof admin manage" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());
