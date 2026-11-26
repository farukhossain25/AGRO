-- ============================================================================
-- 25_coupons_referrals_wallet.sql
-- ============================================================================
-- WHAT IT DOES
--   Three connected features, all admin-controlled:
--
--   1. COUPON ADDITIONS
--        • per_user_limit really enforced (a coupon can be used N times by one
--          account, not just once)
--        • audience / influencer assignment: a coupon can be restricted to a
--          named set of accounts, or open to everybody
--        • coupon_redemptions — one row per use, so we can answer "who used
--          what", refuse a repeat use, and show the customer only the coupons
--          that are still available to *them*
--
--   2. REFERRAL PROGRAMME
--        • every profile gets a short referral code (auto-created)
--        • profiles.referred_by points at the inviter
--        • wallet_balance / wallet_earned / wallet_spent on profiles
--
--   3. WALLET (virtual balance)
--        • wallet_transactions — an append-only ledger; the balance on
--          profiles is the running total, kept in sync by the place_order RPC
--        • at checkout a customer may pay part of the total from the wallet,
--          up to `wallet_max_percent` of the order (default 30 %)
--        • referral commission is credited to the inviter as a percentage of
--          the invitee's first delivered order
--
--   Every knob lives in public.site_settings under the key 'referral', so the
--   admin panel changes behaviour without a deploy:
--
--     { "enabled": true, "commission_percent": 5, "wallet_max_percent": 30,
--       "credit_on": "delivered", "min_order": 300 }
--
--   SAFE TO RE-RUN: every statement is if-not-exists / create-or-replace.
--   Run it AFTER 24_camera_cloud_bridge.sql.
-- ============================================================================

-- --------------------------------------------------------------- 1. coupons --
alter table public.coupons
  add column if not exists audience       text not null default 'all',
  add column if not exists funder_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists funder_note    text,
  add column if not exists is_referral    boolean not null default false;

comment on column public.coupons.audience is
  'all = anybody may use it; assigned = only accounts listed in coupon_audiences; '
  'influencer = the funder plus the accounts it was handed to';
comment on column public.coupons.funder_user_id is
  'Who pays for the discount — an influencer account. Informational only; the '
  'store always absorbs the discount at checkout.';
comment on column public.coupons.is_referral is
  'True for the auto-created codes (a brand-wide share code is not needed).';

-- Only these values are meaningful; the check is added separately so the file
-- stays re-runnable on databases that already have the column.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coupons_audience_check'
  ) then
    alter table public.coupons
      add constraint coupons_audience_check
      check (audience in ('all', 'assigned', 'influencer'));
  end if;
end $$;

-- How much of an order was paid from the wallet. Kept on the order so the
-- invoice, the tracking page and the admin order view all agree.
alter table public.orders
  add column if not exists wallet_used numeric(12, 2) not null default 0;

create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete cascade,
  -- nullable: a guest checkout has no profile row, and the use must still be
  -- counted exactly once against usage_limit even then.
  user_id     uuid references public.profiles (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  order_no    text,
  amount      numeric(12, 2) not null default 0,
  created_at  timestamptz not null default now()
);
-- A guest checkout has no profile: the redemption row still has to exist so
-- usage_limit is counted exactly once. Enforced here as well because the
-- create-table above is a no-op on an existing database.
alter table public.coupon_redemptions alter column user_id drop not null;

create index if not exists coupon_redemptions_coupon_user
  on public.coupon_redemptions (coupon_id, user_id);
create index if not exists coupon_redemptions_user
  on public.coupon_redemptions (user_id, created_at desc);

-- Who may use an "assigned" / "influencer" coupon.
create table if not exists public.coupon_audiences (
  coupon_id  uuid not null references public.coupons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
create index if not exists coupon_audiences_user on public.coupon_audiences (user_id);

-- ------------------------------------------------------- 2. referral + wallet --
alter table public.profiles
  add column if not exists referral_code    text,
  add column if not exists referred_by      uuid references public.profiles (id) on delete set null,
  add column if not exists referred_at      timestamptz,
  add column if not exists wallet_balance   numeric(12, 2) not null default 0,
  add column if not exists wallet_earned    numeric(12, 2) not null default 0,
  add column if not exists wallet_spent     numeric(12, 2) not null default 0;

create unique index if not exists profiles_referral_code_key
  on public.profiles (upper(referral_code));
create index if not exists profiles_referred_by on public.profiles (referred_by);

comment on column public.profiles.wallet_balance is
  'Spendable store credit in Taka. Only place_order() may debit it; only the '
  'referral trigger or an admin adjustment may credit it.';

create table if not exists public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('referral', 'order', 'refund', 'admin', 'bonus')),
  amount      numeric(12, 2) not null,          -- positive = credit, negative = debit
  balance_after numeric(12, 2) not null,
  order_id    uuid references public.orders (id) on delete set null,
  order_no    text,
  note_bn     text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists wallet_transactions_user
  on public.wallet_transactions (user_id, created_at desc);

-- A commission is paid per ORDER, not per delivery click: retries, a status
-- flip-flop or two admins pressing at once must never pay twice.
create unique index if not exists wallet_transactions_referral_once
  on public.wallet_transactions (order_id)
  where kind = 'referral' and order_id is not null;

-- ------------------------------------------------------------- 3. defaults --
insert into public.site_settings (key, value)
values (
  'referral',
  jsonb_build_object(
    'enabled', true,
    'commission_percent', 5,
    'wallet_max_percent', 30,
    'credit_on', 'delivered',
    'min_order', 300,
    'commission_base', 'subtotal'
  )
)
on conflict (key) do nothing;

-- ← already-installed database?  This file is re-runnable: the merge below
--   adds the two switches introduced in revision 2 without touching values
--   the owner has already changed.
update public.site_settings
   set value = value
     || jsonb_build_object(
          'commission_base', coalesce(value ->> 'commission_base', 'subtotal')
        )
 where key = 'referral';

-- ------------------------------------------------- 4. code generation helper --
-- 8 characters, no I/O/0/1 so it can be read over the phone.
create or replace function public.gen_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_try integer := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.profiles where upper(referral_code) = v_code
    );
    if v_try > 40 then
      -- Extremely unlikely; fall back to something certainly unique.
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit;
    end if;
  end loop;
  return v_code;
end;
$$;

-- Backfill: every existing profile gets a code.
update public.profiles
   set referral_code = public.gen_referral_code()
 where referral_code is null;

-- New profiles get one automatically (does not touch handle_new_user, so it
-- keeps working even if the auth trigger was replaced by a newer migration).
create or replace function public.assign_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.gen_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_referral_code on public.profiles;
create trigger trg_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_referral_code();

-- --------------------------------------------------- 5. wallet ledger helper --
-- The single place that moves money in or out of a wallet. Keeps
-- profiles.wallet_* in step with the ledger and refuses to go negative.
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
  v_new numeric;
begin
  if p_user is null or coalesce(p_amount, 0) = 0 then
    return null;
  end if;

  select wallet_balance into v_balance from public.profiles where id = p_user for update;
  if not found then
    return null;
  end if;

  v_balance := coalesce(v_balance, 0);
  v_new := v_balance + p_amount;
  if v_new < 0 then
    raise exception 'WALLET_INSUFFICIENT';
  end if;

  update public.profiles
     set wallet_balance = v_new,
         wallet_earned  = wallet_earned  + greatest(p_amount, 0),
         wallet_spent   = wallet_spent   + greatest(-p_amount, 0),
         updated_at     = now()
   where id = p_user;

  insert into public.wallet_transactions
    (user_id, kind, amount, balance_after, order_id, order_no, note_bn, created_by)
  values
    (p_user, p_kind, p_amount, v_new, p_order, p_order_no, p_note, p_by);

  return v_new;
end;
$$;

-- ------------------------------------- 6. referral commission per order ----
-- WHAT CHANGED IN REVISION 2
--   • The inviter now earns on EVERY delivered order of the person they
--     invited — not just the first one.
--   • The taka base can be the product value (default) or the actual amount
--     the customer paid; both are one switch in the admin panel.
--   • The percentage is whatever the admin set (5 %, 10 %, …) — 0 turns it off.
--
-- Never throws: a missing setting or a zero percentage must not block a
-- delivery update. Paying twice for the same order is impossible — the unique
-- index `wallet_transactions_referral_once` makes the second INSERT fail,
-- which the trigger swallows as "already paid".
create or replace function public.credit_referral(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_cfg jsonb;
  v_pct numeric;
  v_min numeric;
  v_base_mode text;
  v_base numeric;
  v_inviter uuid;
  v_amount numeric;
  v_credit_on text;
  v_rows integer := 0;
begin
  select * into v_order from public.orders where id = p_order;
  if not found or v_order.user_id is null then
    return;
  end if;

  select value into v_cfg from public.site_settings where key = 'referral';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  if coalesce((v_cfg ->> 'enabled')::boolean, false) is false then
    return;
  end if;

  /* `credit_on` is delivered | paid. The trigger fires on both transitions,
     and the guard below keeps it to one payment per order. */
  v_credit_on := coalesce(v_cfg ->> 'credit_on', 'delivered');
  if v_credit_on = 'paid' and v_order.payment_status <> 'paid' then
    return;
  end if;
  if v_credit_on = 'delivered' and v_order.status <> 'delivered' then
    return;
  end if;

  v_pct := coalesce((v_cfg ->> 'commission_percent')::numeric, 0);
  v_min := coalesce((v_cfg ->> 'min_order')::numeric, 0);
  if v_pct <= 0 then
    return;
  end if;

  /* Who invited this customer? Every shared link — the profile share link and
     every shared PRODUCT link — carries `?ref=CODE`. A normal code was stored
     as `referred_by` at signup. An influencer token is mapped here instead, so
     a customer who used the influencer's promo code still credits them even if
     the link was opened later. */
  select referred_by into v_inviter from public.profiles where id = v_order.user_id;
  if v_inviter is null then
    -- the customer may have paid with the influencer's promo code instead
    v_inviter := public.referrer_for_token(v_order.coupon_code, v_order.user_id);
  end if;
  if v_inviter is null or v_inviter = v_order.user_id then
    return;
  end if;

  /* The base. `commission_base` = 'subtotal' (default, product value) or
     'paid' (what the customer actually paid after discounts and wallet). */
  v_base_mode := coalesce(v_cfg ->> 'commission_base', 'subtotal');
  v_base := case
              when v_base_mode = 'paid'
                then greatest(0, coalesce(v_order.total, 0) - coalesce(v_order.wallet_used, 0))
              else coalesce(v_order.subtotal, 0)
            end;
  if v_base < v_min then
    return;
  end if;

  v_amount := round(v_base * v_pct / 100.0, 2);
  if v_amount <= 0 then
    return;
  end if;

  -- Ledger first: its unique index is the "paid once per order" lock.
  insert into public.wallet_transactions
    (user_id, kind, amount, balance_after, order_id, order_no, note_bn)
  select v_inviter, 'referral', v_amount,
         coalesce((select wallet_balance from public.profiles where id = v_inviter), 0) + v_amount,
         v_order.id, v_order.order_no,
         'রেফারেল কমিশন (' || v_order.order_no || ')'
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return;  -- this order was already credited
  end if;

  -- …then move the balance and keep the profile totals honest.
  update public.profiles
     set wallet_balance = coalesce(wallet_balance, 0) + v_amount,
         wallet_earned  = coalesce(wallet_earned, 0) + v_amount,
         updated_at     = now()
   where id = v_inviter;

  insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
  values (
    v_inviter, 'user', 'premium',
    'রেফারেল কমিশন যোগ হয়েছে',
    '৳' || v_amount::text || ' আপনার ভার্চুয়াল ব্যালেন্সে যোগ হয়েছে (' || v_order.order_no || ')।',
    '/account/wallet',
    jsonb_build_object('amount', v_amount, 'order_no', v_order.order_no)
  );
exception
  when others then
    raise warning 'credit_referral failed for %: %', p_order, sqlerrm;
end;
$$;

-- Called from the delivery path (app/api/foisal/parcels/deliver and the admin
-- order manager both set status = 'delivered').
create or replace function public.on_order_delivered()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Credit when the order reaches the configured moment. credit_referral()
  -- re-reads the setting, and the unique index on the ledger keeps it to one
  -- payment per order, so firing on both transitions is safe.
  if (new.status = 'delivered' and coalesce(old.status, '') <> 'delivered')
     or (new.payment_status = 'paid' and coalesce(old.payment_status, '') <> 'paid') then
    perform public.credit_referral(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_delivered on public.orders;
create trigger trg_order_delivered
  after update of status, payment_status on public.orders
  for each row execute function public.on_order_delivered();

-- --------------------------------------------------------- 7. coupon checks --
-- "May this user use this coupon right now?" — one function, used by the
-- checkout validator, place_order and the customer's coupon list.
create or replace function public.coupon_allows_user(p_coupon uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.coupons%rowtype;
  v_used integer;
begin
  select * into v from public.coupons where id = p_coupon;
  if not found or not v.is_active then
    return false;
  end if;

  if v.starts_at is not null and v.starts_at > now() then return false; end if;
  if v.expires_at is not null and v.expires_at < now() then return false; end if;
  if v.usage_limit is not null and coalesce(v.used_count, 0) >= v.usage_limit then
    return false;
  end if;

  /* audience:
       all        → anybody
       influencer → anybody too — the influencer hands the code out freely,
                    and the admin does not have to know the recipients
       assigned   → only the listed accounts, plus the funder himself
     (the `all` branch is the cheapest, so it is checked first) */
  if coalesce(v.audience, 'all') = 'assigned' then
    if p_user is null then return false; end if;
    if not exists (
      select 1 from public.coupon_audiences where coupon_id = v.id and user_id = p_user
    ) and coalesce(v.funder_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_user then
      return false;
    end if;
  end if;

  -- per-user cap — count this account's redemptions. Guests have no profile,
  -- so they are limited only by the coupon-wide usage_limit.
  if p_user is not null and coalesce(v.per_user_limit, 1) > 0 then
    select count(*) into v_used
      from public.coupon_redemptions
     where coupon_id = v.id and user_id = p_user;
    if v_used >= v.per_user_limit then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- Why a coupon was refused, as ONE code the UI can translate. place_order
-- raises this directly, so a repeat use says "you already used this" instead
-- of collapsing into a generic "invalid coupon".
create or replace function public.coupon_refusal(p_coupon uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.coupons%rowtype;
  v_used integer;
begin
  select * into v from public.coupons where id = p_coupon;
  if not found or not v.is_active then return 'COUPON_INVALID'; end if;
  if v.starts_at is not null and v.starts_at > now() then return 'COUPON_INVALID'; end if;
  if v.expires_at is not null and v.expires_at < now() then return 'COUPON_INVALID'; end if;
  if v.usage_limit is not null and coalesce(v.used_count, 0) >= v.usage_limit then
    return 'COUPON_INVALID';
  end if;

  -- influencer codes are open (see coupon_allows_user); only `assigned` is a list
  if coalesce(v.audience, 'all') = 'assigned' then
    if p_user is null then return 'COUPON_NOT_FOR_USER'; end if;
    if not exists (
      select 1 from public.coupon_audiences where coupon_id = v.id and user_id = p_user
    ) and coalesce(v.funder_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_user then
      return 'COUPON_NOT_FOR_USER';
    end if;
  end if;

  if p_user is not null and coalesce(v.per_user_limit, 1) > 0 then
    select count(*) into v_used
      from public.coupon_redemptions
     where coupon_id = v.id and user_id = p_user;
    if v_used >= v.per_user_limit then return 'COUPON_USED_BY_USER'; end if;
  end if;

  return 'OK';
end;
$$;

-- ============================================================================
-- 8. place_order — extended with per-user coupons and wallet payment
-- ============================================================================
-- Same signature as before plus p_wallet. The wallet can cover at most
-- `wallet_max_percent` % of the order total (default 30), and never more than
-- the balance. Everything else is the original function, unchanged.
-- ---------------------------------------------------------------------------
-- ⚠️ IMPORTANT — drop the OLD five-argument function first.
-- `create or replace` with an extra parameter would create an OVERLOAD, and
-- PostgREST then answers "could not choose the best candidate function".
drop function if exists public.place_order(uuid, jsonb, jsonb, text, text);

create or replace function public.place_order(
  p_user uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'cod',
  p_coupon text default null,
  p_wallet numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_product public.products%rowtype;
  v_combo public.combos%rowtype;
  v_qty integer;
  v_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_total numeric := 0;
  v_has_combo boolean := false;
  v_line jsonb;
  v_seller uuid;
  v_seller_pct numeric;
  v_group record;
  v_sub_no text;
  v_sub_map jsonb := '{}'::jsonb;
  v_order_id uuid;
  v_order_no text;
  v_method public.payment_methods%rowtype;
  v_coupon public.coupons%rowtype;
  v_have_coupon boolean := false;
  v_refusal   text;
  v_zone public.delivery_charges%rowtype;
  v_scope text;
  v_settings jsonb;
  v_free_over numeric;
  v_eta text := '২-৩ দিন';
  v_admin record;
  v_status public.payment_status := 'pending';
  v_customer jsonb := coalesce(p_customer, '{}'::jsonb);
  v_method_code text := lower(coalesce(nullif(p_payment_method, ''), 'cod'));
  v_remaining integer;
  v_ref jsonb;
  v_wallet_pct numeric;
  v_wallet_use numeric := 0;
  v_wallet_balance numeric := 0;
  v_method_floor numeric := 0;
begin
  -- -------------------------------------------------------------- customer --
  if nullif(trim(coalesce(v_customer ->> 'customer_name', '')), '') is null
     or nullif(trim(coalesce(v_customer ->> 'customer_phone', '')), '') is null
     or nullif(trim(coalesce(v_customer ->> 'address', '')), '') is null then
    raise exception 'CUSTOMER_INCOMPLETE';
  end if;

  -- ------------------------------------------------------------------ lines --
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_qty := greatest(1, least(99, coalesce((v_item ->> 'quantity')::int, 1)));

    if (v_item ->> 'kind') = 'combo' then
      select * into v_combo from public.combos
       where id = nullif(v_item ->> 'id', '')::uuid and is_active
       limit 1;
      if not found then
        raise exception 'PRODUCT_UNAVAILABLE:%', coalesce(v_item ->> 'name', '');
      end if;
      v_price := v_combo.price;
      v_subtotal := v_subtotal + v_price * v_qty;
      v_has_combo := true;
      v_lines := v_lines || jsonb_build_object(
        'combo_id', v_combo.id, 'product_id', null, 'seller_id', null,
        'name_bn', v_combo.name_bn, 'unit', 'প্যাকেজ',
        'price', v_price, 'quantity', v_qty, 'image', v_combo.image
      );
    else
      -- guarded stock reservation
      update public.products
         set stock = stock - v_qty
       where id = nullif(v_item ->> 'id', '')::uuid
         and is_active and stock >= v_qty
       returning * into v_product;

      if not found then
        if exists (select 1 from public.products where id = nullif(v_item ->> 'id', '')::uuid) then
          raise exception 'OUT_OF_STOCK:%', coalesce(v_item ->> 'name', '');
        end if;
        raise exception 'PRODUCT_UNAVAILABLE:%', coalesce(v_item ->> 'name', '');
      end if;

      v_price := v_product.price;
      v_subtotal := v_subtotal + v_price * v_qty;
      select seller_id into v_seller from public.products where id = v_product.id;
      v_lines := v_lines || jsonb_build_object(
        'combo_id', null, 'product_id', v_product.id, 'seller_id', v_seller,
        'name_bn', v_product.name_bn, 'unit', v_product.unit,
        'price', v_price, 'quantity', v_qty, 'image', v_product.image
      );
    end if;
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  -- ---------------------------------------------------------------- coupon ---
  if nullif(trim(coalesce(p_coupon, '')), '') is not null then
    select * into v_coupon from public.coupons
     where upper(code) = upper(trim(p_coupon))
     limit 1;

    if not found then
      raise exception 'COUPON_INVALID';
    end if;

    -- One code, one reason. coupon_refusal() is the same function the
    -- validator uses, so the browser and the transaction agree.
    v_refusal := public.coupon_refusal(v_coupon.id, p_user);
    if v_refusal <> 'OK' then
      raise exception '%', v_refusal;
    end if;

    if v_subtotal < v_coupon.min_order then
      raise exception 'COUPON_MIN_ORDER:%', v_coupon.min_order;
    end if;

    v_have_coupon := true;
    if v_coupon.type = 'percent' then
      v_discount := round(v_subtotal * v_coupon.value / 100.0, 2);
      if v_coupon.max_discount is not null then
        v_discount := least(v_discount, v_coupon.max_discount);
      end if;
    else
      v_discount := least(v_coupon.value, v_subtotal);
    end if;
  end if;

  -- -------------------------------------------------------------- delivery ---
  select value into v_settings from public.site_settings where key = 'delivery';
  v_settings := coalesce(v_settings, '{}'::jsonb);

  if v_has_combo then
    v_delivery := 0;
    v_eta := '১ দিন';
  else
    select * into v_zone from public.delivery_charges
     where is_active and (district = v_customer ->> 'district')
     limit 1;

    v_scope := case when coalesce(v_customer ->> 'division', '') = 'ঢাকা' then 'inside_dhaka' else 'outside_dhaka' end;
    v_free_over := coalesce(v_zone.free_over,
                            (v_settings ->> 'free_over')::numeric,
                            1200);
    v_eta := coalesce(v_zone.eta_days, case when v_scope = 'inside_dhaka' then 'আজ' else '২-৩ দিন' end);

    if v_subtotal >= v_free_over then
      v_delivery := 0;
    elsif v_zone.id is not null then
      v_delivery := v_zone.charge;
    elsif v_scope = 'inside_dhaka' then
      v_delivery := coalesce((v_settings ->> 'inside_dhaka')::numeric, 60);
    else
      v_delivery := coalesce((v_settings ->> 'outside_dhaka')::numeric, 120);
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery - v_discount);

  /* An "online" method (bKash/Nagad/…) usually has a floor — e.g. ৳50. If the
     wallet already covers most of this order, what is left for the method
     falls under that floor; the customer must then pay the floor itself
     through the method and take less from the wallet. Cash-on-delivery has
     min_amount = 0 and is unaffected. */
  if coalesce(p_wallet, 0) > 0 and p_user is not null then
    select coalesce(min_amount, 0) into v_method_floor
      from public.payment_methods where code = v_method_code;
    v_method_floor := coalesce(v_method_floor, 0);

    if v_method_floor > 0 and (v_total - least(coalesce(p_wallet, 0), v_total)) < v_method_floor then
      p_wallet := least(coalesce(p_wallet, 0), greatest(0, v_total - v_method_floor));
    end if;
  end if;

  -- ---------------------------------------------------------------- wallet ---
  if coalesce(p_wallet, 0) > 0 and p_user is not null then
    select value into v_ref from public.site_settings where key = 'referral';
    v_ref := coalesce(v_ref, '{}'::jsonb);
    v_wallet_pct := coalesce((v_ref ->> 'wallet_max_percent')::numeric, 30);

    select coalesce(wallet_balance, 0) into v_wallet_balance
      from public.profiles where id = p_user for update;

    v_wallet_use := least(
      coalesce(p_wallet, 0),
      v_wallet_balance,
      round(v_total * v_wallet_pct / 100.0, 2)
    );
    if v_wallet_use < 0 then
      v_wallet_use := 0;
    end if;
  end if;

  -- ----------------------------------------------------------------- order ---
  v_order_no := public.gen_order_no();
  insert into public.orders (
    order_no, user_id, customer_name, customer_phone, customer_email,
    division, district, upazila, address, delivery_note,
    subtotal, delivery_charge, discount, total, wallet_used, coupon_code,
    payment_method, payment_status, status, eta_days
  ) values (
    v_order_no, p_user,
    v_customer ->> 'customer_name',
    v_customer ->> 'customer_phone',
    nullif(v_customer ->> 'email', ''),
    coalesce(v_customer ->> 'division', 'ঢাকা'),
    coalesce(v_customer ->> 'district', 'ঢাকা'),
    coalesce(v_customer ->> 'upazila', ''),
    v_customer ->> 'address',
    nullif(v_customer ->> 'delivery_note', ''),
    v_subtotal, v_delivery, v_discount, v_total, v_wallet_use,
    case when v_have_coupon then upper(trim(p_coupon)) else null end,
    v_method.code, v_status, 'received', v_eta
  )
  returning id into v_order_id;

  -- order_items
  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    insert into public.order_items (
      order_id, sub_order_id, product_id, seller_id, name_bn, unit, price, quantity, image
    ) values (
      v_order_id,
      null,
      nullif(v_line ->> 'product_id', '')::uuid,
      nullif(v_line ->> 'seller_id', '')::uuid,
      v_line ->> 'name_bn',
      v_line ->> 'unit',
      (v_line ->> 'price')::numeric,
      (v_line ->> 'quantity')::int,
      v_line ->> 'image'
    );
  end loop;

  -- -------------------------------------------------------------- coupon use -
  if v_have_coupon then
    update public.coupons
       set used_count = used_count + 1, updated_at = now()
     where id = v_coupon.id;

    -- written for guests too (user_id null) so usage_limit stays exact
    insert into public.coupon_redemptions
      (coupon_id, user_id, order_id, order_no, amount)
    values
      (v_coupon.id, p_user, v_order_id, v_order_no, v_discount);
  end if;

  -- ------------------------------------------------------------ wallet debit -
  if v_wallet_use > 0 then
    perform public.wallet_apply(
      p_user, 'order', -v_wallet_use, v_order_id, v_order_no,
      'অর্ডারে ওয়ালেট ব্যবহার', null
    );
  end if;

  -- ----------------------------------------------------------------- parcel --
  insert into public.parcels (order_id, order_no, qr_token)
  values (v_order_id, v_order_no, encode(extensions.gen_random_bytes(16), 'hex'))
  on conflict (order_id) do nothing;

  -- ---------------------------------------------------------- notifications --
  if p_user is not null then
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (
      p_user, 'user', 'order',
      'অর্ডার #' || v_order_no || ' গ্রহণ করা হয়েছে',
      'আমরা আপনার অর্ডার পেয়েছি। স্ট্যাটাস দেখতে ট্র্যাক পেজে যান।',
      '/track?order=' || v_order_no,
      jsonb_build_object('order_no', v_order_no)
    );
  end if;

  for v_admin in select id from public.profiles where role = 'admin' and is_active
  loop
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (
      v_admin.id, 'admin', 'order',
      'নতুন অর্ডার #' || v_order_no,
      (v_customer ->> 'customer_name') || ' — ' || v_total::text || ' টাকা',
      '/foisal/orders',
      jsonb_build_object('order_no', v_order_no, 'total', v_total)
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal', v_subtotal,
    'delivery_charge', v_delivery,
    'discount', v_discount,
    'wallet_used', v_wallet_use,
    'total', v_total,
    'method_code', v_method.code,
    'eta_days', v_eta,
    'item_count', jsonb_array_length(v_lines)
  );
end;
$$;

-- --------------------------------------------------- 9. referral redemption --
-- Called once, right after signup or from the account page: "someone gave me
-- this code". Refuses self-referral, unknown codes and a second attempt.
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

-- The dropped function took its grant with it — restore execution rights for
-- the same roles the original had.
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text, numeric)
  to anon, authenticated, service_role;
grant execute on function public.coupon_allows_user(uuid, uuid)       to anon, authenticated, service_role;
grant execute on function public.coupon_refusal(uuid, uuid)           to anon, authenticated, service_role;
grant execute on function public.apply_referral(uuid, text)           to authenticated, service_role;
grant execute on function public.referrer_for_token(text, uuid)       to anon, authenticated, service_role;

-- ------------------------------------------------- 10. influencer extras ----
-- An influencer promo code is meant to be passed around: the admin does not
-- have to know in advance who will receive it. So an `influencer` code always
-- carries a PUBLIC TOKEN — `?ref=TOKEN` — that the influencer may share with
-- anybody. That token never names the influencer, and it is not a profile
-- referral code: it is looked up on the coupon itself.
alter table public.coupons
  add column if not exists share_token text;

create unique index if not exists coupons_share_token_key
  on public.coupons (upper(share_token))
  where share_token is not null;

-- Fill a token for every influencer code that has none. Deterministic from the
-- uuid so re-running never churns the codes, and revocable by editing the row.
update public.coupons
   set share_token = upper(substr(replace(id::text, '-', ''), 1, 10))
 where audience = 'influencer'
   and coalesce(share_token, '') = '';

-- "Someone arrived with ?ref=XYZ": turn that token into the account the sale
-- should be credited to. Returns null for an unknown/disabled code, and for a
-- customer who redeemed the influencer's own promo code (no self-credit).
create or replace function public.referrer_for_token(p_code text, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_funder uuid;
begin
  if nullif(trim(coalesce(p_code, '')), '') is null then
    return null;
  end if;

  select funder_user_id into v_funder
    from public.coupons
   where upper(share_token) = upper(trim(p_code))
     and audience = 'influencer'
     and is_active
   limit 1;

  if v_funder is null or v_funder = p_user then
    return null;
  end if;

  return v_funder;
end;
$$;

-- ------------------------------------------------------------- 11. RLS ------
alter table public.coupon_redemptions  enable row level security;
alter table public.coupon_audiences    enable row level security;
alter table public.wallet_transactions enable row level security;

-- A customer sees only their own rows; the service role (admin API) bypasses.
drop policy if exists coupon_redemptions_own on public.coupon_redemptions;
create policy coupon_redemptions_own on public.coupon_redemptions
  for select using (auth.uid() = user_id);

drop policy if exists coupon_audiences_own on public.coupon_audiences;
create policy coupon_audiences_own on public.coupon_audiences
  for select using (auth.uid() = user_id);

drop policy if exists wallet_transactions_own on public.wallet_transactions;
create policy wallet_transactions_own on public.wallet_transactions
  for select using (auth.uid() = user_id);

-- ============================================================================
-- VERIFY (run in the SQL editor afterwards; every line should answer true)
-- ----------------------------------------------------------------------------
--   select count(*) filter (where referral_code is null) = 0 as codes_backfilled
--     from public.profiles;
--   select exists (select 1 from public.site_settings where key = 'referral')
--     as referral_settings;
--   select proname from pg_proc
--    where proname in ('wallet_apply','credit_referral','coupon_allows_user',
--                      'coupon_refusal','apply_referral','gen_referral_code',
--                      'assign_referral_code','referrer_for_token')
--    order by proname;   -- 8 rows
--   select count(*) as influencer_share_tokens from public.coupons
--    where audience = 'influencer' and share_token is not null;
-- ============================================================================
