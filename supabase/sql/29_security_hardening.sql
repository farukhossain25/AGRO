-- ============================================================================
-- 29_security_hardening.sql — ওয়ালেট, পেমেন্ট ও CCTV-র দরজা বন্ধ করা
-- ----------------------------------------------------------------------------
-- 28_security_hardening.sql-এর পরে চালান। বাকি ফাইলগুলোর মতোই ইডেমপোটেন্ট —
-- দুবার চালালেও কিছু ভাঙে না, কোনো ডেটা মুছে যায় না।
--
-- WHAT THIS FILE DOES (এবং আর কিছু নয়)
--   1. ওয়ালেট: wallet_apply() / place_order() / apply_referral() এখন নিজেরাই
--      যাচাই করে "কে বলছে" — আগে শুধু প্যারামিটারের p_user-কেই বিশ্বাস করত।
--      ক্লায়েন্ট থেকে এগুলোর EXECUTE বাতিল, শুধু service_role।
--   2. পেমেন্ট: একই TrxID দুই জায়গায় ব্যবহার করা যাবে না — payment_refs টেবিল
--      + unique index। পুরোনো ডুপ্লিকেট থাকলে আগে আলাদা করে রাখা হয়, তারপর
--      constraint বসানো হয় (নইলে ALTER টাইমআউট/ফেল করত)।
--   3. CCTV: viewer slot আর premium device এখন ONE transaction-এ সংরক্ষিত হয়
--      (advisory lock) — আগে "গুনে তারপর insert" ছিল, তাই সমান্তরাল রিকোয়েস্টে
--      সীমা টপকে যাওয়া যেত। সাথে মেয়াদোত্তীর্ণ টোকেন পরিষ্কার।
--   4. Storage: complaint-photos আর পাবলিক নয়; গ্রাহক নিজের + স্টাফ দেখতে পান।
--
-- WHAT IT DELIBERATELY DOES *NOT* DO
--   * কোনো টেবিল/কলাম ড্রপ করে না। কোনো গ্রাহকের ব্যালেন্স, অর্ডার বা পেমেন্ট
--     পরিবর্তন করে না।
--   * সেলার পণ্যের অটো-অ্যাপ্রুভাল, products-এর RLS বা পাবলিক পঠন ছোঁয় না।
--   * product-images / avatars / review-photos ইচ্ছাকৃতভাবে পাবলিকই থাকে।
--
-- BEFORE YOU RUN IT
--   Supabase Dashboard → Database → Backups, এবং নিচের দুইটা কুয়েরি চালিয়ে
--   ডুপ্লিকেট TrxID আছে কি না দেখে নিন (থাকলে ফাইল নিজেই সমাধান করবে, কিন্তু
--   কোন অর্ডারটা আসল সেটা আপনার জানা দরকার):
--
--     select payment_ref, count(*) from public.orders
--      where payment_ref is not null group by 1 having count(*) > 1;
--     select payment_ref, count(*) from public.user_subscriptions
--      where payment_ref is not null group by 1 having count(*) > 1;
--
-- AFTER RUNNING: "Success. No rows returned".
-- ROLLBACK: নিচে §8-এ প্রতিটার উল্টোটা লেখা আছে।
-- ============================================================================


-- ============================================================================
-- 0. helper — "এই কলটা কি সার্ভার থেকে আসছে?"
-- ----------------------------------------------------------------------------
-- route handlers সবসময় service key দিয়ে ডাকে (lib/db.ts), আর service key-এর
-- সাথে কোনো JWT যায় না — তাই auth.uid() null এবং role হয় service_role।
-- ব্রাউজার থেকে ডাকলে auth.uid() থাকে (বা anon হলে null কিন্তু role anon)।
--
-- `current_user` / `session_user` দেখে কাজ হয় না: SECURITY DEFINER ফাংশনের ভিতরে
-- সেগুলো ফাংশনের owner দেখায়, কলকারী নয়। তাই JWT claim-ই একমাত্র নির্ভরযোগ্য
-- সূত্র, আর সেটা কেউ নিজে বানাতে পারে না (JWT secret Supabase-এর হাতে)।
-- ============================================================================
create or replace function public.is_service_request()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  ) = 'service_role';
$$;

comment on function public.is_service_request() is
  'True when the call carries the service-role JWT (i.e. it came from a route handler using the secret key). Never true for a browser.';

revoke all on function public.is_service_request() from public, anon, authenticated;
grant execute on function public.is_service_request() to service_role;


-- ============================================================================
-- 1. WALLET — wallet_apply()
-- ----------------------------------------------------------------------------
-- আগের অবস্থা: SECURITY DEFINER, p_user/p_kind/p_amount সবই কলকারীর হাত থেকে,
-- আর কোনো revoke না থাকায় PUBLIC ডিফল্ট গ্রান্টই কাজ করত। অর্থাৎ যেকোনো
-- লগইন করা গ্রাহক /rest/v1/rpc/wallet_apply ডেকে **যেকোনো** user id-তে
-- ইচ্ছেমতো টাকা যোগ করতে পারত, আর kind হিসেবে 'admin' লিখে অডিট ট্রেইলও
-- নকল করতে পারত।
--
-- এখন তিনটা স্তর:
--   ক) ফাংশনের ভিতরে যাচাই — কে কল করছে, আর কোন kind দিতে পারবে
--   খ) টাকার অঙ্ক numeric(12,2) সীমার ভিতরে, ঋণাত্মক ব্যালেন্স অসম্ভব
--   গ) client-এর EXECUTE বাতিল; শুধু service_role
--
-- p_actor (ঐচ্ছিক): সার্ভার কোন অ্যাডমিনের হয়ে কাজ করছে সেটা অডিটে রাখতে।
-- না দিলে auth.uid()।
-- ============================================================================
create or replace function public.wallet_apply(
  p_user   uuid,
  p_kind   text,
  p_amount numeric,
  p_order  uuid default null,
  p_order_no text default null,
  p_note   text default null,
  p_by     uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric;
  v_new     numeric;
  v_actor   uuid := coalesce(p_by, auth.uid());
  v_service boolean := public.is_service_request();
  v_actor_is_admin boolean := false;
begin
  if p_user is null or coalesce(p_amount, 0) = 0 then
    return null;
  end if;

  /* ---- ক) authorization ------------------------------------------------
     Service key ⇒ রুট ইতিমধ্যে requirePermission() দিয়ে যাচাই করেছে; আমরা
     শুধু kind-টা তদন্ত করি। ব্রাউজার ⇒ টাকা নাড়াতে পারবে না, একদমই।
     (এই ফাংশন কখনোই গ্রাহকের নিজের ব্যালেন্স বদলানোর দরজা নয় — checkout-এর
     ডেবিট place_order()-এর ভিতরে হয়, রিফান্ড হয় lib/orders.ts থেকে।) */
  if not v_service then
    raise exception 'WALLET_FORBIDDEN' using
      hint = 'wallet_apply() may only be called by the server (service role).';
  end if;

  if p_kind not in ('referral', 'order', 'refund', 'admin', 'bonus') then
    raise exception 'WALLET_BAD_KIND:%', coalesce(p_kind, '(null)');
  end if;

  /* 'admin' kind মানে একজন অ্যাডমিনের সিদ্ধান্ত। সার্ভার নিজেই এটা ডাকে, তাই
     এখানে শুধু নিশ্চিত হই যে actor সত্যিই অ্যাডমিন — নইলে ভুল করে কোনো
     স্টাফ-রিকোয়েস্ট থেকে 'admin' লেবেল বসে যেত এবং অডিট মিথ্যা বলত। */
  if p_kind = 'admin' and v_actor is not null then
    select exists (
      select 1 from public.profiles a where a.id = v_actor and a.role = 'admin'
    ) into v_actor_is_admin;

    if not v_actor_is_admin then
      raise exception 'WALLET_ADMIN_ONLY';
    end if;
  end if;

  /* ---- খ) balance, locked ---------------------------------------------- */
  select wallet_balance into v_balance from public.profiles where id = p_user for update;
  if not found then
    raise exception 'WALLET_USER_NOT_FOUND';
  end if;

  v_balance := coalesce(v_balance, 0);
  v_new := v_balance + p_amount;

  if v_new < 0 then
    raise exception 'WALLET_INSUFFICIENT';
  end if;

  /* numeric(12,2) এর সীমা। অতিক্রম করলে raw overflow error-এর বদলে পরিষ্কার
     কারণ দেওয়া হয়। */
  if v_new > 9999999999.99 or v_new < -9999999999.99 then
    raise exception 'WALLET_RANGE';
  end if;

  update public.profiles
     set wallet_balance = round(v_new, 2),
         wallet_earned  = wallet_earned  + greatest(round(p_amount, 2), 0),
         wallet_spent   = wallet_spent   + greatest(-round(p_amount, 2), 0),
         updated_at     = now()
   where id = p_user;

  /* Immutable ledger: প্রতিটা মুভমেন্টে ঠিক একটা সারি, ব্যালেন্স-সহ। */
  insert into public.wallet_transactions
    (user_id, kind, amount, balance_after, order_id, order_no, note_bn, created_by)
  values
    (p_user, p_kind, round(p_amount, 2), round(v_new, 2), p_order, p_order_no, p_note, v_actor);

  return round(v_new, 2);
end;
$$;

comment on function public.wallet_apply(uuid, text, numeric, uuid, text, text, uuid) is
  'The ONLY writer of profiles.wallet_balance. Server (service role) only; writes one immutable ledger row per move and refuses a negative balance.';

-- client থেকে বন্ধ। `from public` লাগবে — শুধু anon/authenticated বাদ দিলে
-- PUBLIC-এর ডিফল্ট গ্রান্টই থেকে যায় (28-এ এটা নিয়ে বিস্তারিত লেখা আছে)।
revoke all on function public.wallet_apply(uuid, text, numeric, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, text, numeric, uuid, text, text, uuid)
  to service_role;


-- ============================================================================
-- 2. WALLET — একই অর্ডারে দুইবার ডেবিট/রিফান্ড নয়
-- ----------------------------------------------------------------------------
-- রেফারেল কমিশনের জন্য আগেই `wallet_transactions_referral_once` ছিল। বাকি
-- kind-গুলোর জন্য কিছু ছিল না, তাই ভুল করে দুইবার refund চালালে গ্রাহক দুইবার
-- টাকা পেতেন। এখন (order_id, kind) জোড়া ইউনিক — order ছাড়া admin/bonus
-- এন্ট্রি অপরিবর্তিত (partial index)।
--
-- পুরোনো ডুপ্লিকেট থাকলে index তৈরি ফেল করত, তাই আগে থেমে স্পষ্ট মেসেজ দেওয়া
-- হয় — চুপচাপ কোনো সারি মুছে ফেলা হয় না (ledger immutable হওয়া উচিত)।
-- ============================================================================
do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes
    from (
      select order_id, kind
        from public.wallet_transactions
       where order_id is not null and kind in ('order', 'refund')
       group by order_id, kind
      having count(*) > 1
    ) d;

  if v_dupes > 0 then
    raise exception
      'WALLET_LEDGER_DUPLICATES:% — %টি (order_id, kind) জোড়ায় একাধিক সারি আছে। unique index বসানোর আগে সেগুলো দেখে নিন: select order_id, kind, count(*) from wallet_transactions where order_id is not null and kind in (''order'',''refund'') group by 1,2 having count(*) > 1;',
      v_dupes, v_dupes;
  end if;
end $$;

create unique index if not exists wallet_transactions_one_per_order_kind
  on public.wallet_transactions (order_id, kind)
  where order_id is not null and kind in ('order', 'refund');


-- ============================================================================
-- 3. place_order() — p_user আর বিশ্বাসযোগ্য নয়
-- ----------------------------------------------------------------------------
-- ফাংশনটা 25-এ লেখা (1100+ লাইন)। পুরোটা আবার লেখা মানে checkout ভাঙার ঝুঁকি,
-- তাই এখানে শুধু **অথরাইজেশন** অংশটা বদলানো হচ্ছে: বাকি বডি হুবহু একই।
--
--   ব্রাউজার থেকে ডাকলে p_user অবশ্যই auth.uid() হতে হবে, নয়তো null
--   (গেস্ট অর্ডার — টাকা কাটার প্রশ্নই আসে না, কারণ wallet ব্যবহারে লগইন লাগে)।
--   Service key থেকে ডাকলে p_user যা দেয় তাই — সেটা /api/orders রুট,
--   যেটা currentUser() পড়ে নিজেই।
-- ============================================================================
do $$
declare
  v_src text;
  v_new text;
begin
  v_src := pg_get_functiondef(
    'public.place_order(uuid, jsonb, jsonb, text, text, numeric)'::regprocedure
  );

  if v_src like '%ORDER_FORBIDDEN%' then
    return; -- আগেই বসানো আছে
  end if;

  /* `begin` এর পরে ঠিক দাঁড়িয়ে থাকা প্রথম লাইনে গার্ড ঢোকানো হয়। */
  v_new := regexp_replace(
    v_src,
    '(\nbegin\n)',
    E'\\1  -- ---- authorization (29_security_hardening.sql) ------------------------\n'
    || E'  -- A browser may only place an order for ITSELF. Before this, p_user was\n'
    || E'  -- trusted verbatim, so an authenticated caller could spend another\n'
    || E'  -- customer''s wallet balance by passing their id.\n'
    || E'  if not public.is_service_request() then\n'
    || E'    if p_user is not null and p_user is distinct from auth.uid() then\n'
    || E'      raise exception ''ORDER_FORBIDDEN'';\n'
    || E'    end if;\n'
    || E'  end if;\n\n',
    'i'
  );

  if v_new = v_src then
    raise exception 'PLACE_ORDER_PATCH_FAILED — begin ব্লক খুঁজে পাওয়া যায়নি; ফাইলটা হাতে চেক করুন।';
  end if;

  execute v_new;
end $$;

-- ব্রাউজার আর সরাসরি place_order ডাকতে পারবে না। app সবসময় /api/orders দিয়ে
-- যায় (lib/orders.ts → db()), অর্থাৎ service_role।
revoke execute on function public.place_order(uuid, jsonb, jsonb, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text, numeric)
  to service_role;


-- ============================================================================
-- 4. apply_referral() — নিজের রেফারেল নিজে
-- ----------------------------------------------------------------------------
-- আগে `authenticated`-এ grant ছিল, আর ফাংশন p_user-কে যাচাই করত না — যে কেউ
-- অন্যের প্রোফাইলে referred_by বসাতে পারত (অর্থাৎ ওই ব্যক্তির ভবিষ্যতের
-- অর্ডার থেকে কমিশন অন্য কোথাও যেত)।
-- ============================================================================
create or replace function public.apply_referral(p_user uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inviter uuid;
  v_me public.profiles%rowtype;
begin
  if p_user is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if not public.is_service_request() and p_user is distinct from auth.uid() then
    raise exception 'REFERRAL_FORBIDDEN';
  end if;

  select * into v_me from public.profiles where id = p_user;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;
  if v_me.referred_by is not null then
    raise exception 'ALREADY_REFERRED';
  end if;

  select id into v_inviter from public.profiles
   where upper(referral_code) = upper(trim(p_code)) and id <> p_user
   limit 1;

  if v_inviter is null then
    raise exception 'REFERRAL_INVALID';
  end if;

  update public.profiles
     set referred_by = v_inviter, referred_at = now(), updated_at = now()
   where id = p_user;

  return jsonb_build_object('ok', true, 'inviter', v_inviter);
end;
$$;

revoke execute on function public.apply_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_referral(uuid, text) to service_role;

-- credit_referral() ট্রিগার থেকেই চলে, ক্লায়েন্ট থেকে কখনো নয়।
revoke execute on function public.credit_referral(uuid) from public, anon, authenticated;
grant execute on function public.credit_referral(uuid) to service_role;

-- gen_referral_code()/assign_referral_code() ও ট্রিগারের অংশ।
do $$
begin
  if exists (select 1 from pg_proc where proname = 'gen_referral_code') then
    execute 'revoke execute on function public.gen_referral_code() from public, anon, authenticated';
  end if;
  if exists (select 1 from pg_proc where proname = 'assign_referral_code') then
    execute 'revoke execute on function public.assign_referral_code() from public, anon, authenticated';
  end if;
end $$;

-- resolve_ref()/coupon_allows_user()/coupon_refusal() ইচ্ছাকৃতভাবে ক্লায়েন্টের
-- জন্য খোলা: এগুলো শুধু **পড়ে** (দাম/কুপন দেখতে দেয়), কোনো টাকা নড়ায় না।
-- resolve_ref-এ p_user দিলে শুধু "সে আগে কোড ব্যবহার করেছে কি না" জানা যায়,
-- যা ওই ব্যবহারকারীর নিজের স্ক্রিনেই দরকার।


-- ============================================================================
-- 5. PAYMENT — একই TrxID দুইবার নয়
-- ----------------------------------------------------------------------------
-- আগে payment_ref ছিল শুধু একটা text কলাম। একই bKash TrxID দিয়ে আলাদা দুটি
-- অর্ডারে "পেমেন্ট করেছি" বলা যেত, আর অ্যাডমিন দুটোই অনুমোদন করলে এক পেমেন্টে
-- দুই জিনিস।
--
-- এখন payment_refs টেবিলটাই সত্য: প্রতিটা claim একটা সারি, (kind, ref) ইউনিক।
-- একই সাথে পুরোনো orders/user_subscriptions-এর payment_ref থেকে backfill হয়,
-- তাই ইতিহাসও সুরক্ষিত।
--
-- ref-এর ফরম্যাট: "TRXID | sender" (submit রুট যেভাবে লেখে)। ইউনিকেন্স
-- **TRXID**-এর উপর, sender-এর উপর নয় — নইলে একই TrxID অন্য নম্বর লিখে
-- আবার ব্যবহার করা যেত। তাই শুধু প্রথম "|"-এর আগের অংশটা ধরা হয়, upper+trim।
-- ============================================================================
create table if not exists public.payment_refs (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null,
  kind        text not null check (kind in ('order', 'subscription')),
  target_id   uuid not null,
  user_id     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.payment_refs is
  'One row per reported TrxID. The unique index is what stops one transaction reference from being claimed twice (across orders AND subscriptions).';

/** TRXID-এর ক্যানোনিকাল রূপ: বড় হাতের অক্ষর, ড্যাশ/স্পেস বাদ। */
create or replace function public.payment_ref_key(p_ref text)
returns text
language sql
immutable
as $$
  select nullif(
    upper(regexp_replace(
      split_part(coalesce(p_ref, ''), '|', 1),
      '[^A-Za-z0-9]', '', 'g'
    )),
    ''
  );
$$;

revoke all on function public.payment_ref_key(text) from public, anon, authenticated;

create unique index if not exists payment_refs_unique
  on public.payment_refs (ref);

-- ---- পুরোনো ডেটার ডুপ্লিকেট আলাদা করা --------------------------------------
-- পুরোনো ডেটায় যদি একই TrxID দুই সারিতে থাকে, unique index তৈরি ফেল করবে। তাই সবচেয়ে
-- পুরোনোটা (প্রথম claim) রাখা হয়, বাকিগুলোকে `legacy-duplicate:` প্রিফিক্স দিয়ে
-- আলাদা করা হয় — কিছুই মুছে ফেলা হয় না, শুধু নতুন constrain-এর বাইরে সরে যায়।
do $$
declare
  r record;
begin
  /* orders */
  for r in
    select id, payment_ref,
           row_number() over (partition by public.payment_ref_key(payment_ref) order by created_at, id) as rn
      from public.orders
     where payment_ref is not null and public.payment_ref_key(payment_ref) is not null
  loop
    if r.rn > 1 then
      update public.orders
         set payment_ref = 'legacy-duplicate:' || payment_ref
       where id = r.id;
      raise notice 'orders % — ডুপ্লিকেট TrxID, legacy-duplicate: প্রিফিক্স দেওয়া হলো', r.id;
    end if;
  end loop;

  /* user_subscriptions */
  for r in
    select id, payment_ref,
           row_number() over (partition by public.payment_ref_key(payment_ref) order by created_at, id) as rn
      from public.user_subscriptions
     where payment_ref is not null and public.payment_ref_key(payment_ref) is not null
  loop
    if r.rn > 1 then
      update public.user_subscriptions
         set payment_ref = 'legacy-duplicate:' || payment_ref
       where id = r.id;
      raise notice 'user_subscriptions % — ডুপ্লিকেট TrxID, legacy-duplicate: প্রিফিক্স দেওয়া হলো', r.id;
    end if;
  end loop;
end $$;

-- ---- backfill: ইতিহাসও সুরক্ষিত -------------------------------------------
insert into public.payment_refs (ref, kind, target_id, user_id, created_at)
select public.payment_ref_key(o.payment_ref), 'order', o.id, o.user_id, o.created_at
  from public.orders o
 where o.payment_ref is not null
   and public.payment_ref_key(o.payment_ref) is not null
on conflict (ref) do nothing;

insert into public.payment_refs (ref, kind, target_id, user_id, created_at)
select public.payment_ref_key(s.payment_ref), 'subscription', s.id, s.user_id, s.created_at
  from public.user_subscriptions s
 where s.payment_ref is not null
   and public.payment_ref_key(s.payment_ref) is not null
on conflict (ref) do nothing;

-- ---- claim() — atomic, service role only -----------------------------------
-- রুট প্রথমে এটাই ডাকে। duplicate হলে unique violation, যেটা রুট 409-এ রূপান্তর
-- করে। একই অর্ডারে আবার একই TrxID দিলে সেটা idempotent (ok), কারণ গ্রাহক
-- ডাবল-ট্যাপ করতে পারেন।
create or replace function public.payment_claim(
  p_ref     text,
  p_kind    text,
  p_target  uuid,
  p_user    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := public.payment_ref_key(p_ref);
  v_owner uuid;
begin
  if not public.is_service_request() then
    raise exception 'PAYMENT_FORBIDDEN';
  end if;
  if v_key is null then
    raise exception 'PAYMENT_REF_EMPTY';
  end if;
  if p_kind not in ('order', 'subscription') then
    raise exception 'PAYMENT_BAD_KIND';
  end if;

  insert into public.payment_refs (ref, kind, target_id, user_id)
  values (v_key, p_kind, p_target, p_user)
  on conflict (ref) do nothing;

  if not found then
    /* হয় আগেই ঠিক এই টার্গেটেই claim হয়েছে (গ্রাহক আবার চেষ্টা করছেন — ঠিক আছে),
       নয়তো অন্য কোথাও ব্যবহার হয়েছে (এটা প্রত্যাখ্যানযোগ্য)। */
    select target_id into v_owner from public.payment_refs where ref = v_key;
    if v_owner is distinct from p_target then
      return jsonb_build_object('ok', false, 'reason', 'duplicate');
    end if;
    return jsonb_build_object('ok', true, 'reason', 'already');
  end if;

  return jsonb_build_object('ok', true, 'reason', 'claimed');
end;
$$;

revoke all on function public.payment_claim(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.payment_claim(text, text, uuid, uuid) to service_role;

alter table public.payment_refs enable row level security;
revoke all on table public.payment_refs from anon, authenticated;
grant all on table public.payment_refs to service_role;


-- ============================================================================
-- 6. CCTV — viewer slot ও premium device এখন atomic
-- ----------------------------------------------------------------------------
-- আগে রুটে দুই ধাপ ছিল:
--     viewerCapReached()  → count
--     insert stream_tokens
-- সমান্তরাল N রিকোয়েস্টের সবগুলোই count পাস করে insert করে ফেলত, তাই
-- max_viewers কার্যত উপেক্ষিত হতো (একই camera-তে ১০০ ট্যাব খোলা যেত)।
--
-- এখন একটাই RPC, একটা transaction, একটা advisory lock camera-প্রতি।
-- "গুনে তারপর insert" আর আলাদা করা যায় না — lock ছাড়া কেউ ঢুকতেই পারে না।
-- ============================================================================
create or replace function public.stream_reserve_slot(
  p_camera    uuid,
  p_user      uuid,
  p_fingerprint text,
  p_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cap     integer;
  v_live    integer;
  v_expires timestamptz;
  v_jti     uuid;
begin
  if not public.is_service_request() then
    raise exception 'STREAM_FORBIDDEN';
  end if;
  if p_camera is null then
    raise exception 'STREAM_NO_CAMERA';
  end if;

  /* camera-প্রতি সিরিয়ালাইজ। pg_advisory_xact_lock transaction শেষে নিজেই ছাড়ে। */
  perform pg_advisory_xact_lock(hashtext('stream:' || p_camera::text));

  /* একই সাথে পুরোনো সারি পরিষ্কার — নইলে টেবিল বাড়তেই থাকত আর
     "কতজন দেখছে" সংখ্যাটা মিথ্যা হয়ে যেত। */
  delete from public.stream_tokens where expires_at <= now();

  select coalesce(nullif(c.max_viewers, 0), coalesce(settings.max_viewers_per_camera, 0))
    into v_cap
    from public.cameras c
    left join lateral (
      select (value ->> 'max_viewers_per_camera')::int as max_viewers_per_camera
        from public.site_settings
       where key = 'premium'
       limit 1
    ) settings on true
   where c.id = p_camera;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'camera');
  end if;

  select count(*) into v_live
    from public.stream_tokens
   where camera_id = p_camera and expires_at > now();

  /* cap <= 0 মানে "সীমা বসানো হয়নি" — আগের আচরণই রাখা হলো। */
  if coalesce(v_cap, 0) > 0 and v_live >= v_cap then
    return jsonb_build_object('ok', false, 'reason', 'cap', 'cap', v_cap, 'live', v_live);
  end if;

  v_expires := now() + make_interval(secs => greatest(coalesce(p_ttl_seconds, 300), 30));

  insert into public.stream_tokens (camera_id, user_id, fingerprint, expires_at)
  values (p_camera, p_user, p_fingerprint, v_expires)
  returning jti into v_jti;

  return jsonb_build_object('ok', true, 'jti', v_jti, 'expires_at', v_expires);
end;
$$;

revoke all on function public.stream_reserve_slot(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.stream_reserve_slot(uuid, uuid, text, integer) to service_role;

-- ---- premium device: register + limit, one transaction --------------------
create or replace function public.premium_device_register(
  p_user     uuid,
  p_sub      uuid,
  p_fp       text,
  p_limit    integer,
  p_label    text default null,
  p_ua       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_known  integer;
  v_exists boolean;
begin
  if not public.is_service_request() then
    raise exception 'DEVICE_FORBIDDEN';
  end if;
  if p_user is null or p_fp is null or btrim(p_fp) = '' then
    raise exception 'DEVICE_BAD_INPUT';
  end if;

  /* user-প্রতি সিরিয়ালাইজ — দুটি নতুন ডিভাইস একসাথে এলে দুটোই যেন সীমা পাস না করে। */
  perform pg_advisory_xact_lock(hashtext('device:' || p_user::text));

  select exists (
    select 1 from public.premium_devices where user_id = p_user and fingerprint = p_fp
  ) into v_exists;

  if not v_exists then
    select count(*) into v_known from public.premium_devices where user_id = p_user;

    if coalesce(p_limit, 0) > 0 and v_known >= p_limit then
      return jsonb_build_object('ok', false, 'reason', 'limit', 'limit', p_limit, 'known', v_known);
    end if;

    insert into public.premium_devices (user_id, subscription_id, fingerprint, label, user_agent, last_seen)
    values (p_user, p_sub, p_fp, p_label, p_ua, now())
    on conflict (user_id, fingerprint) do update
      set last_seen = now(),
          subscription_id = coalesce(excluded.subscription_id, public.premium_devices.subscription_id);

    return jsonb_build_object('ok', true, 'new', true);
  end if;

  update public.premium_devices
     set last_seen = now(),
         subscription_id = coalesce(p_sub, subscription_id)
   where user_id = p_user and fingerprint = p_fp;

  return jsonb_build_object('ok', true, 'new', false);
end;
$$;

revoke all on function public.premium_device_register(uuid, uuid, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.premium_device_register(uuid, uuid, text, integer, text, text)
  to service_role;

-- ---- prune: cron ছাড়াই, সবসময় ---------------------------------------------
create or replace function public.stream_prune_tokens()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if not public.is_service_request() then
    raise exception 'STREAM_FORBIDDEN';
  end if;

  delete from public.stream_tokens where expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.stream_prune_tokens() from public, anon, authenticated;
grant execute on function public.stream_prune_tokens() to service_role;

-- viewer count কুয়েরি এখনো লাগে (UI-তে "কতজন দেখছে"), তাই index অবশ্যই দরকার।
create index if not exists stream_tokens_camera_expiry_idx
  on public.stream_tokens (camera_id, expires_at desc);


-- ============================================================================
-- 7. STORAGE — complaint-photos এখন প্রাইভেট
-- ----------------------------------------------------------------------------
-- আগে bucket `public = true` এবং "public image read" পলিসিতে anon-সহ ছিল।
-- অভিযোগের ছবি (নষ্ট পণ্য, ব্যক্তিগত জিনিস, কখনো কাগজপত্র) যে কেউ URL পেলেই
-- দেখতে পারত। URL অনুমান করা কঠিন, কিন্তু লিক হয় (শেয়ার, স্ক্রিনশট, রেফারার)।
--
-- এখন: প্রাইভেট বাকেট + শুধু owner অথবা স্টাফ পড়তে পারেন। গ্রাহক ছবিটা
-- signed URL দিয়ে দেখেন (রুট থেকে, ৫ মিনিটের জন্য)।
--
-- মনে রাখতে হবে: অ্যাপ নিজে signed URL বানায় **secret key** দিয়ে, আর সেই
-- কল RLS বাইপাস করে। তাই অ্যাপের পথে নিরাপত্তা আসে রুট থেকে — সাইন করার
-- আগে রুট দেখে নেয় সারিটি এই গ্রাহকের কি না। নিচের পলিসি হলো দ্বিতীয় স্তর:
-- কেউ যদি নিজের JWT নিয়ে সরাসরি storage API-তে ঢুকতে চায়, সে যেন নিজের
-- ফোল্ডারের বাইরে কিছু পড়তে না পারে।
-- ============================================================================
update storage.buckets
   set public = false
 where id = 'complaint-photos';

drop policy if exists "public image read" on storage.objects;
create policy "public image read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id in (
      'avatars', 'product-images', 'category-images', 'farm-images', 'logos',
      'slides', 'team', 'review-photos', 'blog-images'
    )
  );

drop policy if exists "complaint photos read by owner or staff" on storage.objects;
create policy "complaint photos read by owner or staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (
      public.is_staff()
      /* upload route names every object `<user-id>/<timestamp>-<rand>.<ext>`,
         so the first path segment is the owner. Checking BOTH the recorded
         owner and the path means a row uploaded before `owner` was populated
         is still readable by exactly one customer, not by everyone. */
      or owner = auth.uid()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );


-- ============================================================================
-- 8. VERIFY / ROLLBACK
-- ----------------------------------------------------------------------------
-- চালানোর পরে (প্রতিটা লাইন প্রত্যাশিত মান দেবে):
--
--   -- 1. ক্লায়েন্ট ওয়ালেট ফাংশন ডাকতে পারে না
--   select has_function_privilege('authenticated','public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid)','execute');  -- false
--   select has_function_privilege('anon','public.place_order(uuid,jsonb,jsonb,text,text,numeric)','execute');               -- false
--   select has_function_privilege('authenticated','public.apply_referral(uuid,text)','execute');                            -- false
--   -- 2. মেয়াদোত্তীর্ণ টোকেন পরিষ্কার হয়
--   select public.stream_prune_tokens();   -- service role থেকেই, 0 বা তার বেশি
--   -- 3. একই TrxID দ্বিতীয়বার
--   select public.payment_ref_key('bkash123 | 01700000000');  -- 'BKASH123'
--   -- 4. complaint-photos প্রাইভেট
--   select public from storage.buckets where id = 'complaint-photos';   -- false
--
-- ROLLBACK (আলাদা কিছু না ভাঙার জন্য, একটার পর একটা):
--   update storage.buckets set public = true where id = 'complaint-photos';
--   -- তারপর 09_storage_buckets_and_policies.sql আবার চালালে পাবলিক read পলিসি ফিরে আসবে
--   drop policy if exists "complaint photos read by owner or staff" on storage.objects;
--   grant execute on function public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid) to authenticated;
--   grant execute on function public.place_order(uuid,jsonb,jsonb,text,text,numeric) to anon, authenticated;
--   grant execute on function public.apply_referral(uuid,text) to authenticated;
--   drop index if exists public.wallet_transactions_one_per_order_kind;
--   -- payment_refs / helper ফাংশন থাকতে দেওয়া নিরাপদ; দরকার হলে:
--   -- drop table if exists public.payment_refs;
--   -- drop function if exists public.payment_claim(text,text,uuid,uuid);
--
-- DONE.
