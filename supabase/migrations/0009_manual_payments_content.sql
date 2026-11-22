-- ============================================================================
-- 0009 — Manual payments + fully editable content
-- ----------------------------------------------------------------------------
-- Adds:
--   • payment_methods     admin-managed bKash / Nagad / Rocket / Upay / bank / COD
--   • payments            customer-submitted TrxID claims, admin-verified
--   • payment_logs        append-only trail for every status change
--   • social_links        header / footer / contact icons, reorderable
--   • hero_slides         homepage carousel, admin-managed
--   • homepage_sections   drag-to-reorder homepage layout
--   • category / product / farm / camera column additions
--   • storage buckets      payment-proofs (PRIVATE), payment-logos, hero-slides
--
-- Design notes
--   • Money never moves on a client signal. A payment flips to `verified` only
--     from the server (service role) after an admin approves it, which is also
--     the only path that marks the order paid or activates the subscription.
--   • Customers may re-submit a rejected payment, but the column-level GRANT
--     means they can never touch status / amount-total / reviewed_*.
--   • TrxIDs are globally UNIQUE on a normalised column (uppercase, alphanumeric
--     only) so `trx 8N7A2K` and `8n7a-2k` collide as they should.
-- ============================================================================

-- ------------------------------------------------------------ payment methods
create table if not exists public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  -- stable machine code: bkash | nagad | rocket | upay | bank | cod | <custom>
  code            text unique not null,
  name_bn         text not null,
  name_en         text,
  -- mfs = mobile financial service, bank, cod = cash on delivery, gateway = sslcommerz etc.
  kind            text not null default 'mfs'
                  check (kind in ('mfs', 'bank', 'cod', 'gateway', 'other')),
  logo_url        text,
  -- Personal / Agent / Merchant for MFS wallets; Account for banks.
  account_type    text check (account_type in ('personal', 'agent', 'merchant', 'account')),
  -- The receiving number (01XXXXXXXXX) or the bank account number.
  account_number  text,
  account_name    text,
  bank_name       text,
  branch_name     text,
  routing_number  text,
  -- Bangla instructions shown under the number, e.g. "Send Money করুন, Reference খালি রাখুন"
  instruction_bn  text,
  min_amount      numeric(10, 2) not null default 1 check (min_amount >= 0),
  -- null = no upper cap
  max_amount      numeric(10, 2),
  -- Optional regex override for the TrxID format of this method.
  trx_pattern     text,
  -- COD and gateways need no TrxID; every manual wallet does.
  requires_trx    boolean not null default true,
  requires_sender boolean not null default true,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists payment_methods_active_idx on public.payment_methods(is_active, sort_order);

-- ---------------------------------------------------------------- payments
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  payment_no      text unique not null,                 -- PM-XXXXXX shown to the customer
  user_id         uuid references public.users(id) on delete set null,
  purpose         text not null check (purpose in ('order', 'premium')),
  order_id        uuid references public.orders(id) on delete cascade,
  subscription_id uuid references public.premium_subscriptions(id) on delete cascade,
  -- Snapshot of the method so a later rename/delete does not rewrite history.
  method_id       uuid references public.payment_methods(id) on delete set null,
  method_code     text not null,
  method_name_bn  text,
  -- What the customer owed, frozen at submission time.
  expected_amount numeric(10, 2) not null,
  amount          numeric(10, 2) not null check (amount > 0),
  sender_number   text,
  trx_id          text,                                  -- exactly as typed
  trx_norm        text,                                  -- uppercase alphanumeric, UNIQUE
  paid_at         timestamptz,
  -- storage path inside the private `payment-proofs` bucket
  screenshot_url  text,
  status          text not null default 'pending'
                  check (status in ('pending', 'verified', 'rejected', 'needs_info')),
  reject_reason   text,
  admin_note      text,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  -- anti-fraud context
  submitted_ip    text,
  submitted_agent text,
  attempt_no      int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_target_chk check (
    (purpose = 'order'   and order_id is not null) or
    (purpose = 'premium' and subscription_id is not null)
  ),
  constraint payments_trx_shape_chk check (
    trx_norm is null or trx_norm ~ '^[A-Z0-9]{4,40}$'
  )
);

-- One receipt can only ever clear one payment, across the whole site.
create unique index if not exists payments_trx_norm_uniq
  on public.payments (trx_norm) where trx_norm is not null;
create index if not exists payments_status_idx    on public.payments(status, created_at desc);
create index if not exists payments_user_idx      on public.payments(user_id, created_at desc);
create index if not exists payments_order_idx     on public.payments(order_id);
create index if not exists payments_sub_idx       on public.payments(subscription_id);
create index if not exists payments_method_idx    on public.payments(method_code);
create index if not exists payments_sender_idx    on public.payments(sender_number);

-- -------------------------------------------------------------- payment logs
create table if not exists public.payment_logs (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.payments(id) on delete cascade,
  actor_id    uuid,
  actor_role  text,
  action      text not null check (action in
                ('submitted', 'resubmitted', 'approved', 'rejected',
                 'needs_info', 'reopened', 'bulk_approved', 'note')),
  from_status text,
  to_status   text,
  note        text,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists payment_logs_payment_idx on public.payment_logs(payment_id, created_at desc);

-- --------------------------------------------------------------- social links
create table if not exists public.social_links (
  id           uuid primary key default gen_random_uuid(),
  -- facebook | youtube | instagram | tiktok | whatsapp | telegram | x | linkedin | custom
  platform     text not null,
  label_bn     text,
  url          text not null,
  -- lucide-react icon name, resolved through a fixed allow-list in the app
  icon         text,
  color        text,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  show_header  boolean not null default false,
  show_footer  boolean not null default true,
  show_contact boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists social_links_order_idx on public.social_links(sort_order);

-- ---------------------------------------------------------------- hero slides
create table if not exists public.hero_slides (
  id                uuid primary key default gen_random_uuid(),
  title_bn          text not null,
  subtitle_bn       text,
  -- separate desktop / mobile art keeps the LCP image small on phones
  image_url         text,
  image_mobile_url  text,
  video_url         text,
  alt_bn            text,
  cta_label_bn      text,
  cta_href          text,
  secondary_label_bn text,
  secondary_href    text,
  text_position     text not null default 'left'  check (text_position in ('left', 'center', 'right')),
  text_tone         text not null default 'light' check (text_tone in ('light', 'dark')),
  overlay_opacity   int not null default 45 check (overlay_opacity between 0 and 90),
  starts_at         timestamptz,
  ends_at           timestamptz,
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists hero_slides_order_idx on public.hero_slides(is_active, sort_order);

-- ------------------------------------------------------------ homepage layout
create table if not exists public.homepage_sections (
  id          uuid primary key default gen_random_uuid(),
  -- stable key the renderer switches on
  key         text unique not null,
  label_bn    text not null,
  is_visible  boolean not null default true,
  sort_order  int not null default 0,
  -- per-section knobs: heading, body, product slugs, limit, …
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- Column additions (idempotent — 0001/0003 already shipped without these)
-- ============================================================================

-- nested sub-categories + per-category SEO
alter table public.categories
  add column if not exists parent_id          uuid references public.categories(id) on delete set null,
  add column if not exists seo_title_bn       text,
  add column if not exists seo_description_bn text,
  add column if not exists banner_url         text;
create index if not exists categories_parent_idx on public.categories(parent_id);

-- merchandising flags, per-product SEO, extra gallery
alter table public.products
  add column if not exists is_best_seller   boolean not null default false,
  add column if not exists is_new_arrival   boolean not null default false,
  add column if not exists seo_title_bn     text,
  add column if not exists seo_description_bn text,
  add column if not exists video_url        text;
create index if not exists products_seller_flag_idx on public.products(is_best_seller, is_new_arrival);

alter table public.farms
  add column if not exists image_url  text,
  add column if not exists notes_bn   text;

alter table public.cameras
  add column if not exists name_en    text,
  add column if not exists notes_bn   text;

-- ============================================================================
-- Seed the payment methods the shop actually uses
-- ============================================================================
insert into public.payment_methods
  (code, name_bn, name_en, kind, account_type, account_number, account_name,
   instruction_bn, min_amount, max_amount, trx_pattern, requires_trx, is_active, sort_order)
values
  ('bkash', 'বিকাশ', 'bKash', 'mfs', 'personal', '01700000000', 'বিশ্বাস এগ্রো',
   'বিকাশ অ্যাপ → Send Money → উপরের নম্বরে টাকা পাঠান। Reference-এ কিছু লিখবেন না। তারপর নিচে TrxID ও যেই নম্বর থেকে পাঠিয়েছেন সেটি দিন।',
   10, 100000, '^[A-Z0-9]{8,12}$', true, true, 10),

  ('nagad', 'নগদ', 'Nagad', 'mfs', 'personal', '01700000000', 'বিশ্বাস এগ্রো',
   'নগদ অ্যাপ → Send Money → উপরের নম্বরে টাকা পাঠান। ক্যাশআউট করবেন না। TrxID লিখে রাখুন।',
   10, 100000, '^[A-Z0-9]{8,12}$', true, true, 20),

  ('rocket', 'রকেট', 'Rocket', 'mfs', 'personal', '017000000001', 'বিশ্বাস এগ্রো',
   'রকেট (DBBL) → Send Money → নম্বরের শেষে চেক ডিজিট বসবে। TrxID সহ নিচের ফর্ম পূরণ করুন।',
   10, 50000, '^[A-Z0-9]{8,14}$', true, true, 30),

  ('upay', 'উপায়', 'Upay', 'mfs', 'personal', '01700000000', 'বিশ্বাস এগ্রো',
   'উপায় অ্যাপ → Send Money → উপরের নম্বরে পাঠান। TrxID দিন।',
   10, 25000, '^[A-Z0-9]{8,14}$', true, false, 40),

  ('bank', 'ব্যাংক ট্রান্সফার', 'Bank transfer', 'bank', 'account', '1234567890123',
   'বিশ্বাস এগ্রো', 'যেকোনো ব্যাংক থেকে নিচের অ্যাকাউন্টে টাকা পাঠিয়ে ট্রানজেকশন আইডি দিন।',
   100, null, '^[A-Z0-9]{6,40}$', true, true, 50),

  ('cod', 'ক্যাশ অন ডেলিভারি', 'Cash on delivery', 'cod', null, null, null,
   'পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিন। অগ্রিম কিছু লাগবে না।',
   0, null, null, false, true, 60)
on conflict (code) do nothing;

-- ============================================================================
-- Seed social links (the header/footer used to hard-code these in lib/site.ts)
-- ============================================================================
insert into public.social_links (platform, label_bn, url, icon, sort_order, show_header, show_footer, show_contact)
values
  ('facebook',  'ফেসবুক',  'https://facebook.com/bishwasagro',      'Facebook',  10, true,  true, true),
  ('youtube',   'ইউটিউব',  'https://youtube.com/@bishwasagro',      'Youtube',   20, true,  true, true),
  ('instagram', 'ইনস্টাগ্রাম', 'https://instagram.com/bishwasagro', 'Instagram', 30, true,  true, true),
  ('whatsapp',  'হোয়াটসঅ্যাপ', 'https://wa.me/8801700000000',        'MessageCircle', 40, true, true, true)
on conflict do nothing;

-- ============================================================================
-- Seed hero slides (pointing at art that already ships in /public/images)
-- ============================================================================
insert into public.hero_slides
  (title_bn, subtitle_bn, image_url, alt_bn, cta_label_bn, cta_href,
   secondary_label_bn, secondary_href, text_position, text_tone, overlay_opacity, sort_order)
select * from (values
  ('খামার থেকে সোজা আপনার রান্নাঘরে',
   'আজ তোলা সবজি, আজই ডেলিভারি। কোনো গুদাম নেই, কোনো কেমিক্যাল নেই।',
   '/images/cat/vegetables.jpg', 'তাজা শাকসবজি',
   'এখনই অর্ডার করুন', '/products', 'ক্যাটাগরি দেখুন', '/categories', 'left', 'light', 52, 10),
  ('দেশি ডিম, খাঁটি মধু — ঘরের স্বাদ',
   'নিজস্ব খামারের ডিম ও মধু, ল্যাব টেস্ট করা।',
   '/images/cat/honey.jpg', 'খাঁটি মধু',
   'মধু দেখুন', '/categories/modhu-organic', 'ডিম দেখুন', '/categories/deshi-dim', 'left', 'light', 48, 20),
  ('প্রতিদিন লাইভ — নিজের খামার নিজে দেখুন',
   'প্রিমিয়াম সদস্য হয়ে খামারের ক্যামেরা সরাসরি দেখুন।',
   '/images/cat/live.jpg', 'খামারের লাইভ ক্যামেরা',
   'প্রিমিয়াম নিন', '/subscription', 'ক্যামেরা দেখুন', '/live', 'right', 'light', 55, 30)
) as v
where not exists (select 1 from public.hero_slides);

-- ============================================================================
-- Seed the homepage section order
-- ============================================================================
insert into public.homepage_sections (key, label_bn, is_visible, sort_order, config)
values
  ('hero_slider',      'হিরো স্লাইডার',        true, 10,  '{"autoplay_ms": 6000, "show_arrows": true, "show_dots": true}'::jsonb),
  ('trust_strip',      'বিশ্বাসের স্ট্রিপ',     true, 20,  '{}'::jsonb),
  ('featured_products','ফিচার্ড পণ্য',         true, 30,  '{"limit": 8, "mode": "featured", "heading_bn": "আজকের বাছাই"}'::jsonb),
  ('text_block',       'টেক্সট ব্লক',          true, 40,  '{"heading_bn": "আমরা কেন আলাদা", "body_bn": "প্রতিটি পণ্য আমাদের নিজস্ব ও পার্টনার খামার থেকে আসে — মাঝখানে কোনো পাইকার নেই। তাই দাম কম, টাটকা বেশি।"}'::jsonb),
  ('categories',       'ক্যাটাগরি',            true, 50,  '{}'::jsonb),
  ('combos',           'কম্বো বক্স',           true, 60,  '{}'::jsonb),
  ('live_farms',       'লাইভ খামার',           true, 70,  '{}'::jsonb),
  ('premium_plans',    'প্রিমিয়াম প্ল্যান',    true, 80,  '{}'::jsonb),
  ('why_choose_us',    'কেন আমরা',             true, 90,  '{}'::jsonb),
  ('reviews',          'রিভিউ',                true, 100, '{"limit": 6}'::jsonb),
  ('blog',             'ব্লগ',                 true, 110, '{"limit": 3}'::jsonb),
  ('faq',              'প্রশ্ন-উত্তর',          true, 120, '{"limit": 5}'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.payment_methods    enable row level security;
alter table public.payments           enable row level security;
alter table public.payment_logs       enable row level security;
alter table public.social_links       enable row level security;
alter table public.hero_slides        enable row level security;
alter table public.homepage_sections  enable row level security;

-- ---- payment_methods: the storefront must read the receiving number, so this
--      is intentionally public for active rows. Writes are admin-only.
drop policy if exists payment_methods_public_read on public.payment_methods;
create policy payment_methods_public_read on public.payment_methods
  for select using (is_active or public.is_staff());

drop policy if exists payment_methods_admin_write on public.payment_methods;
create policy payment_methods_admin_write on public.payment_methods
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- payments: a customer sees only their own; an admin sees everything.
--      Nobody but the server may INSERT as a guest, and nobody but an admin may
--      change `status` (enforced by the column GRANTs further down).
drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments
  for select to authenticated
  using (user_id = public.app_user_id() or public.is_staff());

drop policy if exists payments_own_insert on public.payments;
create policy payments_own_insert on public.payments
  for insert to authenticated
  with check (user_id = public.app_user_id());

drop policy if exists payments_own_update on public.payments;
create policy payments_own_update on public.payments
  for update to authenticated
  using (
    user_id = public.app_user_id()
    and status in ('pending', 'rejected', 'needs_info')
  )
  with check (
    user_id = public.app_user_id()
    and status in ('pending', 'rejected', 'needs_info')
  );

drop policy if exists payments_admin_update on public.payments;
create policy payments_admin_update on public.payments
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- payment_logs: readable by the payment's owner and by staff. Never written
--      from a client — the server records every transition.
drop policy if exists payment_logs_read on public.payment_logs;
create policy payment_logs_read on public.payment_logs
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.payments p
      where p.id = payment_logs.payment_id
        and p.user_id = public.app_user_id()
    )
  );

drop policy if exists payment_logs_admin_write on public.payment_logs;
create policy payment_logs_admin_write on public.payment_logs
  for insert to authenticated with check (public.is_staff());

-- ---- content tables: public read of live rows, admin write.
drop policy if exists social_links_public_read on public.social_links;
create policy social_links_public_read on public.social_links
  for select using (is_active or public.is_staff());
drop policy if exists social_links_admin_write on public.social_links;
create policy social_links_admin_write on public.social_links
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists hero_slides_public_read on public.hero_slides;
create policy hero_slides_public_read on public.hero_slides
  for select using (
    public.is_staff()
    or (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now())
    )
  );
drop policy if exists hero_slides_admin_write on public.hero_slides;
create policy hero_slides_admin_write on public.hero_slides
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists homepage_sections_public_read on public.homepage_sections;
create policy homepage_sections_public_read on public.homepage_sections
  for select using (true);
drop policy if exists homepage_sections_admin_write on public.homepage_sections;
create policy homepage_sections_admin_write on public.homepage_sections
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================================
-- Column-level GRANTs — the actual boundary on `payments`
-- ----------------------------------------------------------------------------
-- The RLS policy above says "your row, while it is pending". That still leaves
-- every column writable, so without this a customer could PATCH status=verified.
-- A client may only (re)submit the evidence; the verdict is staff-only.
-- ============================================================================
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant insert (payment_no, user_id, purpose, order_id, subscription_id, method_id,
              method_code, method_name_bn, expected_amount, amount, sender_number,
              trx_id, trx_norm, paid_at, screenshot_url, submitted_ip, submitted_agent)
  on public.payments to authenticated;
grant update (sender_number, trx_id, trx_norm, amount, paid_at, screenshot_url)
  on public.payments to authenticated;

revoke insert, update, delete on public.payment_logs from anon, authenticated;
grant select on public.payment_logs to authenticated;

revoke insert, update, delete on public.payment_methods from anon, authenticated;
grant select on public.payment_methods to anon, authenticated;

grant select on public.social_links, public.hero_slides, public.homepage_sections
  to anon, authenticated;

-- ============================================================================
-- Storage
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- PRIVATE: payment screenshots are only served through a signed URL that the
  -- server mints after checking ownership. Never a public URL.
  ('payment-proofs', 'payment-proofs', false, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('payment-logos',  'payment-logos',  true,  1048576,
   array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('hero-slides',    'hero-slides',    true,  6291456,
   array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_proofs_owner_read" on storage.objects;
create policy "payment_proofs_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "payment_proofs_owner_write" on storage.objects;
create policy "payment_proofs_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "payment_logos_public_read" on storage.objects;
create policy "payment_logos_public_read" on storage.objects
  for select using (bucket_id in ('payment-logos', 'hero-slides'));

-- ============================================================================
-- updated_at housekeeping
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists payment_methods_touch on public.payment_methods;
create trigger payment_methods_touch before update on public.payment_methods
  for each row execute function public.touch_updated_at();

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Helper views for the admin reconciliation screen
-- ============================================================================
create or replace view public.v_payment_queue as
select
  p.*,
  round(p.expected_amount - p.amount, 2) as amount_delta,
  (abs(p.expected_amount - p.amount) < 0.5) as amount_matches,
  exists (
    select 1 from public.payments q
    where q.trx_norm = p.trx_norm and q.id <> p.id
  ) as trx_collision,
  o.order_no,
  o.customer_name,
  o.phone as customer_phone,
  s.sub_no,
  s.plan_name_bn
from public.payments p
left join public.orders o on o.id = p.order_id
left join public.premium_subscriptions s on s.id = p.subscription_id;

comment on view public.v_payment_queue is
  'Admin queue: joins the order/plan plus amount-match and duplicate-TrxID flags.';

-- Revenue reconciliation, one row per verified method per day.
create or replace view public.v_payment_reconciliation as
select
  date_trunc('day', coalesce(p.reviewed_at, p.created_at))::date as day,
  p.method_code,
  count(*) filter (where p.status = 'verified')                    as verified_count,
  coalesce(sum(p.amount) filter (where p.status = 'verified'), 0)   as verified_amount,
  count(*) filter (where p.status = 'rejected')                    as rejected_count,
  count(*) filter (where p.status = 'pending')                     as pending_count
from public.payments p
group by 1, 2
order by 1 desc, 2;

-- ============================================================================
-- Anti-fraud defaults (admin can change these in /foisal/settings)
-- ============================================================================
insert into public.settings (key, value)
values ('payments', jsonb_build_object(
  'max_submits_per_hour', 5,
  'max_rejected_before_block', 3,
  'block_hours', 24,
  'auto_trx_regex', true
))
on conflict (key) do nothing;
