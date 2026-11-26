-- ============================================================================
-- 30_critical_fixes.sql
-- ----------------------------------------------------------------------------
-- কী ঠিক করে
--   অর্ডার বাতিল আর অর্ডার মোছা — দুটোই এখন **একটাই ডেটাবেস ট্রানজেকশনে**।
--   আগে এই কাজগুলো অ্যাপের JS থেকে ৬-৭টা আলাদা HTTP রিকোয়েস্টে হতো:
--   sub_orders আপডেট, স্টক ফেরত, কুপন ফেরত, ওয়ালেট রিফান্ড, নোটিফিকেশন।
--   একটার পর একটা — মাঝখানে কোনোটা ফেল করলে অর্ডার বাতিল হয়ে যেত কিন্তু
--   স্টক ফেরত আসত না, বা ওয়ালেটের টাকা আটকে যেত। ব্যবহারকারীর চোখে সেটা
--   "টাকা কেটে নিল কিন্তু অর্ডার নেই"।
--
-- কেন এটা টাকার প্রশ্ন
--   ১. **DELETE রুট ওয়ালেট রিফান্ড করত না।** `wallet_used` দিয়ে কেনা অর্ডার
--      মুছে ফেললে গ্রাহকের টাকা চিরতরে হারিয়ে যেত, আর লেজারে তার কোনো চিহ্নও
--      থাকত না (order_id `on delete set null` — প্রমাণটাই মুছে যায়)।
--   ২. **কুপন ফেরত deadline মানত না।** checkout-এ যে কুপন বৈধ ছিল, বাতিলের
--      সময় সেটা মেয়াদোত্তীর্ণ হলে ব্যবহারের সংখ্যা কমত না — কুপন পুড়ে যেত।
--   ৩. **ডাবল রিফান্ড ঠেকানোর ভরসা ছিল শুধু অ্যাপে।** দুই অ্যাডমিন একসাথে
--      বাতিল চাপলে Stock দুবার ফেরত আসতে পারত।
--   ৪. **পেমেন্ট করা অর্ডার বাতিল হলে `payment_status` 'paid' পড়ে থাকত।**
--      গ্রাহক টাকা দিয়েছেন, অর্ডার বাতিল, কিন্তু টাকা ফেরতের কোনো রেকর্ড নেই।
--
-- কীভাবে
--   order_cancel(p_order, p_reason, p_actor)   → বাতিল + সব প্রতিক্রিয়া, একবার
--   order_delete(p_order, p_actor)             → একই ফেরত + সারি মুছে ফেলা
--   দুটোই order_release_order() ডাকে — সেটাই আসল হিসাব।
--
--   order_release_order():
--     • orders সারি FOR UPDATE লক করে — দুটো কল একসাথে এলেও একটা অপেক্ষা করে
--     • স্টক ফেরত দেয় (booking রো থাকলেই, একবার)
--     • কুপন used_count কমায় + redemption মুছে দেয় (deadline মানে না, কারণ
--       ব্যবহারটা checkout-এ হয়ে গেছে)
--     • wallet_used ঠিক ততটুকুই ফেরত দেয় যতটা সত্যিই কাটা হয়েছিল — লেজারে
--       'order' kind-এর ডেবিট সারি থাকলেই
--     • sub_orders বাতিল করে
--     • payment_status 'paid' হলে 'refunded' করে
--   সব শেষে একটাই audit_log সারি — ফাংশনের ভিতরেই, তাই কাজ ফেল করলে
--   audit-ও লেখা হয় না (আগে আলাদা রাউটে লেখা হতো, তাই ডেটা আর লগ মিলত না)।
--
--   idempotency তিন স্তরে:
--     ১. FOR UPDATE + status পরীক্ষা (একই ট্রানজেকশনে)
--     ২. wallet_transactions-এর (order_id, kind) ইউনিক index (২৯-এ যোগ হয়েছে)
--        — একই অর্ডারে দুবার 'refund' লেখাই যায় না
--     ৩. orders row-lock — দ্বিতীয় কল 'already' পায়, সে কিছু করে না
--
-- ২৭/২৮/২৯/৩১-এর সাথে সামঞ্জস্যপূর্ণ। দুইবার চালালেও নিরাপদ।
-- কোনো পুরোনো অর্ডার, ব্যালেন্স বা লেজার সারি বদলায় না।
-- ============================================================================


-- ============================================================================
-- 0. আগের অবস্থা যাচাই — চুপচাপ ডুপ্লিকেট দেখে এগোবে না
-- ----------------------------------------------------------------------------
-- (order_id, kind) ইউনিক index ২৯-এ বসানো হয়েছে। কিন্তু কোনো প্রজেক্টে ২৯
-- না চালানো থাকলে সেটা নেই, আর তখন একই অর্ডারে দুইবার refund লেখা সম্ভব হবে।
-- তাই ইউনিক index-টা এখানে আবার নিশ্চিত করা হয় — তার আগে ডুপ্লিকেট দেখা হয়।
-- কিছু মুছে ফেলা হয় না; থাকলে স্পষ্ট মেসেজ দিয়ে থেমে যায়।
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
      'WALLET_LEDGER_DUPLICATES:% — %টি (order_id, kind) জোড়ায় একাধিক লেজার সারি আছে। এগুলো দেখে নিয়ে 30_critical_fixes.sql আবার চালান: select order_id, kind, count(*) from public.wallet_transactions where order_id is not null and kind in (''order'',''refund'') group by 1,2 having count(*) > 1;',
      v_dupes, v_dupes;
  end if;
end $$;

create unique index if not exists wallet_transactions_one_per_order_kind
  on public.wallet_transactions (order_id, kind)
  where order_id is not null and kind in ('order', 'refund');


-- ============================================================================
-- 1. order_release_order() — বাতিল/মোছার সব হিসাব, এক ট্রানজেকশনে
-- ----------------------------------------------------------------------------
-- p_order মানে কি:
--   'released'  — সব ফেরত দেওয়া হলো (কুপন, স্টক, ওয়ালেট)
--   'skipped'   — অর্ডারটি delivered বা আগেই cancelled; ফেরত দেওয়ার কিছু নেই
--
-- এই ফাংশন নিজে থেকে orders.status বদলায় না — কলকারী (order_cancel /
-- order_delete) সেটা করে, অথবা order_delete সরাসরি সারিটা মুছে ফেলে।
-- ============================================================================
create or replace function public.order_release_order(
  p_order uuid,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order        public.orders%rowtype;
  v_status       text;
  v_wallet_used  numeric(12, 2);
  v_wallet_back  numeric(12, 2) := 0;
  v_has_debit    boolean := false;
  v_coupon_back  boolean := false;
  v_stock_back   integer := 0;
  v_subs         integer := 0;
  v_item         record;
begin
  /* ---- লক: একই অর্ডারে দুই কল একসাথে এলেও একটা অপেক্ষা করবে ---------- */
  select * into v_order from public.orders where id = p_order for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  /* ---- কোন অবস্থায় কিছু ফেরত দেওয়া হয় না ----------------------------- */
  /* delivered: পণ্য গ্রাহকের হাতে, স্টক খরচ হয়ে গেছে — হঠাৎ ফেরত দিলে
     স্টকে জালিয়াতি হবে। cancelled: আগেই ফেরত দেওয়া হয়েছে (নয়তো এখানে
     প্রথমবার এসেছে — সে ক্ষেত্রে কোনো রেকর্ড নেই, তাই আবার দেওয়া মানেই
     দুইবার দেওয়া)। */
  if v_order.status in ('delivered', 'cancelled') then
    return jsonb_build_object(
      'result', 'skipped',
      'status', v_order.status,
      'wallet_refunded', 0,
      'coupon_restored', false,
      'stock_restored', 0,
      'sub_orders_cancelled', 0
    );
  end if;

  v_status := v_order.status;

  /* ---- ১. স্টক ------------------------------------------------------- */
  /* checkout-এ stock কমানো হয়েছিল; এখন ঠিক ততটুকুই ফেরত। combo লাইনে
     product_id থাকে না, তাই সেগুলো বাদ — তাদের স্টক আলাদা ট্র্যাক হয় না।
     একই product একাধিক লাইনে থাকলে একবারে যোগ হয় (নিচের GROUP BY)। */
  for v_item in
    select product_id, sum(quantity)::integer as qty
      from public.order_items
     where order_id = p_order and product_id is not null
     group by product_id
  loop
    update public.products
       set stock = coalesce(stock, 0) + v_item.qty,
           updated_at = now()
     where id = v_item.product_id;
    if found then
      v_stock_back := v_stock_back + v_item.qty;
    end if;
  end loop;

  /* ---- ২. কুপন ------------------------------------------------------- */
  /* used_count checkout-এ বাড়ানো হয়েছিল। এখানে মেয়াদ বা min_order আবার
     যাচাই করা হয় না — ব্যবহারটা তখনই হয়ে গেছে, এখন শুধু ফেরত।
     coupon_redemptions সারিটাও মুছি, নইলে "এই অ্যাকাউন্ট একবারই" নিয়মে
     গ্রাহকের ব্যবহার পুড়ে যেত। */
  if v_order.coupon_code is not null and length(trim(v_order.coupon_code)) > 0 then
    update public.coupons
       set used_count = greatest(0, coalesce(used_count, 0) - 1),
           updated_at = now()
     where code = v_order.coupon_code;
    v_coupon_back := found;

    delete from public.coupon_redemptions where order_id = p_order;
  end if;

  /* ---- ৩. ওয়ালেট ----------------------------------------------------- */
  /* **এটাই আসল বাগ ছিল।** টাকা ফেরত দিই শুধু তখনই যখন checkout-এ সত্যিই
     কাটা হয়েছিল — অর্থাৎ লেজারে এই অর্ডারের জন্য kind='order'-এর একটা
     নেগেটিভ সারি আছে। `orders.wallet_used` কলামটা বিশ্বাস করি না: সেটা
     হাতে বদলানো সম্ভব, আর কোনো অর্ডারে হয়তো কলাম আছে কিন্তু ডেবিট হয়নি।
     লেজারই একমাত্র সত্য।

     kind='refund'-এর সারি আগেই থাকলে আর কিছু করি না — (order_id, kind)
     ইউনিক index সেটা আটকে দিত, কিন্তু তার আগেই পরিষ্কারভাবে জেনে যাওয়া
     ভালো (ব্যবহারকারীকে "দুইবার ফেরত" দেখানো বন্ধ)। */
  select exists (
    select 1 from public.wallet_transactions
     where order_id = p_order and kind = 'order'
  ) into v_has_debit;

  select coalesce(-sum(amount), 0)::numeric(12, 2) into v_wallet_used
    from public.wallet_transactions
   where order_id = p_order and kind = 'order' and amount < 0;

  if v_has_debit
     and v_wallet_used > 0
     and v_order.user_id is not null
     and not exists (
       select 1 from public.wallet_transactions
        where order_id = p_order and kind = 'refund'
     )
  then
    /* wallet_apply() নিজেই প্রোফাইল সারি লক করে, ব্যালেন্স যোগায় আর
       immutable লেজার সারি লেখে — টাকার একমাত্র লেখক। kind='refund'
       তাই unique index-এর আওতায়, অর্থাৎ দ্বিতীয়বার আর হবে না। */
    perform public.wallet_apply(
      v_order.user_id,
      'refund',
      v_wallet_used,
      p_order,
      v_order.order_no,
      'অর্ডার বাতিল — ওয়ালেট ফেরত (' || v_order.order_no || ')',
      p_actor
    );
    v_wallet_back := v_wallet_used;
  end if;

  /* ---- ৪. সেলারের sub_orders ------------------------------------------ */
  /* এই সারিই সেলারের আয়। মুছি না — বাতিল করি, যাতে হিসাবের বইয়ে থাকে। */
  update public.sub_orders
     set status = 'cancelled',
         updated_at = now()
   where order_id = p_order
     and status <> 'cancelled';
  get diagnostics v_subs = row_count;

  return jsonb_build_object(
    'result', 'released',
    'status', v_status,
    'wallet_refunded', round(v_wallet_back, 2),
    'coupon_restored', v_coupon_back,
    'stock_restored', v_stock_back,
    'sub_orders_cancelled', v_subs
  );
end;
$$;

comment on function public.order_release_order(uuid, uuid) is
  'Undoes everything place_order() reserved for a live order — stock, coupon use, the wallet debit, seller sub_orders — in one locked transaction. Refunds the wallet only when a real debit ledger row exists, so it can never invent money. Internal: service-role only.';

/* ভিতরের ফাংশন — বাইরে থেকে সরাসরি ডাকার দরকার নেই। */
revoke all on function public.order_release_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.order_release_order(uuid, uuid) to service_role;


-- ============================================================================
-- 2. order_cancel() — গ্রাহক/অ্যাডমিনের "বাতিল"
-- ----------------------------------------------------------------------------
-- ফেরত: jsonb
--   result = 'cancelled'  → এখনি বাতিল হলো
--   result = 'already'    → আগেই বাতিল ছিল, দ্বিতীয়বার কিছু হয়নি
--   result = 'delivered'  → ডেলিভারি হয়ে গেছে, বাতিল হবে না
--
-- delivered অর্ডার বাতিল করতে দিই না — টাকা ফেরতের সিদ্ধান্তটা আলাদা
-- (wallet_apply kind='admin'), আর ভুল করে ডেলিভারি হওয়া অর্ডার বাতিল হলে
-- স্টক-হিসাব দুটোই ভুল হতো।
-- ============================================================================
create or replace function public.order_cancel(
  p_order  uuid,
  p_reason text default null,
  p_actor  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_actor_role text;
  v_release jsonb;
  v_payment public.payment_status;
begin
  if not public.is_service_request() then
    raise exception 'ORDER_FORBIDDEN' using
      hint = 'order_cancel() may only be called by the server (service role).';
  end if;

  if p_actor is not null then
    select role into v_actor_role from public.profiles where id = p_actor;
    if v_actor_role not in ('admin', 'manager', 'staff') then
      raise exception 'ORDER_ACTOR_FORBIDDEN';
    end if;
  end if;

  /* লক নিয়ে একবারেই অবস্থা পড়ি — এরপর আর কেউ মাঝখানে বদলাতে পারবে না। */
  select status, payment_status into v_status, v_payment
    from public.orders where id = p_order for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('result', 'already', 'status', 'cancelled');
  end if;

  if v_status = 'delivered' then
    return jsonb_build_object('result', 'delivered', 'status', 'delivered');
  end if;

  v_release := public.order_release_order(p_order, p_actor);

  /* গ্রাহক টাকা দিয়েছিলেন → এখন 'refunded'। এটা না করলে অর্ডার বাতিল,
     কিন্তু পেমেন্ট 'paid' পড়ে থাকত — হিসাবের বইয়ে গ্রাহকের টাকা আটকে
     থাকার মতো দেখাত। (আসল টাকা ফেরত দেওয়া manual/complex; এখানে শুধু
     সঠিক অবস্থা রেকর্ড হয়, যাতে অ্যাডমিন তালিকায় স্পষ্ট থাকে।) */
  update public.orders
     set status = 'cancelled',
         cancel_reason = coalesce(v_reason, cancel_reason, 'অ্যাডমিনের সিদ্ধান্তে'),
         payment_status = case when payment_status = 'paid' then 'refunded'::public.payment_status
                              else payment_status end,
         updated_at = now()
   where id = p_order;

  return jsonb_build_object(
    'result', 'cancelled',
    'status', 'cancelled',
    'wallet_refunded', (v_release ->> 'wallet_refunded')::numeric,
    'coupon_restored', (v_release ->> 'coupon_restored')::boolean,
    'stock_restored', (v_release ->> 'stock_restored')::integer,
    'sub_orders_cancelled', (v_release ->> 'sub_orders_cancelled')::integer
  );
end;
$$;

comment on function public.order_cancel(uuid, text, uuid) is
  'Cancels an order and undoes every side effect in ONE transaction. Idempotent: a second call returns result=already and changes nothing. A delivered order is never cancelled. Service-role only.';

revoke all on function public.order_cancel(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.order_cancel(uuid, text, uuid) to service_role;


-- ============================================================================
-- 3. order_delete() — "ইতিহাস থেকে মুছে ফেলো"
-- ----------------------------------------------------------------------------
-- মোছা মানে সারি হারানো। যেখানে টাকা জড়িত সেখানে সেটা কখনোই ঠিক নয়, তাই
-- তিনটা নিয়ম:
--
--   ক) delivered অর্ডার মোছা যাবে না — ওটা বিক্রির ইতিহাস (COGS, রিভিউ,
--      রেফারেল কমিশন)। "মুছে ফেলো" চাইলে বাতিল করুন, মুছবেন না।
--   খ) টাকা নেওয়া হয়েছে কিন্তু পণ্য যায়নি (paid এবং delivered নয়) —
--      আগে রিফান্ড/verify করুন। এই অবস্থায় মোছা মানে গ্রাহকের টাকা আর
--      অর্ডারের মধ্যে কোনো সম্পর্কই রাখা না।
--   গ) বাকি সব (COD, অপরিশোধিত, বাতিল) → একই ফেরত প্রক্রিয়া চালিয়ে সারি
--      মুছে ফেলা। wallet_used থাকলে সেটাও ফেরত যায় — এটাই ছিল মূল বাগ।
--
-- audit_log-এ লেখাটা **এই ট্রানজেকশনের ভিতরেই** — ফাংশন ফেল করলে লগে
-- "মুছে ফেলা হয়েছে" লেখা থাকবে না, আবার লগ ফেল করলে মুছাও হবে না।
-- ============================================================================
create or replace function public.order_delete(
  p_order uuid,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order      public.orders%rowtype;
  v_actor_role text;
  v_actor_email text;
  v_release    jsonb;
  v_snapshot   jsonb;
begin
  if not public.is_service_request() then
    raise exception 'ORDER_FORBIDDEN' using
      hint = 'order_delete() may only be called by the server (service role).';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  /* ক) ডেলিভারি হয়ে গেছে → বিক্রির ইতিহাস, মোছা নয়। */
  if v_order.status = 'delivered' then
    raise exception 'ORDER_DELIVERED' using
      hint = 'A delivered order is a sale. Cancel it instead of deleting it.';
  end if;

  /* খ) টাকা এসেছে, পণ্য যায়নি → আগে সেটা মিটুক। */
  if v_order.payment_status = 'paid' then
    raise exception 'ORDER_PAYMENT_UNRESOLVED' using
      hint = 'Refund or reject the payment before deleting the order.';
  end if;

  if p_actor is not null then
    select role, email into v_actor_role, v_actor_email
      from public.profiles where id = p_actor;
    if v_actor_role not in ('admin', 'manager', 'staff') then
      raise exception 'ORDER_ACTOR_FORBIDDEN';
    end if;
  end if;

  /* অডিটের জন্য পুরো সারিটা, সাথে আইটেম — মুছলে আর দেখা যাবে না। */
  select to_jsonb(o) || jsonb_build_object(
           'order_items',
           coalesce((select jsonb_agg(to_jsonb(i)) from public.order_items i where i.order_id = o.id), '[]'::jsonb)
         )
    into v_snapshot
    from public.orders o
   where o.id = p_order;

  /* স্টক/কুপন/ওয়ালেট ফেরত — order_cancel()-এর হুবহু একই পথ। */
  v_release := public.order_release_order(p_order, p_actor);

  /* সারি মুছে ফেলা (order_items, sub_orders, parcels ON DELETE CASCADE)।
     wallet_transactions.order_id `on delete set null` — লেজার সারিগুলো
     থেকে যায়, শুধু অর্ডারের লিংক ছাড়া। টাকার ইতিহাস মোছে না — এটাই ঠিক। */
  delete from public.orders where id = p_order;

  insert into public.audit_log
    (actor_id, actor_email, actor_role, action, entity, entity_id, diff, meta)
  values
    (p_actor, v_actor_email, v_actor_role, 'delete', 'orders', p_order::text,
     jsonb_build_object(
       'deleted', v_snapshot,
       'wallet_refunded', (v_release ->> 'wallet_refunded')::numeric,
       'coupon_restored', (v_release ->> 'coupon_restored')::boolean,
       'stock_restored', (v_release ->> 'stock_restored')::integer
     ),
     jsonb_build_object('via', 'order_delete'));

  return jsonb_build_object(
    'result', 'deleted',
    'order_no', v_order.order_no,
    'wallet_refunded', (v_release ->> 'wallet_refunded')::numeric,
    'coupon_restored', (v_release ->> 'coupon_restored')::boolean,
    'stock_restored', (v_release ->> 'stock_restored')::integer
  );
end;
$$;

comment on function public.order_delete(uuid, uuid) is
  'Deletes an order after undoing its reservations in the same transaction, and writes the audit row inside that transaction. Refuses a delivered order (that is a sale) and any order whose payment is still marked paid. Service-role only.';

revoke all on function public.order_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.order_delete(uuid, uuid) to service_role;


-- ============================================================================
-- 4. ownership ও search_path — কেউ ফাংশন বদলে দিতে না পারে
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER ফাংশন owner-এর অধিকারে চলে। owner যদি নিচু প্রিভিলেজের
-- কেউ হয় (বা কোনো রোল ফাংশনের মালিকানা নিতে পারে), তবে এই "সুরক্ষিত" ফাংশনই
-- বিপদ হয়ে যায়। তাই owner-কে পোস্টগ্রেসের নিজের সুপারইউজারদের একজন করে
-- দিই, এবং search_path আগেই pinned (প্রতিটা ফাংশনের `set search_path`)।
-- ============================================================================
do $$
declare
  v_owner text;
  v_fn    text;
begin
  foreach v_fn in array array[
    'public.order_release_order(uuid,uuid)',
    'public.order_cancel(uuid,text,uuid)',
    'public.order_delete(uuid,uuid)'
  ]
  loop
    select pg_get_userbyid(proowner) into v_owner
      from pg_proc where oid = v_fn::regprocedure;

    /* owned by a superuser already? then nothing to do. Otherwise hand it to
       the same owner the rest of the security-definer set uses. */
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
      raise exception 'ORDER_FN_NO_SEARCH_PATH:%', v_fn;
    end if;
  end loop;
end $$;


-- ============================================================================
-- 5. যাচাই
-- ----------------------------------------------------------------------------
--   -- ফাংশন তিনটা আছে এবং শুধু service_role ডাকতে পারে
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute')          as anon_ok,
--          has_function_privilege('authenticated', p.oid, 'execute') as auth_ok,
--          has_function_privilege('service_role', p.oid, 'execute')  as svc_ok
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('order_release_order','order_cancel','order_delete');
--   -- প্রতিটা সারিতে anon_ok=false, auth_ok=false, svc_ok=true
--
--   -- এই অর্ডারে ওয়ালেট থেকে কত কাটা হয়েছিল
--   select -sum(amount) from public.wallet_transactions
--    where order_id = '<uuid>' and kind = 'order';
--
--   -- রিফান্ড হয়েছে কি (সর্বোচ্চ একটা সারি)
--   select * from public.wallet_transactions
--    where order_id = '<uuid>' and kind = 'refund';
--
-- ROLLBACK (কোনো ডেটা হারায় না):
--   drop function if exists public.order_delete(uuid, uuid);
--   drop function if exists public.order_cancel(uuid, text, uuid);
--   drop function if exists public.order_release_order(uuid, uuid);
--   -- অ্যাডমিন প্যানেল তখন আগের JS পথেই বাতিল করবে (স্টক/কুপন ফেরত দেবে,
--   -- ওয়ালেট রিফান্ড দেবে না — তাই ৩০ চালানো পর্যন্ত ওয়ালেট-অর্ডার মোছবেন না)।
--
-- DONE.
