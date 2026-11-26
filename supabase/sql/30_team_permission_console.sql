-- ============================================================================
-- 30_team_permission_console.sql
-- ----------------------------------------------------------------------------
-- কী করে
--   অ্যাডমিন এখন থেকে **প্যানেল থেকে** ঠিক করে দিতে পারবেন কোন রোল (স্টাফ /
--   ম্যানেজার) প্যানেলের কোন কোন অংশে ঢুকতে পারবে। কোডে যে ডিফল্ট সেট ছিল সেটাই
--   শুরুর অবস্থা — অ্যাডমিন কিছু না বদলালে আচরণ হুবহু আগের মতোই।
--
-- কেন দরকার
--   আগে রোল-অনুমতি ছিল শুধু কোডে (lib/permissions.ts)। মানে স্টাফের হাত আরও
--   বাড়াতে হলে বা কমাতে হলে কোড বদলে deploy করতে হতো। কিন্তু মালিক চান:
--   "কোন রোল কী পারবে, সেটা অ্যাডমিন প্যানেল থেকে সেট করবে।"
--
-- কীভাবে কাজ করে
--   1. `role_permissions` — শুধু **বদলগুলো** রাখা হয়, পুরো তালিকা নয়।
--        is_granted = true   → ডিফল্টে ছিল না, এখন দেওয়া হচ্ছে
--        is_granted = false  → ডিফল্টে ছিল, এখন বন্ধ করা হচ্ছে
--      কোনো সারি না থাকলে কোডের ডিফল্টই প্রযোজ্য। এতে later কোনো নতুন permission
--      কোডে যোগ হলে সেটা ডিফল্টমতোই কাজ করবে — ডেটাবেসে পুরোনো ছবি জমে থাকবে না।
--   2. `admin` রোল কখনো বদলানো যায় না। ফাংশনই তা আটকে দেয়, UI নয়।
--   3. `permission_catalog` — কোন permission মানুষের ভাষায় কী, কোন গ্রুপে বসবে।
--      প্যানেলের "অ্যাক্সেস" পাতা এখান থেকেই নিজেকে গড়ে, তাই কোড আর ডেটাবেসে
--      দুটো আলাদা তালিকা রাখতে হয় না।
--
-- ২৭/২৮/২৯-এর সাথে সামঞ্জস্যপূর্ণ। দুইবার চালালেও নিরাপদ। কোনো ডেটা মুছি না।
-- ============================================================================


-- ============================================================================
-- 1. permission_catalog — প্যানেলের চেকবক্সের তালিকা
-- ============================================================================
create table if not exists public.permission_catalog (
  permission  text primary key,
  group_key   text not null,
  group_bn    text not null,
  label_bn    text not null,
  hint_bn     text,
  /** খুব বিপজ্জনক permission — UI-তে আলাদা রঙে দেখানো হয় */
  is_sensitive boolean not null default false,
  sort_order  integer not null default 0
);

comment on table public.permission_catalog is
  'Every permission that can be granted from the panel, with its Bangla label and the group it renders under. The panel builds its checkbox grid from this table, so a permission added in code only needs one row here.';

insert into public.permission_catalog
  (permission, group_key, group_bn, label_bn, hint_bn, is_sensitive, sort_order)
values
  -- ---- অর্ডার ও টাকা -------------------------------------------------------
  ('orders.read',       'orders',   'অর্ডার ও পেমেন্ট', 'অর্ডার দেখা',            'কোন অর্ডার কী অবস্থায় আছে, কে কিনেছে', false, 10),
  ('orders.write',      'orders',   'অর্ডার ও পেমেন্ট', 'অর্ডারের অবস্থা বদলানো',  'packing / shipped / delivered করা', false, 20),
  ('orders.refund',     'orders',   'অর্ডার ও পেমেন্ট', 'রিফান্ড দেওয়া',          'টাকা ফেরত দেওয়া — টাকা বেরিয়ে যায়', true, 30),
  ('payments.manage',   'orders',   'অর্ডার ও পেমেন্ট', 'টাকার নম্বর বদলানো',      'যে নম্বরে গ্রাহক টাকা পাঠায় — সবচেয়ে বিপজ্জনক', true, 40),
  ('coupons.write',     'orders',   'অর্ডার ও পেমেন্ট', 'কুপন বানানো',            'ডিসকাউন্ট কোড তৈরি ও বন্ধ করা', false, 50),
  ('payouts.read',      'orders',   'অর্ডার ও পেমেন্ট', 'সেলার পেমেন্ট দেখা',      'কোন সেলারকে কত দিতে হবে', false, 60),
  ('payouts.write',     'orders',   'অর্ডার ও পেমেন্ট', 'সেলারকে পেমেন্ট দেওয়া',   'দেওয়া হয়েছে বলে চিহ্নিত করা', true, 70),

  -- ---- পণ্য ----------------------------------------------------------------
  ('products.read',     'catalog',  'পণ্য',            'পণ্য দেখা',              'পণ্যের তালিকা ও স্টক', false, 10),
  ('products.write',    'catalog',  'পণ্য',            'পণ্য যোগ/সম্পাদনা',      'নতুন পণ্য, দাম, ছবি', false, 20),
  ('categories.write',  'catalog',  'পণ্য',            'ক্যাটাগরি',              'ক্যাটাগরি তৈরি ও সাজানো', false, 30),
  ('combos.write',      'catalog',  'পণ্য',            'কম্বো বক্স',             'একাধিক পণ্যের প্যাকেজ', false, 40),
  ('inventory.write',   'catalog',  'পণ্য',            'স্টক',                   'স্টক সংখ্যা ঠিক করা', false, 50),

  -- ---- গ্রাহক ও সেলার ------------------------------------------------------
  ('customers.read',    'people',   'গ্রাহক ও সেলার',   'গ্রাহক দেখা',            'নাম, ফোন, ওয়ালেট', false, 10),
  ('sellers.read',      'people',   'গ্রাহক ও সেলার',   'সেলার দেখা',             'সেলার প্রোফাইল ও পণ্য', false, 20),
  ('sellers.approve',   'people',   'গ্রাহক ও সেলার',   'সেলার অনুমোদন',          'নতুন সেলার গ্রহণ বা বাতিল', true, 30),
  ('team.read',         'people',   'গ্রাহক ও সেলার',   'টিম দেখা',               'কে টিমে আছে, কোন রোলে', false, 40),
  ('team.invite',       'people',   'গ্রাহক ও সেলার',   'টিমে নতুন যোগ',           'কাউকে স্টাফ/ম্যানেজার বানানো', true, 50),
  ('team.role',         'people',   'গ্রাহক ও সেলার',   'রোল বদলানো',             'কারও রোল স্টাফ থেকে ম্যানেজার করা', true, 60),
  ('team.suspend',      'people',   'গ্রাহক ও সেলার',   'টিম থেকে বাদ',            'অ্যাকাউন্ট বন্ধ করা', true, 70),

  -- ---- কনটেন্ট -------------------------------------------------------------
  ('content.write',     'content',  'কনটেন্ট',          'ব্লগ, পেজ, ব্যানার, FAQ', 'সাইটের লেখা ও ছবি', false, 10),
  ('content.layout',    'content',  'কনটেন্ট',          'হোমপেজ সাজানো',          'সেকশনের ক্রম ও স্লাইডার', false, 20),
  ('content.social',    'content',  'কনটেন্ট',          'সোশ্যাল লিংক',           'হেডার/ফুটারের লিংক', false, 30),
  ('media.write',       'content',  'কনটেন্ট',          'মিডিয়া',                'ছবি আপলোড ও মোছা', false, 40),
  ('seo.write',         'content',  'কনটেন্ট',          'SEO',                    'টাইটেল, বর্ণনা, কীওয়ার্ড', false, 50),

  -- ---- গ্রাহকসেবা -----------------------------------------------------------
  ('reviews.moderate',  'service',  'গ্রাহকসেবা',       'রিভিউ দেখা/লুকানো',       'কোন রিভিউ সাইটে দেখাবে', false, 10),
  ('complaints.handle', 'service',  'গ্রাহকসেবা',       'অভিযোগের উত্তর',          'নষ্ট/ভুল পণ্যের অভিযোগ', false, 20),
  ('chats.handle',      'service',  'গ্রাহকসেবা',       'লাইভ চ্যাট',             'গ্রাহকের সাথে চ্যাট ও claim', false, 30),
  ('cams.manage',       'service',  'গ্রাহকসেবা',       'ক্যামেরা ও খামার',        'লাইভ ক্যামেরা যোগ/বন্ধ', false, 40),

  -- ---- রিপোর্ট ও নিরাপত্তা -------------------------------------------------
  ('reports.view',      'insight',  'রিপোর্ট ও নিরাপত্তা', 'রিপোর্ট ও ড্যাশবোর্ড',  'আজ/সপ্তাহের বিক্রি, হিসাব', false, 10),
  ('premium.manage',    'insight',  'রিপোর্ট ও নিরাপত্তা', 'প্রিমিয়াম ও প্ল্যান',    'সাবস্ক্রিপশন অনুমোদন, দাম', true, 20),
  ('audit.read',        'insight',  'রিপোর্ট ও নিরাপত্তা', 'অডিট লগ',                'কে কী করেছে — ইতিহাস', false, 30),
  ('data.export',       'insight',  'রিপোর্ট ও নিরাপত্তা', 'ডেটা এক্সপোর্ট',          'CSV/ব্যাকআপ নামানো', true, 40),
  ('settings.write',    'insight',  'রিপোর্ট ও নিরাপত্তা', 'সাইট সেটিংস',            'ডেলিভারি চার্জ, কমিশন, লগইন নিয়ম', true, 50)
on conflict (permission) do update
  set group_key    = excluded.group_key,
      group_bn     = excluded.group_bn,
      label_bn     = excluded.label_bn,
      hint_bn      = excluded.hint_bn,
      is_sensitive = excluded.is_sensitive,
      sort_order   = excluded.sort_order;


-- ============================================================================
-- 2. role_permissions — অ্যাডমিনের সিদ্ধান্ত (শুধু বদলগুলো)
-- ============================================================================
create table if not exists public.role_permissions (
  role        text not null check (role in ('staff', 'manager')),
  permission  text not null,
  is_granted  boolean not null,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (role, permission)
);

comment on table public.role_permissions is
  'Admin overrides for the built-in role permission sets. A row means "this role differs from the code default for this permission". No row = the code default applies, so permissions added in future code work immediately without a data migration.';

comment on column public.role_permissions.is_granted is
  'true = granted on top of the default, false = taken away from the default.';

create index if not exists role_permissions_role
  on public.role_permissions (role);


-- ============================================================================
-- 3. role_permission_defaults() — কোডের ডিফল্টের একমাত্র কপি (ডেটাবেসে)
-- ----------------------------------------------------------------------------
-- lib/permissions.ts MUST agree with this table. scripts/check-permissions.mjs
-- runs this function and compares the two lists, so the copy cannot drift.
-- ============================================================================
create or replace function public.role_permission_defaults()
returns table (role text, permission text)
language sql
immutable
as $$
  select r.role, p.permission
    from (values ('staff'), ('manager')) as r(role)
   cross join lateral (
     select unnest(
       case r.role
         when 'staff' then array[
           'admin.access', 'dashboard.view',
           'products.read', 'products.write', 'categories.write', 'combos.write',
           'inventory.write', 'orders.read', 'content.write', 'seo.write',
           'media.write', 'reviews.moderate', 'complaints.handle', 'chats.handle',
           'customers.read', 'sellers.read', 'cams.manage', 'content.layout',
           'content.social'
         ]::text[]
         when 'manager' then array[
           'admin.access', 'dashboard.view',
           'products.read', 'products.write', 'categories.write', 'combos.write',
           'inventory.write', 'orders.read', 'content.write', 'seo.write',
           'media.write', 'reviews.moderate', 'complaints.handle', 'chats.handle',
           'customers.read', 'sellers.read', 'cams.manage', 'content.layout',
           'content.social',
           'reports.view', 'orders.write', 'orders.refund', 'coupons.write',
           'payouts.read', 'payouts.write', 'sellers.approve', 'premium.manage',
           'team.read', 'audit.read', 'data.export'
         ]::text[]
       end
     ) as permission
   ) as p;
$$;

comment on function public.role_permission_defaults() is
  'The code defaults from lib/permissions.ts, as data. scripts/check-permissions.mjs compares this with the TypeScript so the two can never disagree.';

revoke all on function public.role_permission_defaults() from public, anon, authenticated;
grant execute on function public.role_permission_defaults() to service_role;


-- ============================================================================
-- 4. effective_permissions() — ডিফল্ট + অ্যাডমিনের বদল
-- ============================================================================
create or replace function public.role_permissions_effective(p_role text)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select permission from public.role_permission_defaults() d where d.role = p_role
  ),
  overrides as (
    select permission, is_granted from public.role_permissions where role = p_role
  )
  select coalesce(array_agg(permission order by permission), '{}'::text[])
    from (
      select permission from base
      except
      select permission from overrides where is_granted is false
      union
      select permission from overrides where is_granted is true
    ) x;
$$;

comment on function public.role_permissions_effective(text) is
  'The permissions a role actually holds: the code default, plus what the admin granted, minus what the admin took away. Admin is deliberately not handled here — it always holds everything.';

-- প্যানেল নিজেই পড়ে, তাই ক্লায়েন্টের জন্য খোলা (শুধু পড়া, কোনো টাকা নড়ে না)।
revoke all on function public.role_permissions_effective(text) from anon;
grant execute on function public.role_permissions_effective(text) to service_role;


-- ============================================================================
-- 5. RLS — পড়া যায় সবাই, লেখা শুধু RPC দিয়ে
-- ============================================================================
alter table public.permission_catalog enable row level security;
alter table public.role_permissions   enable row level security;

/* ক্যাটালগ সবাই পড়তে পারে — এতে কোনো গোপন তথ্য নেই, আর প্যানেলের UI এটাই
   ব্যবহার করে। */
drop policy if exists "permission catalog is public read" on public.permission_catalog;
create policy "permission catalog is public read" on public.permission_catalog
  for select to anon, authenticated using (true);

/* কে কী পাবে — এটা শুধু স্টাফই দেখতে পারে (অ্যাডমিন UI-তে দেখে)। */
drop policy if exists "staff read role permissions" on public.role_permissions;
create policy "staff read role permissions" on public.role_permissions
  for select to authenticated using (public.is_staff());

/* INSERT/UPDATE/DELETE-এর কোনো পলিসি নেই — অর্থাৎ ক্লায়েন্ট সরাসরি লিখতে
   পারবে না, শুধু service role (রুট) পারবে। রুট আবার role_permissions_set()
   ডাকে, যেটা নিজেও অ্যাডমিন যাচাই করে। দুটো স্তর, ইচ্ছাকৃত। */
revoke insert, update, delete on public.permission_catalog from anon, authenticated;
revoke insert, update, delete on public.role_permissions   from anon, authenticated;


-- ============================================================================
-- 6. role_permissions_set() — অ্যাডমিনের একমাত্র লেখার পথ
-- ----------------------------------------------------------------------------
-- কোনো permission ডিফল্টের সমান হলে সারিটা মুছে ফেলা হয় — ডিফল্ট অবস্থায় ফেরা
-- মানে ডেটাবেসে কোনো বাড়তি সারি না রাখা। এতে later কোডে নতুন permission যোগ
-- হলে সেটা এমনিই কাজ করবে।
-- ============================================================================
create or replace function public.role_permissions_set(
  p_role     text,
  p_grants   text[] default '{}',
  p_revokes  text[] default '{}',
  p_actor    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_effective  text[];
  v_unknown    text[];
  v_saved      integer := 0;
begin
  if not public.is_service_request() then
    raise exception 'PERMISSION_FORBIDDEN' using
      hint = 'role_permissions_set() may only be called by the server (service role).';
  end if;

  /* admin রোল কখনো বদলানো যায় না — ফাংশনেই আটকানো। UI-তে বোতাম নেই, কিন্তু
     API সরাসরি ডাকলে এখানেই থামবে। */
  if p_role is null or p_role not in ('staff', 'manager') then
    raise exception 'PERMISSION_BAD_ROLE:%', coalesce(p_role, '(null)');
  end if;

  /* actor সত্যিই অ্যাডমিন কি না — না হলে টিমের কেউ নিজের হাত বাড়িয়ে নিতে পারত। */
  if p_actor is null then
    raise exception 'PERMISSION_NO_ACTOR';
  end if;

  select role into v_actor_role from public.profiles where id = p_actor;
  if v_actor_role is distinct from 'admin' then
    raise exception 'PERMISSION_ADMIN_ONLY';
  end if;

  /* অজানা permission বসিয়ে দিলে সেটা চিরকাল পড়ে থাকত; বরং থেমে যাওয়া ভালো। */
  select array_agg(x) into v_unknown
    from unnest(p_grants || p_revokes) x
   where x not in (select permission from public.permission_catalog);
  if v_unknown is not null then
    raise exception 'PERMISSION_UNKNOWN:%', array_to_string(v_unknown, ',');
  end if;

  /* একই permission দুটো তালিকায় থাকলে কোনটা সত্য? থেমে যাওয়া ভালো। */
  select array_agg(x) into v_unknown
    from (select unnest(p_grants) intersect select unnest(p_revokes)) x;
  if v_unknown is not null then
    raise exception 'PERMISSION_CONFLICT:%', array_to_string(v_unknown, ',');
  end if;

  /* ---- লেখা: ডিফল্টের সমান হলে সারি রাখি না ---------------------------- */
  delete from public.role_permissions where role = p_role;

  insert into public.role_permissions (role, permission, is_granted, updated_by, updated_at)
  select p_role, g, true, p_actor, now()
    from unnest(p_grants) g
   where g not in (select permission from public.role_permission_defaults() d
                    where d.role = p_role)
  on conflict (role, permission) do update
    set is_granted = true, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  get diagnostics v_saved = row_count;

  insert into public.role_permissions (role, permission, is_granted, updated_by, updated_at)
  select p_role, r, false, p_actor, now()
    from unnest(p_revokes) r
   where r in (select permission from public.role_permission_defaults() d
                where d.role = p_role)
  on conflict (role, permission) do update
    set is_granted = false, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  v_effective := public.role_permissions_effective(p_role);

  return jsonb_build_object(
    'ok', true,
    'role', p_role,
    'effective', to_jsonb(v_effective),
    'count', coalesce(array_length(v_effective, 1), 0)
  );
end;
$$;

comment on function public.role_permissions_set(text, text[], text[], uuid) is
  'The only writer of role_permissions. Service-role only, and the actor must really be an admin — checked in the function, not just in the route.';

revoke all on function public.role_permissions_set(text, text[], text[], uuid)
  from public, anon, authenticated;
grant execute on function public.role_permissions_set(text, text[], text[], uuid)
  to service_role;


-- ============================================================================
-- 7. role_permissions_reset() — ডিফল্টে ফেরা
-- ============================================================================
create or replace function public.role_permissions_reset(
  p_role text,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
begin
  if not public.is_service_request() then
    raise exception 'PERMISSION_FORBIDDEN';
  end if;
  if p_role is null or p_role not in ('staff', 'manager') then
    raise exception 'PERMISSION_BAD_ROLE:%', coalesce(p_role, '(null)');
  end if;

  select role into v_actor_role from public.profiles where id = p_actor;
  if v_actor_role is distinct from 'admin' then
    raise exception 'PERMISSION_ADMIN_ONLY';
  end if;

  delete from public.role_permissions where role = p_role;

  return jsonb_build_object(
    'ok', true,
    'role', p_role,
    'effective', to_jsonb(public.role_permissions_effective(p_role))
  );
end;
$$;

revoke all on function public.role_permissions_reset(text, uuid)
  from public, anon, authenticated;
grant execute on function public.role_permissions_reset(text, uuid) to service_role;


-- ============================================================================
-- 8. যাচাই
-- ----------------------------------------------------------------------------
--   -- ডিফল্ট তালিকা (কোডের সাথে মিলতে হবে)
--   select * from public.role_permission_defaults() order by 1,2;
--
--   -- অ্যাডমিন কিছু বদলেছে কি?
--   select * from public.role_permissions order by role, permission;
--
--   -- একজন স্টাফ আসলে কী কী পারে
--   select public.role_permissions_effective('staff');
--
--   -- admin কখনো বদলানো যাবে না
--   select public.role_permissions_set('admin', array['settings.write'], '{}', <admin-uuid>);
--   -- ERROR: PERMISSION_BAD_ROLE:admin
--
-- ROLLBACK (কোনো ডেটা হারায় না):
--   drop function if exists public.role_permissions_reset(text, uuid);
--   drop function if exists public.role_permissions_set(text, text[], text[], uuid);
--   drop function if exists public.role_permissions_effective(text);
--   drop table if exists public.role_permissions;
--   drop function if exists public.role_permission_defaults();
--   drop table if exists public.permission_catalog;
--   -- কোডের ডিফল্ট তখনই প্রযোজ্য, তাই কিছুই ভাঙবে না।
--
-- DONE.
