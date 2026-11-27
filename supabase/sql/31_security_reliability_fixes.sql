-- ============================================================================
-- 31_security_reliability_fixes.sql
-- ----------------------------------------------------------------------------
-- কী ঠিক করে
--   কাস্টমার bKash/Nagad/Rocket-এর TrxID জমা দিলে দুটো কাজ হয়: TrxID-টা
--   claim করা (যাতে একই TrxID দুই অর্ডারে না বসে) আর অর্ডারের payment_ref
--   লেখা। আগে এই দুটো **আলাদা** HTTP রিকোয়েস্টে হতো:
--
--       payment_claim()  → payment_refs-এ সারি
--       update orders    → payment_ref
--
--   মাঝখানে যেকোনো একটা ফেল করলে সিস্টেমের অবস্থা অসঙ্গত হতো:
--
--     (ক) claim হলো, update ফেল করল
--         → TrxID-টা "ব্যবহৃত" হিসেবে পড়ে থাকে কিন্তু কোনো অর্ডারে নেই।
--           গ্রাহক আবার চেষ্টা করলে "এই TrxID আগেই ব্যবহার হয়েছে" — অথচ
--           সেটা তিনি নিজেই করেছিলেন। টাকার প্রমাণ হারিয়ে যায়, অ্যাডমিনও
--           বুঝতে পারেন না কেন।
--     (খ) দুজন গ্রাহক একসাথে একই TrxID দিলে
--         → একজন claim-এ হারে (ঠিক আছে), কিন্তু প্রথমজনের update ফেল করলে
--           TrxID পুড়ে যায় কারো নামে না বসেই।
--     (গ) অর্ডার বাতিল/পেইড হয়ে গেলে
--         → claim সফল, তারপর update 0 সারি ছুঁয়ে ব্যর্থ। claim-টা থেকে যায়।
--
-- কেন এটা টাকার প্রশ্ন
--   payment_refs-ই একমাত্র প্রমাণ যে "এই TrxID কোথায় গেছে"। একটা অনাথ claim
--   মানে গ্রাহকের দেওয়া টাকা কারো অর্ডারের সাথে জোড়া নেই, আর ওই TrxID আর
--   কখনো ব্যবহার করা যাবে না। এই ফাইল সেটাই অসম্ভব করে দেয়।
--
-- কীভাবে
--   payment_submit() — claim আর payment_ref লেখা, একটাই ট্রানজেকশন:
--     • অর্ডার/সাবস্ক্রিপশন সারি FOR UPDATE লক
--     • অবস্থা যাচাই (paid/active হলে থামো, বাতিল হলে থামো)
--     • TrxID claim (unique index) বা OWNER CHECK
--     • payment_ref লেখা — শুধু তখনই, যখন অবস্থা এখনো "অপেক্ষমাণ"
--     • একটাও ধাপ ফেল করলে পুরোটা rollback, claim-ও যাবে
--
--   claim আর write একই ফাংশনে থাকায় "claim হলো কিন্তু write হলো না" অবস্থাটা
--   আর তৈরি হওয়াই সম্ভব নয়।
--
-- অ্যাডমিন যাচাই: এই ফাংশন কখনো payment_status = 'paid' করে না। গ্রাহকের
-- দেওয়া TrxID কেবল একটা দাবি — অ্যাডমিন প্যানেল থেকে যাচাই করলেই 'paid' হয়।
--
-- ২৫/২৯/৩০/৩২-এর সাথে সামঞ্জস্যপূর্ণ। দুইবার চালালেও নিরাপদ।
-- কোনো অর্ডার, পেমেন্ট বা ওয়ালেট সারি বদলায় বা মোছে না।
-- ============================================================================


-- ============================================================================
-- 1. payment_submit() — claim + write, এক ট্রানজেকশনে
-- ----------------------------------------------------------------------------
-- প্রত্যাবর্তন (jsonb), `result` কী দিয়ে:
--   'claimed'    — নতুন claim, payment_ref লেখা হলো
--   'already'    — একই অর্ডারে একই TrxID আবার (গ্রাহকের ডাবল-ট্যাপ) — ঠিক আছে
--   'duplicate'  — TrxID অন্য অর্ডারে/সাবস্ক্রিপশনে ব্যবহৃত
--   'paid'       — ইতিমধ্যে পরিশোধিত
--   'cancelled'  — অর্ডার বাতিল হয়ে গেছে
--   'stale'      — অন্য রিকোয়েস্ট এইমাত্র অবস্থা বদলে দিয়েছে (একই ফলাফল: 409)
--   'not_found'  — আইডি মেলেনি
-- ============================================================================
create or replace function public.payment_submit(
  p_kind      text,
  p_target    uuid,
  p_ref       text,
  p_user      uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key        text := public.payment_ref_key(p_ref);
  v_claimed_by uuid;
  v_is_new     boolean := false;
  v_updated    integer := 0;
  v_status     text;
  v_owner      uuid;
begin
  /* ---- অনুমতি ---------------------------------------------------------- */
  if not public.is_service_request() then
    raise exception 'PAYMENT_FORBIDDEN' using
      hint = 'payment_submit() may only be called by the server (service role).';
  end if;

  if v_key is null then
    raise exception 'PAYMENT_REF_EMPTY';
  end if;

  if p_kind is null or p_kind not in ('order', 'subscription') then
    raise exception 'PAYMENT_BAD_KIND:%', coalesce(p_kind, '(null)');
  end if;

  if p_target is null then
    raise exception 'PAYMENT_NO_TARGET';
  end if;

  /* ---- ১. টার্গেট লক করে অবস্থা পড়ি -----------------------------------
     FOR UPDATE এখানে দুটো কাজ করে:
       • একই অর্ডারে দুইটা রিকোয়েস্ট একসাথে এলে একটা অপেক্ষা করবে
       • দ্বিতীয়টা come in করলে সে ইতিমধ্যে লেখা payment_ref দেখতে পাবে
     `orders.status` হলো DELIVERY অবস্থা — পেমেন্টের জন্য `payment_status`।
     সাবস্ক্রিপশনে আবার `status`-ই পেমেন্ট+জীবনকাল দুটোই (enum: pending →
     active)। আগের রুটেও এই ভেদটা করা হয়েছিল; এখানে এক জায়গায়। */
  if p_kind = 'order' then
    select payment_status::text, user_id into v_status, v_owner
      from public.orders where id = p_target for update;

    if not found then
      return jsonb_build_object('result', 'not_found');
    end if;

    if v_status = 'paid' then
      return jsonb_build_object('result', 'paid');
    end if;

    /* বাতিল অর্ডারে পেমেন্ট জমা নেওয়ার মানে হয় না — গ্রাহক টাকা পাঠিয়ে
       ফেলেছেন, অথচ অর্ডারটা আর নেই। claim করার আগেই থামা ভালো। */
    if exists (select 1 from public.orders o where o.id = p_target and o.status = 'cancelled') then
      return jsonb_build_object('result', 'cancelled');
    end if;
  else
    select status::text, user_id into v_status, v_owner
      from public.user_subscriptions where id = p_target for update;

    if not found then
      return jsonb_build_object('result', 'not_found');
    end if;

    if v_status = 'active' then
      return jsonb_build_object('result', 'paid');
    end if;

    if v_status = 'cancelled' then
      return jsonb_build_object('result', 'cancelled');
    end if;
  end if;

  /* ---- ২. মালিকানা -----------------------------------------------------
     রুট ইতিমধ্যে যাচাই করেছে (লগইন থাকলে user_id মিলতে হবে, গেস্ট হলে ফোন)।
     এখানে আবার দেখি, কারণ ফাংশনটা ভবিষ্যতে অন্য কেউ ডাকতে পারে এবং তখন
     একটা ভুল প্যারামিটার যেন অন্য কারো অর্ডারে TrxID না বসায়। p_user null
     মানে গেস্ট — রুট ফোন যাচাই করেছে, আর অর্ডারটারও কোনো user_id নেই
     (নইলে রুট 403 দিত)। */
  if v_owner is not null and p_user is distinct from v_owner then
    return jsonb_build_object('result', 'forbidden');
  end if;

  /* ---- ৩. claim --------------------------------------------------------
     এক INSERT, unique index-এ ভর করে। একই ট্রানজেকশনে থাকায় নিচের যেকোনো
     ব্যর্থতা এটাকেও rollback করে দেয় — অনাথ claim থাকবে না। */
  insert into public.payment_refs (ref, kind, target_id, user_id)
  values (v_key, p_kind, p_target, v_owner)
  on conflict (ref) do nothing;

  if found then
    v_is_new := true;
  else
    /* আগেই claim হয়েছে। নিজের অর্ডারে হলে ঠিক আছে (idempotent), নইলে
       প্রত্যাখ্যান। kind আলাদা হলেও একই TrxID চলবে না — TrxID-টা টাকার,
       টাকা সাবস্ক্রিপশন আর অর্ডার চেনে না। */
    select target_id into v_claimed_by from public.payment_refs where ref = v_key;
    if v_claimed_by is distinct from p_target then
      return jsonb_build_object('result', 'duplicate');
    end if;
  end if;

  /* ---- ৪. payment_ref লেখা — শুধু তখনই, যখন অবস্থা এখনো লেখার যোগ্য ------
     শর্তটা WHERE-এর ভিতরে, তাই "পড়ি তারপর লিখি" ফাঁক নেই। আগেই paid হয়ে
     থাকলে 0 সারি মিলবে → 'stale', এবং claim-টা rollback হয়ে যাবে (নতুন
     হলে), কারণ আমরা exception ছুঁড়ছি না — তাই নিচে শুধু return নয়, পুরো
     ফাংশনটা এক ট্রানজেকশনে থাকায় return করলে commit হয়ে যেত।

     এজন্যই এখানে state check-এর ব্যর্থতাকে **exception** হিসেবে তুলি: নাহলে
     claim করা সারিটা থেকে যেত, অথচ write হয়নি — ঠিক যে অবস্থাটা দূর করতে
     এই ফাংশনটা লেখা হচ্ছে। */
  if p_kind = 'order' then
    update public.orders
       set payment_ref = p_ref,
           updated_at = now()
     where id = p_target
       and payment_status in ('pending', 'failed');
  else
    update public.user_subscriptions
       set payment_ref = p_ref,
           updated_at = now()
     where id = p_target
       and status = 'pending';
  end if;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    /* অবস্থা বদলে গেছে এইমাত্র। exception ছুঁড়লে claim-ও rollback হবে —
       নতুন claim থাকলে সেটাই কাঙ্ক্ষিত; আগের claim হলে (already) সেটা
       আগের রিকোয়েস্টের, অক্ষত থাকবে। */
    raise exception 'PAYMENT_STALE' using
      hint = 'The order changed state while the claim was being written.';
  end if;

  /* 'already' tells the route this was the customer's own double-tap, not a new
     claim: same message, but the audit trail and the response stay honest about
     whether anything actually changed. */
  return jsonb_build_object('result', case when v_is_new then 'claimed' else 'already' end, 'ref', p_ref);
end;
$$;

comment on function public.payment_submit(text, uuid, text, uuid) is
  'Claims a TrxID and writes the order/subscription payment_ref in ONE transaction. If either half fails nothing is written, so an orphaned claim can never leave a customer''s transaction reference burned. Never marks anything paid — admin verification stays mandatory.';

revoke all on function public.payment_submit(text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.payment_submit(text, uuid, text, uuid) to service_role;


-- ============================================================================
-- 2. ownership ও search_path
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER ফাংশন owner-এর অধিকারে চলে — owner যদি নিচু প্রিভিলেজের
-- কেউ হয়, তবে টাকা ছোঁয়া এই ফাংশনই বিপদ। বাকি সেটের মতোই সুপারইউজার owner,
-- আর search_path আগেই pinned।
-- ============================================================================
do $$
declare
  v_fn text := 'public.payment_submit(text,uuid,text,uuid)';
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_roles r on r.oid = p.proowner
     where p.oid = v_fn::regprocedure and r.rolsuper
  ) then
    execute format('alter function %s owner to postgres', v_fn);
  end if;

  if not exists (
    select 1 from pg_proc
     where oid = v_fn::regprocedure
       and exists (
         select 1 from unnest(coalesce(proconfig, '{}')) c
          where c like 'search_path=%'
       )
  ) then
    raise exception 'PAYMENT_FN_NO_SEARCH_PATH:%', v_fn;
  end if;
end $$;


-- ============================================================================
-- 3. যাচাই
-- ----------------------------------------------------------------------------
--   -- শুধু সার্ভার ডাকতে পারে
--   select has_function_privilege('anon','public.payment_submit(text,uuid,text,uuid)','execute')          as anon_ok,
--          has_function_privilege('authenticated','public.payment_submit(text,uuid,text,uuid)','execute') as auth_ok,
--          has_function_privilege('service_role','public.payment_submit(text,uuid,text,uuid)','execute')  as svc_ok;
--   -- আশা: false, false, true
--
--   -- অনাথ claim আছে কি? (থাকা উচিত নয় — এটাই এই ফাইলের পুরো উদ্দেশ্য)
--   select r.* from public.payment_refs r
--    where r.kind = 'order'
--      and not exists (
--        select 1 from public.orders o
--         where o.id = r.target_id
--           and public.payment_ref_key(o.payment_ref) = r.ref
--      );
--
-- ROLLBACK:
--   drop function if exists public.payment_submit(text, uuid, text, uuid);
--   -- ২৯-এর payment_claim() অক্ষত আছে; রুট পুরোনো দুই-ধাপ পথে ফিরলে সেটাই
--   -- কাজ করবে (claim আর write আলাদা — অর্থাৎ ১ নম্বর সমস্যাটা ফিরে আসবে)।
--
-- DONE.
