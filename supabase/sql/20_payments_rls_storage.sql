-- ============================================================================
-- 20_payments_rls_storage.sql
-- ============================================================================
-- WHAT IT DOES
--   Sets up RLS policies on payment_methods, payments, payment_logs,
--   payment_settings, creates public_payment_methods view, ensures
--   payment-logos and payment-proofs buckets exist, and adds payments to
--   supabase_realtime publication.
--
-- WHEN TO RUN
--   After 19_payments_functions.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.payment_logs enable row level security;
alter table public.payment_settings enable row level security;

-- payment_methods: public reads active methods; admin manages all
drop policy if exists "payment_methods_public_read" on public.payment_methods;
create policy "payment_methods_public_read" on public.payment_methods
  for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "payment_methods_admin_all" on public.payment_methods;
create policy "payment_methods_admin_all" on public.payment_methods
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Safe public view
create or replace view public.public_payment_methods as
  select id, provider, display_name, display_name_bn, logo_path,
         receiving_number, account_type, account_name, bank_name, branch,
         account_number, instructions_bn, instructions_en,
         min_amount, max_amount, fee_percent,
         requires_trx_id, requires_sender_number, requires_screenshot,
         trx_id_pattern, show_on_checkout, show_on_premium, sort_order
    from public.payment_methods
   where is_active = true
   order by sort_order asc;

-- payments: customers read own; admin full access
drop policy if exists "payments_own_read" on public.payments;
create policy "payments_own_read" on public.payments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- payment_logs: admin only
drop policy if exists "payment_logs_admin_all" on public.payment_logs;
create policy "payment_logs_admin_all" on public.payment_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- payment_settings: public read safe fields, admin full access
drop policy if exists "payment_settings_public_read" on public.payment_settings;
create policy "payment_settings_public_read" on public.payment_settings
  for select to anon, authenticated
  using (true);

drop policy if exists "payment_settings_admin_all" on public.payment_settings;
create policy "payment_settings_admin_all" on public.payment_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Storage buckets: payment-logos (public) & payment-proofs (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-logos',  'payment-logos',  true,  2097152, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('payment-proofs', 'payment-proofs', false, 6291456, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_logos_public_read" on storage.objects;
create policy "payment_logos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'payment-logos');

drop policy if exists "payment_logos_admin_write" on storage.objects;
create policy "payment_logos_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'payment-logos' and public.is_admin())
  with check (bucket_id = 'payment-logos' and public.is_admin());

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

-- Enable Realtime on payments
do $$
begin
  alter publication supabase_realtime add table public.payments;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
