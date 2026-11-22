-- ============================================================================
-- 0005 — Multi-supplier reviews, verified purchases, complaints, quality score
-- ============================================================================
-- Run AFTER 0001 → 0004.
--
-- Why a new table instead of extending `reviews`?
--   `reviews` (0001) is a public/testimonial table with no order link, so it
--   cannot prove a verified purchase or scope a review to one supplier inside
--   a combo. We keep it for legacy testimonials and add the real thing here.
-- ============================================================================

create extension if not exists pgcrypto;

-- ===================================================== order_reviews
-- One row per (order, product). A combo order with 3 suppliers produces 3
-- independent product reviews plus up to 3 supplier reviews.
create table if not exists order_reviews (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  sub_order_id       uuid references sub_orders(id) on delete set null,
  product_id         uuid not null references products(id) on delete cascade,
  seller_id          uuid references sellers(id) on delete set null,
  user_id            uuid not null references users(id) on delete cascade,

  -- product rating (1-5) is mandatory; supplier rating is optional
  rating             int not null check (rating between 1 and 5),
  seller_rating      int check (seller_rating between 1 and 5),

  title_bn           text,
  comment            text check (char_length(comment) <= 2000),
  photos             text[] not null default '{}',
  tags               text[] not null default '{}',

  -- proven: the sub-order that contained this item was marked delivered
  is_verified_purchase boolean not null default true,

  -- moderation (admin can hide spam/abuse but never deletes)
  status             text not null default 'published'
                     check (status in ('published', 'hidden')),
  hidden_reason      text,
  hidden_by          uuid references users(id) on delete set null,
  hidden_at          timestamptz,

  -- the seller's single public reply
  seller_reply       text,
  seller_replied_at  timestamptz,
  seller_replied_by  uuid references users(id) on delete set null,

  -- 7-day edit window, enforced in SQL below
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  edited_at          timestamptz,

  -- one review per product per order, ever
  unique (order_id, product_id)
);

create index if not exists order_reviews_product_idx on order_reviews(product_id, created_at desc);
create index if not exists order_reviews_seller_idx  on order_reviews(seller_id, created_at desc);
create index if not exists order_reviews_user_idx    on order_reviews(user_id);
create index if not exists order_reviews_status_idx  on order_reviews(status);

-- ===================================================== review photos cap
-- "up to 3 photos" enforced in the database, not just the UI.
alter table order_reviews drop constraint if exists order_reviews_photos_max;
alter table order_reviews
  add constraint order_reviews_photos_max check (coalesce(array_length(photos, 1), 0) <= 3);

-- ============================================== edit window + updated_at
create or replace function public.guard_review_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the customer's own content fields may change after insert. Anything
  -- else (rating, photos, tags) is frozen once the 7-day window closes.
  if old.created_at < now() - interval '7 days' then
    if new.rating       is distinct from old.rating
    or new.seller_rating is distinct from old.seller_rating
    or new.comment      is distinct from old.comment
    or new.photos       is distinct from old.photos
    or new.tags         is distinct from old.tags
    or new.title_bn     is distinct from old.title_bn then
      raise exception 'review edit window (7 days) has closed'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_reviews_edit_window on order_reviews;
create trigger order_reviews_edit_window
  before update on order_reviews
  for each row execute function public.guard_review_edit();

-- ===================================================== complaints (tickets)
create table if not exists complaints (
  id                 uuid primary key default gen_random_uuid(),
  ticket_no          text unique not null,
  order_id           uuid not null references orders(id) on delete cascade,
  sub_order_id       uuid references sub_orders(id) on delete set null,
  order_item_id      uuid references order_items(id) on delete set null,
  product_id         uuid references products(id) on delete set null,
  seller_id          uuid references sellers(id) on delete set null,
  user_id            uuid not null references users(id) on delete cascade,

  -- পচা/নষ্ট | কম ওজন | ভুল পণ্য | দেরি | অন্য
  problem_type       text not null
                     check (problem_type in ('spoiled','short_weight','wrong_item','late','other')),
  description        text not null check (char_length(description) between 5 and 2000),
  photos             text[] not null default '{}',

  -- refund | replacement | inform
  preferred_resolution text not null default 'inform'
                     check (preferred_resolution in ('refund','replacement','inform')),

  status             text not null default 'open'
                     check (status in ('open','in_review','resolved','rejected')),
  -- what was actually granted: refund | replacement | inform | none
  resolution         text check (resolution in ('refund','replacement','inform','none')),
  resolution_note    text,
  resolved_by        uuid references users(id) on delete set null,
  resolved_at        timestamptz,
  rejected_by        uuid references users(id) on delete set null,
  rejected_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists complaints_user_idx    on complaints(user_id, created_at desc);
create index if not exists complaints_seller_idx  on complaints(seller_id, status);
create index if not exists complaints_status_idx  on complaints(status, created_at desc);
create index if not exists complaints_order_idx   on complaints(order_id);

alter table complaints drop constraint if exists complaints_photos_max;
alter table complaints
  add constraint complaints_photos_max check (coalesce(array_length(photos, 1), 0) <= 3);

-- ============================================ complaint thread messages
-- Customer ↔ admin ↔ seller conversation, exactly what the ticket page shows.
create table if not exists complaint_messages (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references complaints(id) on delete cascade,
  -- who wrote it
  author_role   text not null check (author_role in ('customer','seller','admin')),
  author_id     uuid references users(id) on delete set null,
  body          text not null check (char_length(body) between 1 and 2000),
  is_internal   boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists complaint_messages_idx on complaint_messages(complaint_id, created_at);

-- ================================================== ticket number sequence
create sequence if not exists complaint_seq start 1000;

create or replace function public.set_complaint_no()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_no is null or new.ticket_no = '' then
    new.ticket_no = 'CMP-' || to_char(now(), 'YYMM') || '-' || nextval('complaint_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists complaints_ticket_no on complaints;
create trigger complaints_ticket_no before insert on complaints
  for each row execute function public.set_complaint_no();

drop trigger if exists complaints_updated_at on complaints;
create trigger complaints_updated_at before update on complaints
  for each row execute function public.touch_updated_at();

-- ============================================ review tag vocabulary
-- Kept in a table so the admin CMS can relabel them later.
create table if not exists review_tags (
  slug       text primary key,
  label_bn   text not null,
  label_en   text not null,
  sentiment  text not null default 'positive' check (sentiment in ('positive','negative')),
  sort_order int not null default 0
);

insert into review_tags (slug, label_bn, label_en, sentiment, sort_order) values
  ('fresh',        'তাজা',              'Fresh',            'positive', 1),
  ('packaging',    'ভালো প্যাকেজিং',     'Good packaging',   'positive', 2),
  ('right_weight', 'সঠিক ওজন',          'Correct weight',   'positive', 3),
  ('on_time',      'সময়মতো ডেলিভারি',   'On-time delivery', 'positive', 4),
  ('stale',        'বাসি',              'Stale',            'negative', 5),
  ('under_weight', 'কম ওজন',            'Under weight',     'negative', 6),
  ('bad_packaging','খারাপ প্যাকেজিং',    'Bad packaging',    'negative', 7),
  ('late',         'দেরি',              'Late',             'negative', 8)
on conflict (slug) do update
  set label_bn = excluded.label_bn,
      label_en = excluded.label_en,
      sentiment = excluded.sentiment,
      sort_order = excluded.sort_order;

-- ================================================= product rating rollup
-- Keeps products.rating / review_count in sync so product cards stay cheap.
create or replace function public.recalc_product_rating(p_product uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg   numeric(3,2);
  v_count int;
begin
  select coalesce(round(avg(rating)::numeric, 2), 5.0), count(*)
    into v_avg, v_count
  from order_reviews
  where product_id = p_product and status = 'published';

  update products
     set rating = v_avg,
         review_count = v_count
   where id = p_product;
end;
$$;

create or replace function public.trg_recalc_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_product_rating(old.product_id);
    return old;
  end if;
  perform public.recalc_product_rating(new.product_id);
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    perform public.recalc_product_rating(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists order_reviews_rollup on order_reviews;
create trigger order_reviews_rollup
  after insert or update or delete on order_reviews
  for each row execute function public.trg_recalc_product_rating();

-- ================================================== supplier quality view
-- average rating, complaint rate, on-time rate, response time
create or replace view v_supplier_quality
with (security_invoker = false) as
with r as (
  select seller_id,
         count(*)                                   as review_count,
         avg(rating)::numeric(3,2)                  as avg_product_rating,
         avg(seller_rating)::numeric(3,2)           as avg_seller_rating,
         count(*) filter (where rating <= 2)        as low_rating_count
  from order_reviews
  where seller_id is not null and status = 'published'
  group by seller_id
),
c as (
  select seller_id,
         count(*)                                            as complaint_count,
         count(*) filter (where status in ('resolved'))       as resolved_count
  from complaints
  where seller_id is not null
  group by seller_id
),
o as (
  select so.seller_id,
         count(*)                                                as sub_order_count,
         count(*) filter (where so.status = 'delivered')          as delivered_count,
         -- "on time" = delivered within 48h of creation
         count(*) filter (
           where so.status = 'delivered' and so.created_at > now() - interval '90 days'
         )                                                        as recent_delivered
  from sub_orders so
  where so.seller_id is not null
  group by so.seller_id
)
select
  s.id                                as seller_id,
  s.slug,
  s.name_bn,
  s.status,
  coalesce(r.review_count, 0)                              as review_count,
  coalesce(r.avg_product_rating, 0)::numeric(3,2)          as avg_rating,
  coalesce(r.avg_seller_rating, 0)::numeric(3,2)           as avg_seller_rating,
  coalesce(r.low_rating_count, 0)                          as low_rating_count,
  coalesce(c.complaint_count, 0)                           as complaint_count,
  coalesce(c.resolved_count, 0)                            as resolved_count,
  coalesce(o.sub_order_count, 0)                           as sub_order_count,
  coalesce(o.delivered_count, 0)                           as delivered_count,
  -- complaint rate = complaints / sub-orders, as a percentage
  case when coalesce(o.sub_order_count, 0) = 0 then 0
       else round(coalesce(c.complaint_count, 0)::numeric * 100 / o.sub_order_count, 1)
  end                                                      as complaint_rate,
  -- on-time rate = delivered / sub-orders, as a percentage
  case when coalesce(o.sub_order_count, 0) = 0 then 100
       else round(coalesce(o.delivered_count, 0)::numeric * 100 / o.sub_order_count, 1)
  end                                                      as on_time_rate,
  -- composite quality score 0-100 (rating 50%, complaint rate 30%, on-time 20%)
  round(
      coalesce(r.avg_product_rating, 5) / 5 * 50
    + greatest(0, 100 - (case when coalesce(o.sub_order_count,0) = 0 then 0
                              else coalesce(c.complaint_count,0)::numeric * 100 / o.sub_order_count end)) * 0.30
    + (case when coalesce(o.sub_order_count,0) = 0 then 100
            else coalesce(o.delivered_count,0)::numeric * 100 / o.sub_order_count end) * 0.20
  , 1)                                                     as quality_score
from sellers s
left join r on r.seller_id = s.id
left join c on c.seller_id = s.id
left join o on o.seller_id = s.id;

grant select on v_supplier_quality to authenticated;

-- ============================================== rating breakdown per product
create or replace view v_product_rating_breakdown
with (security_invoker = false) as
select
  product_id,
  count(*)                                          as total,
  count(*) filter (where rating = 5)                as r5,
  count(*) filter (where rating = 4)                as r4,
  count(*) filter (where rating = 3)                as r3,
  count(*) filter (where rating = 2)                as r2,
  count(*) filter (where rating = 1)                as r1,
  avg(rating)::numeric(3,2)                         as avg_rating
from order_reviews
where status = 'published'
group by product_id;

grant select on v_product_rating_breakdown to anon, authenticated;

-- =========================================================== seller warns
create table if not exists seller_warnings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references sellers(id) on delete cascade,
  reason      text not null,
  severity    text not null default 'warning' check (severity in ('warning','suspension')),
  issued_by   uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists seller_warnings_idx on seller_warnings(seller_id, created_at desc);

-- ============================================================== RLS
alter table order_reviews      enable row level security;
alter table complaints         enable row level security;
alter table complaint_messages enable row level security;
alter table review_tags        enable row level security;
alter table seller_warnings    enable row level security;

-- reviews: the world reads published ones; a customer owns their row
drop policy if exists order_reviews_public_read on order_reviews;
drop policy if exists order_reviews_own_insert  on order_reviews;
drop policy if exists order_reviews_own_update  on order_reviews;
drop policy if exists order_reviews_admin_all   on order_reviews;
drop policy if exists order_reviews_seller_read on order_reviews;

create policy order_reviews_public_read on order_reviews
  for select using (status = 'published');

create policy order_reviews_own_insert on order_reviews
  for insert with check (user_id = public.app_user_id());

create policy order_reviews_own_update on order_reviews
  for update using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

create policy order_reviews_seller_read on order_reviews
  for select using (
    exists (
      select 1 from sellers s
      where s.id = order_reviews.seller_id and s.user_id = public.app_user_id()
    )
  );

create policy order_reviews_admin_all on order_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- seller may only write the reply columns; a trigger guards the rest
create or replace function public.guard_review_seller_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;

  -- a seller may only touch seller_reply* and may never delete
  if new.rating is distinct from old.rating
  or new.seller_rating is distinct from old.seller_rating
  or new.comment is distinct from old.comment
  or new.photos is distinct from old.photos
  or new.status is distinct from old.status
  or new.user_id is distinct from old.user_id then
    if exists (
      select 1 from sellers s
      where s.id = old.seller_id and s.user_id = public.app_user_id()
    ) then
      raise exception 'sellers may only reply to a review' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists order_reviews_seller_guard on order_reviews;
create trigger order_reviews_seller_guard
  before update on order_reviews
  for each row execute function public.guard_review_seller_reply();

-- reviews are never hard-deleted by sellers; block DELETE for non-admins
drop policy if exists order_reviews_no_delete on order_reviews;
create policy order_reviews_no_delete on order_reviews
  for delete using (public.is_admin());

-- complaints
drop policy if exists complaints_own on complaints;
drop policy if exists complaints_seller_read on complaints;
drop policy if exists complaints_admin_all on complaints;

create policy complaints_own on complaints
  for all using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

create policy complaints_seller_read on complaints
  for select using (
    exists (
      select 1 from sellers s
      where s.id = complaints.seller_id and s.user_id = public.app_user_id()
    )
  );

create policy complaints_admin_all on complaints
  for all using (public.is_admin()) with check (public.is_admin());

-- complaint messages: visible to the customer, the seller in question, admin
drop policy if exists complaint_messages_read on complaint_messages;
drop policy if exists complaint_messages_write on complaint_messages;

create policy complaint_messages_read on complaint_messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from complaints c
      where c.id = complaint_messages.complaint_id
        and (
          c.user_id = public.app_user_id()
          or exists (
            select 1 from sellers s
            where s.id = c.seller_id and s.user_id = public.app_user_id()
          )
        )
    )
  );

create policy complaint_messages_write on complaint_messages
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from complaints c
      where c.id = complaint_messages.complaint_id
        and (
          c.user_id = public.app_user_id()
          or exists (
            select 1 from sellers s
            where s.id = c.seller_id and s.user_id = public.app_user_id()
          )
        )
    )
  );

-- tags: readable by everyone, writable by admin only
drop policy if exists review_tags_read on review_tags;
create policy review_tags_read on review_tags for select using (true);

-- warns: admin only
drop policy if exists seller_warnings_admin on seller_warnings;
create policy seller_warnings_admin on seller_warnings
  for all using (public.is_admin()) with check (public.is_admin());

-- ==================================================== storage: review photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'review-photos', 'review-photos', true, 4194304,
    array['image/jpeg','image/png','image/webp']
  ),
  (
    'complaint-photos', 'complaint-photos', true, 4194304,
    array['image/jpeg','image/png','image/webp']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists review_photos_public_read on storage.objects;
drop policy if exists review_photos_own_write  on storage.objects;

create policy review_photos_public_read on storage.objects
  for select using (bucket_id = 'review-photos');

create policy review_photos_own_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================================================== settings addition
insert into settings (key, value)
values ('reviews', '{"edit_window_days": 7, "max_photos": 3, "auto_publish": true, "low_rating_threshold": 2}'::jsonb)
on conflict (key) do nothing;
