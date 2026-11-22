-- ============================================================================
-- 0008 — Security hardening (section G)
-- ============================================================================
-- Run AFTER 0001 → 0007.
--
-- CRITICAL FIX
-- ------------
-- `users_update_own` and `profiles_update_own` are UPDATE policies whose only
-- condition is "this row is mine":
--
--     using (id = app_user_id())  /  with check (id = auth.uid())
--
-- Neither restricted WHICH COLUMNS may change, and PostgREST exposes every
-- column the role was granted. So a signed-in customer could issue
--
--     PATCH /rest/v1/users?id=eq.<their own id>   {"role":"admin"}
--
-- with nothing but the public anon key and their own session. That is a full
-- privilege escalation to the admin panel — order data, customer PII, payouts,
-- team management. The same hole existed on profiles.role.
--
-- Fix: revoke the blanket UPDATE and grant back only the columns a person may
-- legitimately edit about themselves. Role, is_active, premium_until,
-- password_hash, mfa_enrolled and created_at become non-writable for the
-- customer/anon roles. Service-role (the Next.js server) is unaffected.
--
-- Also in this migration:
--   • the same treatment for `addresses` (user_id was rewritable)
--   • money/fulfilment columns on `orders` locked down
--   • audit_logs made append-only for everyone but the service role
--   • is_staff() compared auth.uid() against the wrong table, so every staff
--     member was denied the CMS; fixed to read profiles like is_admin()
--   • review authors could publish/hide/verify their own review via the
--     moderation columns; those are now staff-only
--   • products/blog_posts were readable with completely unapproved rows
-- ============================================================================

/* ---------------------------------------------------------------- users ---- */
revoke update on public.users from anon, authenticated;

grant update (name, email, phone, avatar, locale) on public.users to authenticated;

/* A user may not re-point their row, promote themselves, reactivate a
   suspended account, or start/stop a premium subscription by hand. */
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update
  to authenticated
  using (id = app_user_id())
  with check (id = app_user_id());

/* ------------------------------------------------------------- profiles ---- */
revoke update on public.profiles from anon, authenticated;

grant update (full_name, phone, avatar_url, bio, language, theme, notifications, onboarded, last_seen_at)
  on public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

/* ------------------------------------------------------------ addresses ---- */
-- Deleting/creating an address is fine; changing whose address it is is not.
revoke update on public.addresses from anon, authenticated;
grant update (label, address, division, district, upazila, phone, is_default)
  on public.addresses to authenticated;
grant insert (user_id, label, address, division, district, upazila, phone, is_default)
  on public.addresses to authenticated;

/* --------------------------------------------------------------- orders ---- */
-- Customers never write orders directly (they go through /api/orders with the
-- service role). Only anon INSERT stays for the guest-checkout path that the
-- route performs on the user's behalf.
revoke update, delete on public.orders from anon, authenticated;
grant insert (order_no, user_id, customer_name, phone, email, division, district,
              upazila, address, delivery_note, subtotal, discount, delivery_fee,
              total, payment_method, payment_status, status, items_snapshot, coupon_code)
  on public.orders to authenticated;

/* ---------------------------------------------------------- audit_logs ----- */
-- Append-only: no client role may rewrite or erase history. Inserts happen
-- with the service role from lib/audit.ts, so no INSERT grant is needed here.
revoke update, delete on public.audit_logs from anon, authenticated;
revoke update, delete on public.audit_log from anon, authenticated;

/* ------------------------------------------------ sensitive tables: nothing */
-- These are server-only surfaces. RLS already returns no rows to a client
-- (no policy = deny), but the table-level grants are noise at best and a
-- foot-gun if a future policy is written carelessly. Revoke them outright.
revoke all on public.login_attempts        from anon, authenticated;
revoke all on public.otp_codes             from anon, authenticated;
revoke all on public.admin_mfa             from anon, authenticated;
revoke all on public.premium_access_codes  from anon, authenticated;
revoke all on public.stream_sessions       from anon, authenticated;
revoke all on public.seller_payouts        from anon, authenticated;
revoke all on public.contact_messages      from anon, authenticated;
revoke all on public.newsletter_subscribers from anon, authenticated;

/* --------------------------------------------------- storage hardening ---- */
-- Public read is fine for product imagery; only the service role may write.
-- (Bucket-level policies already do this; the grants below close the gap for
-- any bucket created later without policies.)
do $$
begin
  if exists (select 1 from storage.buckets where id = 'review-photos') then
    -- review photos are public-read so the product page can show them
    null;
  end if;
end $$;

/* ---------------------------------------- is_staff() was checking the wrong
   identity table. auth.uid() is profiles.id, but the 0007 version compared it
   to public.users.id — so every staff member failed the check and the CMS
   policies silently denied them. Align it with is_admin(). */
create or replace function public.is_staff()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('staff','manager','admin')
  );
$$;

/* ------------------------------------- review moderation fields must be
   staff-only. Without this, the author of a review could set status='published'
   on a hidden review, flip is_verified_purchase, or edit seller_rating. */
revoke update on public.order_reviews from anon, authenticated;
grant update (rating, title_bn, comment, photos, tags, edited_at)
  on public.order_reviews to authenticated;

/* ------------------------------------- catalogue reads were `true`, which
   exposed inactive and seller-unapproved rows (and their commission). */
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (is_active or public.is_staff());

drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select using (is_active or public.is_staff());

/* ----------------------- TRUNCATE / DELETE on identity tables: not needed by
   any client path (account deletion goes through the service role). Leaving the
   grant in place means one careless future policy = one trivially empty table. */
revoke truncate on public.users, public.profiles, public.orders from anon, authenticated;
revoke delete on public.users, public.profiles from anon, authenticated;

/* ------------------------------------------------- settings: read yes, write no */
revoke insert, update, delete on public.settings from anon, authenticated;

/* --------------------------------------------- verification helper view ---- */
-- Handy when auditing from the SQL editor: shows any column a client role can
-- still UPDATE on the identity tables.
create or replace view v_writable_identity_columns
with (security_invoker = false) as
select table_name, column_name, grantee
from information_schema.column_privileges
where table_schema = 'public'
  and privilege_type = 'UPDATE'
  and grantee in ('anon', 'authenticated')
  and table_name in ('users', 'profiles', 'addresses', 'orders')
order by table_name, column_name;

grant select on v_writable_identity_columns to authenticated;
