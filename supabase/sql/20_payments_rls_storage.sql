-- ============================================================================
-- 20_payments_rls_storage.sql
-- ============================================================================
-- WHAT IT DOES
--   Re-asserts RLS on payment_methods and enables Realtime for it:
--     • anon / authenticated can READ active methods (checkout needs this),
--     • only admins can write (add / edit / delete receiving numbers),
--     • payment_methods is added to the supabase_realtime publication.
--
--   Logo storage: the admin panel uploads payment-method logos through
--   /api/foisal/media, which maps the virtual "payment-logos" bucket to the
--   physical `logos` bucket under a `payment-methods/` folder (see
--   app/api/foisal/media/route.ts). No separate bucket is created here —
--   the `logos` bucket already exists from 09_storage_buckets_and_policies.sql.
--
-- WHEN TO RUN
--   After 19_payments_functions.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

alter table public.payment_methods enable row level security;

-- payment_methods: public reads active methods; admin manages everything.
-- (Re-asserted here so the payment setup is self-contained — 08 also has it.)
drop policy if exists "payment_methods_public_read" on public.payment_methods;
create policy "payment_methods_public_read" on public.payment_methods
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "payment_methods_admin_all" on public.payment_methods;
create policy "payment_methods_admin_all" on public.payment_methods
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Enable Realtime on payment_methods (admin UI subscribes to live changes).
do $$
begin
  alter publication supabase_realtime add table public.payment_methods;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
