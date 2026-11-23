-- ============================================================================
-- 12_make_admin.sql
-- ============================================================================
-- WHAT IT DOES
--   Makes foysaliqbal09@gmail.com the first admin of this project:
--     • profiles.role = 'admin' (this is what the app checks)
--     • auth.users.raw_app_meta_data.role = 'admin' (kept in sync for RLS)
--
-- WHEN TO RUN
--   After 11_seed_sample_data.sql — and only AFTER the user exists.
--
--   FIRST create the account, once, in the dashboard:
--     1. Supabase Dashboard → Authentication → Users
--     2. "Add user" → Create new user
--        e-mail: foysaliqbal09@gmail.com
--        password: a strong password (16+ characters)
--        ☑ Auto Confirm User   ← important, otherwise login is blocked
--     3. "Create user"
--     4. Come back to SQL Editor, paste this file, Run.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   A small table: email | role | is_active | note
--   with role = admin. If the e-mail is not found you see
--   "NOT FOUND — create the user in Authentication → Users first".
--
-- SAFE TO RUN TWICE
--   Yes. It only ever promotes this one address.
--
-- TO ADD MORE ADMINS LATER
--   Either change the e-mail below, or use /foisal → টিম (Team) which invites
--   the person and sets their role from the panel.
-- ============================================================================

do $$
declare
  v_email text := 'foysaliqbal09@gmail.com';
  v_id uuid;
begin
  select id into v_id
    from auth.users
   where lower(email) = lower(v_email)
   order by created_at
   limit 1;

  if v_id is null then
    raise notice 'NOT FOUND: % is not registered yet. Authentication → Users → Add user, then run this file again.', v_email;
    return;
  end if;

  insert into public.profiles (id, email, role, is_active)
  values (v_id, v_email, 'admin', true)
  on conflict (id) do update
    set role      = 'admin'::public.user_role,
        is_active = true,
        email     = coalesce(public.profiles.email, excluded.email),
        updated_at = now();

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
         updated_at = now()
   where id = v_id;

  raise notice 'DONE: % is now an admin. Log in at /foisal/login.', v_email;
end $$;

-- Read-only confirmation
select
  u.email,
  p.role,
  p.is_active,
  case
    when p.role = 'admin' then 'OK — /foisal/login দিয়ে লগইন করুন'
    else 'NOT FOUND — Authentication → Users থেকে ইউজার তৈরি করুন, তারপর আবার চালান'
  end as note
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('foysaliqbal09@gmail.com');
