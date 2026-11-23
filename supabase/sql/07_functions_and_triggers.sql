-- ============================================================================
-- 07_functions_and_triggers.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates every database function and trigger the app relies on:
--     • role helpers: has_role(), is_admin(), is_staff(), is_seller()
--     • handle_new_user(): creates the profile row on signup (cannot fail signup)
--     • guard_profile_role(): a user can never promote themselves
--     • set_updated_at() triggers on every table that has updated_at
--     • number generators: order, sub-order, payment, complaint ticket
--     • place_order(): ONE transaction — validate, re-price, reserve stock,
--       create order + items + per-seller sub-orders + payment row + parcel +
--       notifications
--     • approve_payment(): admin-only, verifies a manual payment atomically
--     • recalc_product_rating(): rating aggregate maintained by trigger
--     • product_images / review_photos sync triggers
--     • log_audit(): writes the admin audit trail
--     • login_help(): explains a failed login without leaking anything
--
-- WHEN TO RUN
--   Seventh, after 06_homepage_cms_tables.sql and before 08_rls_policies.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — every function is CREATE OR REPLACE and every trigger is dropped
--   before it is created.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they can read profiles without recursively
-- triggering the profiles RLS policy.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role::text = any (p_roles)
       and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['admin']);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(array['admin', 'manager', 'staff']);
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sellers s
     where s.user_id = auth.uid()
       and s.status = 'approved'
  ) or public.has_role(array['seller']);
$$;

-- ---------------------------------------------------------------------------
-- Signup: mirror auth.users into profiles. NEVER raises — a broken profile
-- must not block account creation; the app repairs a missing row on next load.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.profiles (id, full_name, email, phone, avatar_url)
    values (
      new.id,
      nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ''),
      new.email,
      nullif(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''), ''),
      nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), '')
    )
    on conflict (id) do update
      set email     = coalesce(public.profiles.email, excluded.email),
          full_name = coalesce(public.profiles.full_name, excluded.full_name),
          phone     = coalesce(public.profiles.phone, excluded.phone),
          updated_at = now();
  exception
    when others then
      raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role protection: an authenticated user may edit their own profile, but the
-- privilege columns are admin-only (service role and direct SQL are exempt
-- because auth.uid() is null there).
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_seller is distinct from old.is_seller
       or new.premium_until is distinct from old.premium_until
       or new.is_active is distinct from old.is_active
       or new.mfa_enrolled is distinct from old.mfa_enrolled then
      raise exception 'PROFILE_FIELDS_ADMIN_ONLY';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'addresses', 'site_settings', 'social_links', 'team_members',
    'static_pages', 'seo_meta', 'categories', 'farms', 'cameras', 'sellers',
    'seller_payouts', 'camera_requests', 'products', 'coupons', 'delivery_charges',
    'combos', 'subscription_plans', 'subscriptions', 'cart_items', 'orders',
    'sub_orders', 'payment_methods', 'payments', 'parcels', 'custom_combos',
    'plans', 'user_subscriptions', 'reviews', 'complaints', 'hero_slides',
    'homepage_sections', 'banners', 'menus', 'menu_items', 'blog_posts', 'faq_items'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Human-readable numbers
-- ---------------------------------------------------------------------------
create or replace function public.gen_order_no()
returns text
language plpgsql
volatile
as $$
declare
  seq int;
begin
  select count(*) + 1 into seq from public.orders where created_at::date = current_date;
  return 'BA-' || to_char(now(), 'YYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

create or replace function public.gen_payment_no()
returns text
language plpgsql
volatile
as $$
declare
  seq int;
begin
  select count(*) + 1 into seq from public.payments where created_at::date = current_date;
  return 'PAY-' || to_char(now(), 'YYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- Complaint ticket numbers: CMP-YYMMDD-0001
create or replace function public.set_complaint_ticket()
returns trigger
language plpgsql
as $$
declare
  seq int;
begin
  if new.ticket_no is null or new.ticket_no = '' then
    select count(*) + 1 into seq from public.complaints where created_at::date = current_date;
    new.ticket_no := 'CMP-' || to_char(now(), 'YYMMDD') || '-' || lpad(seq::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complaint_ticket on public.complaints;
create trigger trg_complaint_ticket
  before insert on public.complaints
  for each row execute function public.set_complaint_ticket();

-- ---------------------------------------------------------------------------
-- product_images -> products.images / products.image mirror
-- ---------------------------------------------------------------------------
create or replace function public.sync_product_images(p_product uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_urls text[];
  v_primary text;
begin
  select coalesce(array_agg(pi.url order by pi.is_primary desc, pi.sort_order asc, pi.created_at asc), '{}'::text[]),
         (array_agg(pi.url order by pi.is_primary desc, pi.sort_order asc, pi.created_at asc))[1]
    into v_urls, v_primary
    from public.product_images pi
   where pi.product_id = p_product;

  update public.products
     set images = v_urls,
         image = case when coalesce(image, '') = '' then v_primary else image end
   where id = p_product;
end;
$$;

create or replace function public.trg_product_images_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_product_images(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_product_images_sync on public.product_images;
create trigger trg_product_images_sync
  after insert or update or delete on public.product_images
  for each row execute function public.trg_product_images_sync();

-- ---------------------------------------------------------------------------
-- review_photos -> reviews.photos mirror
-- ---------------------------------------------------------------------------
create or replace function public.trg_review_photos_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reviews r
     set photos = coalesce((
           select array_agg(rp.url order by rp.sort_order, rp.created_at)
             from public.review_photos rp
            where rp.review_id = coalesce(new.review_id, old.review_id)
         ), '{}'::text[])
   where r.id = coalesce(new.review_id, old.review_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_photos_sync on public.review_photos;
create trigger trg_review_photos_sync
  after insert or update or delete on public.review_photos
  for each row execute function public.trg_review_photos_sync();

-- ---------------------------------------------------------------------------
-- Rating aggregates
-- ---------------------------------------------------------------------------
create or replace function public.recalc_product_rating(p_product uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avg numeric;
  v_count integer;
begin
  if p_product is null then return; end if;

  select coalesce(round(avg(r.rating)::numeric, 1), 0), count(*)
    into v_avg, v_count
    from public.reviews r
   where r.product_id = p_product
     and r.status = 'published';

  update public.products
     set rating = v_avg,
         review_count = v_count,
         updated_at = now()
   where id = p_product;
end;
$$;

create or replace function public.trg_reviews_recalc()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.recalc_product_rating(coalesce(new.product_id, old.product_id));
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.recalc_product_rating(old.product_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reviews_recalc on public.reviews;
create trigger trg_reviews_recalc
  after insert or update of rating, status, product_id or delete on public.reviews
  for each row execute function public.trg_reviews_recalc();

-- ---------------------------------------------------------------------------
-- Audit helper — callable from RPCs and from the app (service role).
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(
  p_actor uuid,
  p_action text,
  p_entity text default null,
  p_entity_id text default null,
  p_meta jsonb default '{}'::jsonb,
  p_diff jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_role text;
begin
  begin
    select email, role::text into v_email, v_role from public.profiles where id = p_actor;
    insert into public.audit_log (actor_id, actor_email, actor_role, action, entity, entity_id, diff, meta)
    values (p_actor, v_email, v_role, p_action, p_entity, p_entity_id, p_diff, coalesce(p_meta, '{}'::jsonb));
  exception
    when others then
      raise warning 'log_audit failed: %', sqlerrm;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order() — the ONLY way an order is created.
--   p_user     : auth user id or null for a guest checkout
--   p_customer : {customer_name, phone, email, division, district, upazila, address, delivery_note}
--   p_items    : [{id|product_id, kind, quantity}]
--   returns    : {order_id, order_no, subtotal, delivery_charge, discount, total,
--                 payment_no, payment_id, eta_days, item_count}
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_user uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'cod',
  p_coupon text default null
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
  v_payment_id uuid;
  v_payment_no text;
  v_method public.payment_methods%rowtype;
  v_coupon public.coupons%rowtype;
  v_have_coupon boolean := false;
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
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;
  -- the app posts `phone`; older callers posted `customer_phone` — accept both
  v_customer := v_customer || jsonb_build_object(
    'customer_phone', coalesce(nullif(v_customer ->> 'customer_phone', ''), v_customer ->> 'phone', '')
  );

  if coalesce(v_customer ->> 'customer_name', '') = ''
     or coalesce(v_customer ->> 'customer_phone', '') = ''
     or coalesce(v_customer ->> 'address', '') = '' then
    raise exception 'CUSTOMER_INCOMPLETE';
  end if;

  -- payment method must exist and be enabled (cash on delivery is a method row too)
  select * into v_method from public.payment_methods
   where lower(code) = v_method_code and is_active
   limit 1;
  if not found then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;

  -- ---------------------------------------------------------------- lines ---
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, least(99, coalesce((v_item ->> 'quantity')::int, 1)));

    if coalesce(v_item ->> 'kind', 'product') = 'combo' then
      select * into v_combo from public.combos
       where id = nullif(v_item ->> 'id', '')::uuid and is_active
       limit 1;
      if not found then
        raise exception 'COMBO_UNAVAILABLE:%', coalesce(v_item ->> 'id', '');
      end if;
      v_has_combo := true;
      v_price := v_combo.price;
      v_lines := v_lines || jsonb_build_object(
        'kind', 'combo',
        'product_id', null,
        'seller_id', null,
        'name_bn', v_combo.name_bn,
        'unit', 'বক্স',
        'price', v_price,
        'quantity', v_qty,
        'image', v_combo.image
      );
      v_subtotal := v_subtotal + v_price * v_qty;
    else
      select * into v_product from public.products
       where id = nullif(coalesce(v_item ->> 'id', v_item ->> 'product_id'), '')::uuid
       limit 1;
      if not found then
        raise exception 'PRODUCT_UNAVAILABLE:%', coalesce(v_item ->> 'id', '');
      end if;
      if not v_product.is_active or v_product.approval_status <> 'approved' then
        raise exception 'PRODUCT_UNAVAILABLE:%', v_product.name_bn;
      end if;

      -- reserve stock atomically; the whole transaction rolls back on failure
      update public.products
         set stock = stock - v_qty, updated_at = now()
       where id = v_product.id and stock >= v_qty;
      if not found then
        raise exception 'OUT_OF_STOCK:%', v_product.name_bn;
      end if;

      v_lines := v_lines || jsonb_build_object(
        'kind', 'product',
        'product_id', v_product.id,
        'seller_id', v_product.seller_id,
        'name_bn', v_product.name_bn,
        'unit', v_product.unit,
        'price', v_product.price,
        'quantity', v_qty,
        'image', v_product.image
      );
      v_subtotal := v_subtotal + v_product.price * v_qty;
    end if;
  end loop;

  -- ---------------------------------------------------------------- coupon ---
  if nullif(trim(coalesce(p_coupon, '')), '') is not null then
    select * into v_coupon from public.coupons
     where upper(code) = upper(trim(p_coupon))
       and is_active
     limit 1;

    if found
       and (v_coupon.starts_at is null or v_coupon.starts_at <= now())
       and (v_coupon.expires_at is null or v_coupon.expires_at >= now())
       and (v_coupon.usage_limit is null or v_coupon.used_count < v_coupon.usage_limit) then
      if v_subtotal >= v_coupon.min_order then
        v_have_coupon := true;
        if v_coupon.type = 'percent' then
          v_discount := round(v_subtotal * v_coupon.value / 100.0, 2);
          if v_coupon.max_discount is not null then
            v_discount := least(v_discount, v_coupon.max_discount);
          end if;
        else
          v_discount := least(v_coupon.value, v_subtotal);
        end if;
      else
        raise exception 'COUPON_MIN_ORDER:%', v_coupon.min_order;
      end if;
    else
      raise exception 'COUPON_INVALID';
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

  -- ----------------------------------------------------------------- order ---
  v_order_no := public.gen_order_no();
  insert into public.orders (
    order_no, user_id, customer_name, customer_phone, customer_email,
    division, district, upazila, address, delivery_note,
    subtotal, delivery_charge, discount, total, coupon_code,
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
    v_subtotal, v_delivery, v_discount, v_total,
    case when v_have_coupon then upper(trim(p_coupon)) else null end,
    v_method.code, v_status, 'received', v_eta
  )
  returning id into v_order_id;

  -- --------------------------------------------------------- sub-orders ------
  for v_group in
    select (l ->> 'seller_id')::uuid as seller_id, sum((l ->> 'price')::numeric * (l ->> 'quantity')::int) as gross
      from jsonb_array_elements(v_lines) l
     where nullif(l ->> 'seller_id', '') is not null
     group by 1
  loop
    v_seller_pct := null;
    select commission_percent into v_seller_pct from public.sellers where id = v_group.seller_id;
    if v_seller_pct is null then
      v_seller_pct := coalesce(
        (select (value ->> 'default_commission_percent')::numeric from public.site_settings where key = 'seller'),
        10
      );
    end if;

    v_sub_no := v_order_no || '-' || upper(substr(replace(v_group.seller_id::text, '-', ''), 1, 4));

    insert into public.sub_orders (
      order_id, sub_no, seller_id, farm_id, seller_name, seller_phone,
      subtotal, commission, seller_earning, status
    )
    select v_order_id, v_sub_no, s.id, s.farm_id, s.name_bn, s.phone,
           v_group.gross,
           round(v_group.gross * coalesce(v_seller_pct, 10) / 100.0, 2),
           v_group.gross - round(v_group.gross * coalesce(v_seller_pct, 10) / 100.0, 2),
           'received'
      from public.sellers s where s.id = v_group.seller_id;

    v_sub_map := v_sub_map || jsonb_build_object(v_group.seller_id::text, v_sub_no);
  end loop;

  -- ---------------------------------------------------------- order items ----
  for v_line in select * from jsonb_array_elements(v_lines)
  loop
    insert into public.order_items (
      order_id, sub_order_id, product_id, seller_id, name_bn, unit, price, quantity, image
    ) values (
      v_order_id,
      (select id from public.sub_orders
        where order_id = v_order_id
          and seller_id = nullif(v_line ->> 'seller_id', '')::uuid
        limit 1),
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
    update public.coupons set used_count = used_count + 1, updated_at = now() where id = v_coupon.id;
  end if;

  -- ---------------------------------------------------------------- payment --
  if v_method.code <> 'cod' and v_method.kind <> 'cod' then
    v_payment_no := public.gen_payment_no();
    insert into public.payments (
      payment_no, user_id, purpose, order_id, method_id, method_code, method_name_bn,
      expected_amount, amount, status, meta
    ) values (
      v_payment_no, p_user, 'order', v_order_id, v_method.id, v_method.code, v_method.name_bn,
      v_total, v_total, 'pending', jsonb_build_object('auto_created', true)
    )
    returning id into v_payment_id;
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
      'আমরা আপনার অর্ডার পেয়েছি। স্ট্যাটাস দেখতে ট্র্যাক 페이지ে যান।',
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
    'total', v_total,
    'payment_no', v_payment_no,
    'payment_id', v_payment_id,
    'method_code', v_method.code,
    'eta_days', v_eta,
    'item_count', jsonb_array_length(v_lines)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_payment() — admin only. Verifies one manual payment and applies all
-- side effects atomically (order paid / premium activated + access code).
-- Returns {status, effects: [...]}.
-- ---------------------------------------------------------------------------
create or replace function public.approve_payment(
  p_payment uuid,
  p_actor uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_pay public.payments%rowtype;
  v_sub public.user_subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_expires timestamptz;
  v_code text;
  v_effects jsonb := '[]'::jsonb;
  v_actor uuid := coalesce(p_actor, auth.uid());
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  select * into v_pay from public.payments where id = p_payment for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_pay.status = 'verified' then
    return jsonb_build_object('status', 'verified', 'effects', jsonb_build_array('আগেই যাচাই করা হয়েছে'));
  end if;

  update public.payments
     set status = 'verified',
         reviewed_by = v_actor,
         reviewed_at = now(),
         admin_note = coalesce(p_note, admin_note)
   where id = p_payment;

  insert into public.payment_logs (payment_id, actor_id, actor_role, action, from_status, to_status, note)
  values (p_payment, v_actor, 'admin', 'approved', v_pay.status::text, 'verified', p_note);

  if v_pay.purpose = 'order' and v_pay.order_id is not null then
    update public.orders
       set payment_status = 'paid',
           payment_ref = coalesce(v_pay.trx_norm, v_pay.trx_id),
           updated_at = now()
     where id = v_pay.order_id;
    v_effects := v_effects || to_jsonb('অর্ডার পরিশোধিত হিসেবে চিহ্নিত'::text);
  end if;

  if v_pay.purpose = 'premium' and v_pay.subscription_id is not null then
    select * into v_sub from public.user_subscriptions where id = v_pay.subscription_id;
    if found then
      select * into v_plan from public.plans where id = v_sub.plan_id;
      v_expires := greatest(coalesce(v_sub.expires_at, now()), now())
                   + make_interval(days => coalesce(v_plan.duration_days, 30));

      update public.user_subscriptions
         set status = 'active',
             started_at = coalesce(started_at, now()),
             expires_at = v_expires,
             grace_until = null,
             updated_at = now()
       where id = v_sub.id;

      update public.profiles
         set premium_until = v_expires,
             role = case when role = 'admin' then role else 'premium'::public.user_role end
       where id = v_sub.user_id;

      v_code := upper(substr(encode(extensions.gen_random_bytes(9), 'hex'), 1, 4) || '-' ||
                      substr(encode(extensions.gen_random_bytes(9), 'hex'), 1, 4) || '-' ||
                      substr(encode(extensions.gen_random_bytes(9), 'hex'), 1, 4));
      insert into public.access_codes (code, plan_id, user_id, subscription_id, status, note, meta)
      values (v_code, v_sub.plan_id, v_sub.user_id, v_sub.id, 'unused', 'পেমেন্ট অ্যাপ্রুভালে তৈরি',
              jsonb_build_object('payment_no', v_pay.payment_no, 'sub_no', v_sub.sub_no));

      insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
      values (v_sub.user_id, 'user', 'premium', 'প্রিমিয়াম সক্রিয় হয়েছে',
              'আপনার প্ল্যান চালু হয়েছে। লাইভ ক্যামেরা দেখতে পারবেন।', '/live/plans',
              jsonb_build_object('sub_no', v_sub.sub_no, 'access_code', v_code));

      v_effects := v_effects || to_jsonb('প্রিমিয়াম সক্রিয়'::text) || to_jsonb('অ্যাক্সেস কোড তৈরি'::text);
    end if;
  end if;

  if v_pay.user_id is not null then
    insert into public.notifications (user_id, audience, kind, title_bn, body_bn, link, meta)
    values (v_pay.user_id, 'user', 'payment', 'পেমেন্ট যাচাই হয়েছে',
            'আপনার পেমেন্ট (' || v_pay.payment_no || ') অনুমোদিত হয়েছে।',
            case when v_pay.purpose = 'premium' then '/account/premium' else '/track?order=' || coalesce(v_pay.payment_no, '') end,
            jsonb_build_object('payment_no', v_pay.payment_no));
  end if;

  perform public.log_audit(v_actor, 'payment.approved', 'payments', p_payment::text,
                           jsonb_build_object('payment_no', v_pay.payment_no, 'amount', v_pay.amount), null);

  return jsonb_build_object('status', 'verified', 'effects', v_effects);
end;
$$;

-- ---------------------------------------------------------------------------
-- login_help(): "why did my login fail?" — never leaks password hashes.
-- ---------------------------------------------------------------------------
create or replace function public.login_help(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_row record;
  v_out jsonb;
begin
  select u.id, u.email, u.encrypted_password, u.email_confirmed_at,
         coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) as providers
    into v_row
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
   limit 1;

  if not found then
    v_out := jsonb_build_object('exists', false, 'has_password', false, 'providers', '[]'::jsonb, 'unconfirmed', false);
  else
    v_out := jsonb_build_object(
      'exists', true,
      'has_password', coalesce(v_row.encrypted_password, '') <> '',
      'providers', v_row.providers,
      'unconfirmed', v_row.email_confirmed_at is null
    );
  end if;

  begin
    insert into public.login_attempts (email, ok) values (lower(trim(p_email)), false);
  exception when others then null;
  end;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution privileges: anon may call none of the write RPCs.
-- ---------------------------------------------------------------------------
revoke all on function public.place_order(uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, jsonb, text, text) to authenticated, service_role;

revoke all on function public.approve_payment(uuid, uuid, text) from public, anon;
grant execute on function public.approve_payment(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.login_help(text) from public, anon;
grant execute on function public.login_help(text) to service_role;
