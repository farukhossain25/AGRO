-- ============================================================================
--  admin.sql — promote the administrator (run ONCE, by hand)
-- ----------------------------------------------------------------------------
--  The brief removes /api/seed-admin and the ADMIN_EMAIL / ADMIN_PASSWORD
--  variables: the admin is created in the Supabase dashboard and this file
--  promotes that account. Nothing here is a secret, and re-running is harmless.
--
--  WHY THIS IS SAFE
--  ----------------
--  * Creating the auth user fires `on_auth_user_created` (migration 0004),
--    which inserts the matching `users` row and a `profiles` row with
--    role = 'customer'. So a profile already exists by the time you run this.
--  * `profiles.role` is NOT writable by a signed-in customer: migration 0008
--    revoked the table-wide UPDATE grant and re-granted only
--    (full_name, phone, avatar_url, bio, language, theme, notifications,
--     onboarded, last_seen_at). A PATCH that includes "role" is rejected by
--    Postgres before RLS is even consulted.
--  * The `guard_profile_role` trigger raises if a non-admin tries to change a
--    role. This script runs as the SQL editor's owner role, where auth.uid()
--    is NULL, so the guard permits it — which is how a manual promotion is
--    meant to work.
--
--  STEP 1 — DO THIS FIRST, in the dashboard (not in SQL)
--    Authentication → Users → "Add user" → "Create new user"
--      Email:    foysaliqbal09@gmail.com
--      Password: a strong password you keep
--      ✅ Auto Confirm User      ← tick it, or login is refused as unverified
--
--  STEP 2 — Supabase → SQL Editor → New query → paste this file → Run
--
--  The script REFUSES to run quietly: if the account is missing or unconfirmed
--  it raises an exception naming exactly which step was skipped.
-- ============================================================================

do $$
declare
  v_email     text := lower('foysaliqbal09@gmail.com');   -- ← change if needed
  v_auth_id   uuid;
  v_confirmed boolean;
  v_legacy    uuid;
  v_name      text;
begin
  ---------------------------------------------------------------------------
  -- 1. Find the auth user. Missing → say so, do not create a half-account.
  ---------------------------------------------------------------------------
  select au.id,
         au.email_confirmed_at is not null,
         coalesce(au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1))
    into v_auth_id, v_confirmed, v_name
    from auth.users au
   where lower(au.email) = v_email
   limit 1;

  if v_auth_id is null then
    raise exception
      E'\n\nঅ্যাকাউন্ট পাওয়া যায়নি: %\nAccount not found: %\n\n'
      'আগে Supabase → Authentication → Users → "Add user" দিয়ে এই ইমেইলে\n'
      'ইউজার তৈরি করুন (Auto Confirm User টিক দিয়ে), তারপর এই ফাইল আবার চালান.\n\n'
      'Create the user in Authentication → Users first, tick "Auto Confirm User",\n'
      'then run this file again.',
      v_email, v_email;
  end if;

  if not v_confirmed then
    raise exception
      E'\n\n%s এর ইমেইল এখনো যাচাই হয়নি — প্যানেলে লগইন করতে দেবে না।\n'
      'Email for % is not confirmed; login will be refused.\n\n'
      'Authentication → Users → ওই ইউজার → "Confirm email" চাপুন, তারপর আবার চালান.',
      v_email, v_email;
  end if;

  ---------------------------------------------------------------------------
  -- 2. The app's own users row (older routes still read users.role).
  --    The trigger normally created it; create it if the account predates it.
  ---------------------------------------------------------------------------
  select u.id into v_legacy
    from public.users u
   where lower(u.email) = v_email
   limit 1;

  if v_legacy is null then
    insert into public.users (name, email, role)
    values (v_name, v_email, 'admin')
    returning id into v_legacy;
  else
    update public.users set role = 'admin' where id = v_legacy;
  end if;

  ---------------------------------------------------------------------------
  -- 3. The profile row — this is the value the whole app trusts.
  --    profiles.id is the Supabase auth id; legacy_user_id is users.id.
  ---------------------------------------------------------------------------
  insert into public.profiles (id, legacy_user_id, full_name, role)
  values (v_auth_id, v_legacy, v_name, 'admin')
  on conflict (id) do update
    set role           = 'admin',
        legacy_user_id = coalesce(public.profiles.legacy_user_id, excluded.legacy_user_id),
        full_name      = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at     = now();

  raise notice 'OK — % is now an admin (auth id %)', v_email, v_auth_id;
end $$;


-- ---------------------------------------------------------------------------
-- 4. VERIFY — must return one row with role = admin and email_confirmed = true
-- ---------------------------------------------------------------------------
select au.email,
       p.role,
       p.full_name,
       p.legacy_user_id,
       au.email_confirmed_at is not null as email_confirmed
  from public.profiles p
  join auth.users au on au.id = p.id
 where lower(au.email) = lower('foysaliqbal09@gmail.com');


-- ---------------------------------------------------------------------------
-- 5. PROOF that a customer cannot promote themselves — expect 9 rows and
--    "role" must NOT be among them.
-- ---------------------------------------------------------------------------
select grantee, column_name
  from information_schema.column_privileges
 where table_schema   = 'public'
   and table_name     = 'profiles'
   and privilege_type = 'UPDATE'
   and grantee        = 'authenticated'
 order by column_name;
