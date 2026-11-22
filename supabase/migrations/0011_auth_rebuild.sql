-- ===========================================================================
-- 0011_auth_rebuild.sql — standard Supabase Auth (no custom JWT)
-- ---------------------------------------------------------------------------
-- Applied to project izemauiuyqcdawijoloh on 2026-11-22.
--
--   profiles.id = auth.users.id   (1:1, no legacy users indirection)
--   trigger on auth.users insert  → creates the profile, never fails signup
--   backfill for pre-existing auth users
--   RLS: own row only; role can only be changed by an admin
--   storage bucket "avatars": public read, write inside your own folder only
--   foysaliqbal09@gmail.com → role = admin
--
-- Idempotent: safe to run twice.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — create if missing, then add any missing column
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade
);

alter table public.profiles add column if not exists full_name text default '';
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists email text default '';
alter table public.profiles add column if not exists avatar_url text default '';
alter table public.profiles add column if not exists bio text default '';
alter table public.profiles add column if not exists role text default 'customer';
alter table public.profiles add column if not exists language text default 'bn';
alter table public.profiles add column if not exists theme text default 'dark';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- role whitelist. 'staff' / 'manager' are kept because the admin panel's team
-- screen (permissions.ts) uses them; everything else in the app treats them as
-- non-admin. 'premium' and 'seller' are the public tiers.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('customer', 'premium', 'seller', 'staff', 'manager', 'admin'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. trigger: create the profile row for every new auth user
--    security definer + fixed search_path + exception guard ⇒ a failure here
--    can never roll back the signup itself.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, role, language, theme)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'গ্রাহক'
    ),
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      ''
    ),
    'customer',
    'bn',
    'dark'
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- Never break a signup because the profile copy failed.
    raise warning 'handle_new_user(%): %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. backfill: every existing auth user gets a profile
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, email, avatar_url, role)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'গ্রাহক'
  ),
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', ''),
  'customer'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Existing accounts must be able to log in right now.
update auth.users set email_confirmed_at = now()
where email_confirmed_at is null;

-- ---------------------------------------------------------------------------
-- 4. RLS — own row only; admin (is_admin()) may read/write everything
--    The role column itself is protected by guard_profile_role() (0008),
--    which raises for any non-admin change.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_insert on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- anon must never read profiles (no policy ⇒ no access with RLS enabled)
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 5. avatars storage bucket — public read, write inside your own folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 6. foysaliqbal09@gmail.com → admin (creates the auth user if it is missing)
--    No password is set here: if the account has none, use "পাসওয়ার্ড ভুলে
--    গেছি" on /login (or Authentication → Users → Reset password in Supabase).
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = 'foysaliqbal09@gmail.com' limit 1;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'foysaliqbal09@gmail.com', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Foysal Iqbal"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), admin_id::text, admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'foysaliqbal09@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (admin_id, 'Foysal Iqbal', 'foysaliqbal09@gmail.com', 'admin')
  on conflict (id) do update set role = 'admin';

  raise notice 'admin profile ready: %', admin_id;
end $$;
