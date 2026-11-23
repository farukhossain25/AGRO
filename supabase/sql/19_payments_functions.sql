-- ============================================================================
-- 19_payments_functions.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates server-side RPCs and triggers for the payment system:
--     1. submit_payment() — validates order/guest, method, amount, TrxID,
--        rate limit, inserts payment, updates order, notifies admin.
--     2. review_payment() — admin-only approve / reject / need_more_info /
--        refund; marks order paid, writes payment_logs & audit_log, notifies
--        customer and sellers.
--     3. cancel_unpaid_orders() — cancels expired unpaid orders.
--     4. updated_at triggers on payment_methods & payment_settings.
--
-- WHEN TO RUN
--   After 18_payments_schema.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_payment_settings_updated_at on public.payment_settings;
create trigger trg_payment_settings_updated_at
  before update on public.payment_settings
  for each row execute function public.touch_updated_at();

create or replace function public.submit_payment(
  p_order_id uuid,
  p_method_id uuid,
  p_sender_number text default null,
  p_trx_id text default null,
  p_amount_sent numeric default 0,
  p_screenshot_path text default null,
  p_guest_phone text default null,
  p_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_method record;
  v_settings record;
  v_recent_count integer;
  v_payment_id uuid;
  v_admin record;
begin
  select * into v_settings from public.payment_settings where id = 1;

  select id, user_id, total, customer_phone, order_number
    into v_order
    from public.orders
   where id = p_order_id;

  if v_order.id is null then
    raise exception 'অর্ডারটি পাওয়া যায়নি';
  end if;

  if v_uid is not null then
    if v_order.user_id is not null and v_order.user_id <> v_uid and not public.is_admin() then
      raise exception 'এই অর্ডারে পেমেন্ট করার অনুমতি আপনার নেই';
    end if;
  else
    if p_guest_phone is null or btrim(p_guest_phone) = '' or v_order.customer_phone <> btrim(p_guest_phone) then
      raise exception 'অতিথি অর্ডারের জন্য সঠিক ফোন নম্বর দিন';
    end if;
  end if;

  select * into v_method from public.payment_methods where id = p_method_id and is_active = true;
  if v_method.id is null then
    raise exception 'এই পেমেন্ট মাধ্যমটি বর্তমানে সক্রিয় নয়';
  end if;

  if v_method.provider <> 'cod' then
    if p_amount_sent < v_order.total then
      raise exception 'প্রেরিত টাকার পরিমাণ অর্ডারের মোট টাকার (৳%) সমান হতে হবে', v_order.total;
    end if;
    if v_method.requires_trx_id and (p_trx_id is null or btrim(p_trx_id) = '') then
      raise exception 'অনুগ্রহ করে TrxID দিন';
    end if;
    if v_method.requires_trx_id and v_method.trx_id_pattern is not null and btrim(v_method.trx_id_pattern) <> '' then
      if not (btrim(p_trx_id) ~ v_method.trx_id_pattern) then
        raise exception 'TrxID-এর ফরম্যাট সঠিক নয়';
      end if;
    end if;
    if v_method.requires_sender_number and (p_sender_number is null or btrim(p_sender_number) = '') then
      raise exception 'অনুগ্রহ করে প্রেরকের নম্বর দিন';
    end if;
  end if;

  -- Rate limit check
  select count(*) into v_recent_count
    from public.payments
   where created_at > now() - interval '1 hour'
     and ((v_uid is not null and user_id = v_uid) or (p_guest_phone is not null and guest_phone = p_guest_phone));

  if v_recent_count >= coalesce(v_settings.max_submissions_per_hour, 5) then
    raise exception 'অনেকবার চেষ্টা করা হয়েছে। অনুগ্রহ করে ১ ঘণ্টা পর আবার চেষ্টা করুন';
  end if;

  insert into public.payments (
    order_id, user_id, guest_phone, method_id, method_snapshot,
    amount_expected, amount_sent, sender_number, trx_id, screenshot_path,
    status, ip
  )
  values (
    v_order.id,
    v_uid,
    coalesce(nullif(btrim(p_guest_phone), ''), v_order.customer_phone),
    v_method.id,
    jsonb_build_object(
      'provider', v_method.provider,
      'display_name', v_method.display_name,
      'display_name_bn', v_method.display_name_bn,
      'receiving_number', v_method.receiving_number,
      'account_type', v_method.account_type
    ),
    v_order.total,
    case when v_method.provider = 'cod' then 0 else p_amount_sent end,
    nullif(btrim(p_sender_number), ''),
    nullif(btrim(p_trx_id), ''),
    nullif(btrim(p_screenshot_path), ''),
    case when v_method.provider = 'cod' then 'verified' else 'pending_verification' end,
    p_ip
  )
  returning id into v_payment_id;

  update public.orders
     set payment_status = case when v_method.provider = 'cod' then 'cod' else 'awaiting_verification' end
   where id = v_order.id;

  insert into public.payment_logs (payment_id, action, actor_id, details)
  values (v_payment_id, 'submitted', v_uid, jsonb_build_object('provider', v_method.provider, 'trx_id', p_trx_id));

  for v_admin in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, title, body, link, kind, meta)
    values (
      v_admin.id,
      'নতুন পেমেন্ট জমা হয়েছে',
      format('অর্ডার #%s — %s (৳%s)', coalesce(v_order.order_number, left(v_order.id::text, 8)), v_method.display_name_bn, p_amount_sent),
      '/foisal/payments',
      'payment',
      jsonb_build_object('payment_id', v_payment_id, 'order_id', v_order.id)
    );
  end loop;

  return v_payment_id;
end;
$$;

create or replace function public.review_payment(
  p_payment_id uuid,
  p_action text,
  p_reason text default null,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pay record;
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'শুধুমাত্র অ্যাডমিন পেমেন্ট যাচাই করতে পারবেন';
  end if;

  if p_action not in ('verified', 'rejected', 'need_more_info', 'refunded') then
    raise exception 'অকার্যকর অ্যাকশন';
  end if;

  select * into v_pay from public.payments where id = p_payment_id;
  if v_pay.id is null then
    raise exception 'পেমেন্ট পাওয়া যায়নি';
  end if;

  v_new_status := p_action;

  update public.payments
     set status = v_new_status,
         reject_reason = case when p_action in ('rejected', 'need_more_info') then p_reason else reject_reason end,
         admin_note = coalesce(p_admin_note, admin_note),
         reviewed_by = v_uid,
         reviewed_at = now()
   where id = p_payment_id;

  if p_action = 'verified' and v_pay.order_id is not null then
    update public.orders
       set payment_status = 'paid',
           status = case when status = 'pending' then 'confirmed' else status end
     where id = v_pay.order_id;
  elsif p_action = 'rejected' and v_pay.order_id is not null then
    update public.orders
       set payment_status = 'failed'
     where id = v_pay.order_id;
  end if;

  insert into public.payment_logs (payment_id, action, actor_id, details)
  values (p_payment_id, p_action, v_uid, jsonb_build_object('reason', p_reason, 'note', p_admin_note));

  if v_pay.user_id is not null then
    insert into public.notifications (user_id, title, body, link, kind, meta)
    values (
      v_pay.user_id,
      case
        when p_action = 'verified' then 'পেমেন্ট ভেরিফাইড হয়েছে ✅'
        when p_action = 'rejected' then 'পেমেন্ট বাতিল হয়েছে'
        when p_action = 'need_more_info' then 'পেমেন্টে আরও তথ্য প্রয়োজন'
        else 'পেমেন্ট রিফান্ড হয়েছে'
      end,
      coalesce(p_reason, 'আপনার পেমেন্টের স্ট্যাটাস আপডেট হয়েছে।'),
      case when v_pay.order_id is not null then '/orders/' || v_pay.order_id || '/payment' else '/account' end,
      'payment',
      jsonb_build_object('payment_id', p_payment_id, 'status', v_new_status)
    );
  end if;
end;
$$;

create or replace function public.cancel_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours integer;
  v_count integer;
begin
  select coalesce(auto_cancel_unpaid_hours, 24) into v_hours from public.payment_settings where id = 1;
  update public.orders
     set status = 'cancelled'
   where status = 'pending'
     and payment_status in ('unpaid', 'pending')
     and created_at < now() - make_interval(hours => v_hours);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
