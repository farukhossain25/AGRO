-- 0012_login_help.sql
-- ---------------------------------------------------------------------------
-- "Why can't I sign in?" — a private, service-role-only helper.
--
-- Supabase answers a wrong password, an unknown address and an account that was
-- created with Google with the same generic error ('Invalid login credentials').
-- That is the right thing to tell an attacker, but it is useless to the shop
-- owner whose own login just failed.
--
-- So the login form, *after* a failed attempt only, asks our own API route for
-- a one-line explanation. That route calls this function with the service key;
-- the helper is revoked from anon/authenticated, so a browser can never read
-- auth.users. Nothing secret is returned: whether the address exists, whether
-- it has a password, and which providers it uses.
-- ---------------------------------------------------------------------------

create or replace function public.login_help(p_email text)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'exists', true,
    'has_password', coalesce(nullif(u.encrypted_password, ''), '') <> '',
    'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'unconfirmed', u.email_confirmed_at is null
  )
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

comment on function public.login_help(text) is
  'Service-role only. Explains a failed sign-in (exists / has-password / providers / unconfirmed).';

revoke all on function public.login_help(text) from public;
revoke all on function public.login_help(text) from anon;
revoke all on function public.login_help(text) from authenticated;
grant execute on function public.login_help(text) to service_role;
