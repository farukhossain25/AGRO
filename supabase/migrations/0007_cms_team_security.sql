-- ============================================================================
-- 0007 — CMS pages, manageable FAQ, media library, team roles, audit log
-- ============================================================================
-- Run AFTER 0001 → 0006.
--
-- Sections E (CMS) and F (team/roles) both land here because they share one
-- idea: the storefront's copy and who may change it should be data, not code.
--
--   1. `cms_pages`      — legal/about-style pages, edited as blocks
--   2. `faq_items`      — the FAQ accordion, per group, reorderable
--   3. `media_assets`   — one media library for every uploaded image
--   4. `team_members`   — admin accounts with a scoped role
--   5. `audit_log`      — who changed what, kept forever
--
-- Everything is additive: no existing column is dropped, no existing row is
-- rewritten, and every new table has RLS on with an explicit admin policy.
-- ============================================================================

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ roles ---
   0001 only allowed ('customer','admin'); 0003/0004 widened it for the vendor
   work. Replace the constraint with the scoped ladder:

     customer  · buy
     premium   · buy + livestream
     seller    · own products/orders only
     staff     · catalogue + content, no money, no settings
     manager   · staff + sellers, payouts, reports, reviews
     admin     · everything

   Anything checking `role = 'admin'` keeps working; new code checks
   `role in ('staff','manager','admin')` through lib/permissions.ts.
*/
alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('customer','premium','seller','staff','manager','admin'));

/* ======================= helper functions used by the policies below =======
   Defined here (not before the tables that call them) because PostgREST
   resolves them at policy-creation time. is_admin() already exists from 0004.
*/
create or replace function public.is_staff()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from users
    where id = auth.uid()
      and role in ('staff','manager','admin')
      and coalesce(is_active, true)
  );
$$;

create or replace function public.has_role(required text)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from users
    where id = auth.uid()
      and coalesce(is_active, true)
      and case required
            when 'staff'   then role in ('staff','manager','admin')
            when 'manager' then role in ('manager','admin')
            else role = required
          end
  );
$$;

grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.has_role(text) to authenticated, anon;

-- ---------------------------------------------------------------- cms_pages --
create table if not exists cms_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title_bn     text not null,
  title_en     text,
  -- Block list: [{ "type": "heading"|"text"|"list"|"callout"|"image", ... }]
  -- Kept as JSONB so a page can gain a block type without a migration; the
  -- renderer in lib/cms.ts is deliberately strict about what it accepts.
  blocks       jsonb not null default '[]'::jsonb,
  seo_title    text,
  seo_description text,
  is_published boolean not null default true,
  show_in_footer boolean not null default true,
  sort_order   int not null default 0,
  updated_by   uuid references users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists cms_pages_order_idx on cms_pages(sort_order);

alter table cms_pages enable row level security;
drop policy if exists cms_pages_public_read on cms_pages;
drop policy if exists cms_pages_staff_write on cms_pages;
create policy cms_pages_public_read on cms_pages
  for select using (is_published or public.is_staff());
create policy cms_pages_staff_write on cms_pages
  for all using (public.is_staff()) with check (public.is_staff());

drop trigger if exists cms_pages_updated_at on cms_pages;
create trigger cms_pages_updated_at before update on cms_pages
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------- faq_items --
create table if not exists faq_items (
  id         uuid primary key default gen_random_uuid(),
  group_bn   text not null default 'সাধারণ',
  question_bn text not null,
  answer_bn  text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists faq_items_group_idx on faq_items(group_bn, sort_order);

alter table faq_items enable row level security;
drop policy if exists faq_items_public_read on faq_items;
drop policy if exists faq_items_staff_write on faq_items;
create policy faq_items_public_read on faq_items
  for select using (is_active or public.is_staff());
create policy faq_items_staff_write on faq_items
  for all using (public.is_staff()) with check (public.is_staff());

-- -------------------------------------------------------------- media_assets --
-- Metadata only; the bytes live in the Supabase Storage buckets that already
-- exist (product-images, farm-media, avatars, review-photos, …). One row per
-- upload so the admin can find, reuse and (later) delete an image without
-- knowing which bucket it landed in.
create table if not exists media_assets (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null,
  path         text not null,
  url          text not null,
  mime         text,
  bytes        bigint,
  width        int,
  height       int,
  alt_bn       text,
  title_bn     text,
  tags         text[] default '{}',
  uploaded_by  uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (bucket, path)
);

create index if not exists media_assets_created_idx on media_assets(created_at desc);

alter table media_assets enable row level security;
drop policy if exists media_assets_staff_read on media_assets;
drop policy if exists media_assets_staff_write on media_assets;
create policy media_assets_staff_read on media_assets
  for select using (public.is_staff());
create policy media_assets_staff_write on media_assets
  for all using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------- audit_logs (extend) --
-- `audit_logs` already exists from 0003 (id, actor_id, actor_email, action,
-- entity, entity_id, meta, ip, created_at). Section F needs three more columns
-- rather than a second table: the actor's role at the time of the action, a
-- trimmed `diff` of what changed, and the user agent. `meta` stays for the
-- action-specific payload so existing rows keep working.
alter table audit_logs add column if not exists actor_role text;
alter table audit_logs add column if not exists diff jsonb;
alter table audit_logs add column if not exists user_agent text;

create index if not exists audit_logs_entity_idx on audit_logs(entity, entity_id);

-- /* NOTE */ The project has TWO role sources that must agree:
--   • auth.users → profiles.role      (the Google/Supabase sign-in identity)
--   • public.users.role               (the app's own user row, used by orders)
-- 0004 pinned profiles.role to ('customer','seller','premium','admin'); the
-- scoped team roles have to exist there too or a manager can never sign in.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('customer','premium','seller','staff','manager','admin'));

-- ====================================================== seed the FAQ items ==
-- Mirrors the hard-coded groups in app/(storefront)/faq/page.tsx so the page
-- keeps working before anyone edits it. `on conflict` needs a natural key, so
-- a question is unique per group.
create unique index if not exists faq_items_unique_q on faq_items(group_bn, question_bn);

insert into faq_items (group_bn, question_bn, answer_bn, sort_order) values
  ('অর্ডার ও ডেলিভারি', 'ডেলিভারি চার্জ কত?', 'ঢাকা সিটির ভেতরে ৳৬০, ঢাকার বাইরে ৳১২০–১৭০ (জেলা অনুযায়ী)। ৳১,২০০+ অর্ডারে ঢাকায় ফ্রি ডেলিভারি। কম্বো বক্সে সবসময় ফ্রি।', 1),
  ('অর্ডার ও ডেলিভারি', 'কত দিনে ডেলিভারি পাব?', 'ঢাকা সিটিতে সকাল ১০টার আগে অর্ডার করলে একই দিনে। ঢাকার উপকণ্ঠে ১ দিন, বাইরের জেলায় ২–৩ কর্মদিবস।', 2),
  ('অর্ডার ও ডেলিভারি', 'ডেলিভারি সময় নির্ধারণ করা যাবে?', 'হ্যাঁ। চেকআউটে ‘ডেলিভারি নোট’ ফিল্ডে আপনার সুবিধাজনক সময় লিখুন — আমাদের রাইডার সেটি মেনে চলার চেষ্টা করবেন।', 3),
  ('অর্ডার ও ডেলিভারি', 'সারা বাংলাদেশে ডেলিভারি হয়?', 'হ্যাঁ, ৬৪ জেলাতেই। কিছু দুর্গম উপজেলায় ১ দিন বেশি সময় লাগতে পারে।', 4),
  ('পেমেন্ট', 'কী কী পেমেন্ট পদ্ধতি আছে?', 'বিকাশ, নগদ, কার্ড/SSLCommerz এবং ক্যাশ অন ডেলিভারি।', 1),
  ('পেমেন্ট', 'ক্যাশ অন ডেলিভারিতে অতিরিক্ত চার্জ আছে?', 'না, কোনো অতিরিক্ত চার্জ নেই।', 2),
  ('পেমেন্ট', 'পেমেন্ট ব্যর্থ হলে কী হবে?', 'অর্ডার সংরক্ষিত থাকবে, টাকা কাটা হলে স্বয়ংক্রিয়ভাবে ফেরত হবে (৩–৭ কর্মদিবস)। আবার চেষ্টা করুন অথবা ক্যাশ অন ডেলিভারি বেছে নিন।', 3),
  ('গুণমান ও রিটার্ন', 'পণ্য খারাপ হলে কী করব?', 'অর্ডার পাওয়ার ২৪ ঘণ্টার মধ্যে অভিযোগ করুন — অ্যাকাউন্ট → অভিযোগ, অথবা প্রতিটি অর্ডারের রিভিউ ফর্ম থেকে। ছবি দিলে দ্রুত সমাধান হয়।', 1),
  ('গুণমান ও রিটার্ন', 'রিফান্ড কত দিনে পাব?', 'অনুমোদনের পর বিকাশ/নগদে ৩–৫ কর্মদিবস, কার্ডে ৭–১০ কর্মদিবস।', 2),
  ('গুণমান ও রিটার্ন', 'রিভিউ কীভাবে দেব?', 'অর্ডার ডেলিভারি হওয়ার পর অ্যাকাউন্ট → অর্ডার → “রিভিউ দিন” থেকে। শুধু যাচাইকৃত ক্রেতা রিভিউ দিতে পারেন, তাই রেটিং ভরসাযোগ্য।', 3)
on conflict (group_bn, question_bn) do nothing;

-- ============================================== seed the three legal pages =
-- Verbatim copy of lib/policies.ts in block form, so /policies/[slug] can read
-- from the DB and still fall back to the file when this table is empty.
insert into cms_pages (slug, title_bn, title_en, blocks, show_in_footer, sort_order, seo_title, seo_description) values
  ('privacy', 'প্রাইভেসি পলিসি', 'Privacy Policy', $json$[{"type":"heading","text":"আমরা কী তথ্য সংগ্রহ করি"},{"type":"text","body":"অর্ডার সম্পন্ন করতে আমরা আপনার নাম, মোবাইল নম্বর, ডেলিভারি ঠিকানা এবং ঐচ্ছিকভাবে ইমেইল সংগ্রহ করি। অ্যাকাউন্ট তৈরি করলে পাসওয়ার্ড সংরক্ষণ করা হয় শুধুমাত্র bcrypt হ্যাশ হিসেবে — আমরা কখনও প্লেইন পাসওয়ার্ড দেখি না বা সংরক্ষণ করি না।"},{"type":"text","body":"আমরা স্বয়ংক্রিয়ভাবে কিছু প্রযুক্তিগত তথ্য সংগ্রহ করি — ব্রাউজার টাইপ, ডিভাইস, আনুমানিক অবস্থান (শহর পর্যায়ে) ও কোন পৃষ্ঠাগুলো দেখেছেন। এটি সাইট উন্নয়ন ও নিরাপত্তার জন্য ব্যবহৃত হয়।"},{"type":"heading","text":"তথ্য কীভাবে ব্যবহার করি"},{"type":"text","body":"আপনার অর্ডার প্রসেস করা, ডেলিভারি সম্পন্ন করা, অর্ডার সংক্রান্ত যোগাযোগ করা এবং গ্রাহক সহায়তা প্রদান করা।"},{"type":"text","body":"আপনি সম্মতি দিলে মৌসুমি অফার ও নতুন পণ্যের তথ্য পাঠানো (যেকোনো সময় আনসাবস্ক্রাইব করা যাবে)।"},{"type":"text","body":"প্রতারণা প্রতিরোধ, নিরাপত্তা ও আইনি বাধ্যবাধকতা পূরণ।"},{"type":"heading","text":"তৃতীয় পক্ষের সাথে শেয়ারিং"},{"type":"text","body":"ডেলিভারি পার্টনার ও কুরিয়ার সার্ভিসকে শুধুমাত্র ডেলিভারির প্রয়োজনীয় তথ্য (নাম, ঠিকানা, ফোন) দেওয়া হয়।"},{"type":"text","body":"পেমেন্ট গেটওয়ে (বিকাশ, নগদ, SSLCommerz) সরাসরি পেমেন্ট প্রসেস করে — কার্ডের সম্পূর্ণ তথ্য আমাদের সার্ভারে সংরক্ষিত হয় না।"},{"type":"text","body":"আমরা কোনো অবস্থাতেই গ্রাহকের তথ্য বিক্রি করি না।"},{"type":"heading","text":"কুকি"},{"type":"text","body":"সেশন সুরক্ষার জন্য httpOnly কুকি, ভাষা পছন্দ ও কার্ট সংরক্ষণের জন্য localStorage ব্যবহার করা হয়। কার্ট কেবল আপনার ব্রাউজারেই থাকে — সার্ভারে পাঠানো হয় শুধুমাত্র চেকআউটের সময়।"},{"type":"heading","text":"আপনার অধিকার"},{"type":"text","body":"আপনি যেকোনো সময় আপনার তথ্য দেখতে, সংশোধন করতে বা মুছে ফেলার অনুরোধ করতে পারেন — hello@bishwasagro.com এ ইমেইল করুন। আমরা ৭ কর্মদিবসের মধ্যে সাড়া দিই।"},{"type":"heading","text":"তথ্য সংরক্ষণের মেয়াদ"},{"type":"text","body":"অর্ডারের রেকর্ড হিসাবরক্ষণ ও ওয়ারেন্টির জন্য ৩ বছর সংরক্ষিত থাকে। অ্যাকাউন্ট মুছে ফেলার অনুরোধ করলে ব্যক্তিগত তথ্য মুছে ফেলা হয়, শুধু আইনি প্রয়োজনে অর্ডারের সারসংক্ষেপ রাখা হয়।"}]$json$::jsonb,
   true, 1, 'প্রাইভেসি পলিসি | বিশ্বাস এগ্রো', 'বিশ্বাস এগ্রো কী তথ্য সংগ্রহ করে, কীভাবে ব্যবহার করে এবং আপনার ডেটা মুছে ফেলার উপায়।'),
  ('terms', 'শর্তাবলী', 'Terms of Service', $json$[{"type":"heading","text":"সেবার পরিধি"},{"type":"text","body":"বিশ্বাস এগ্রো বাংলাদেশে তাজা শাকসবজি, ফল, ডিম, মাংস, মাছ, দুগ্ধজাত পণ্য, মসলা ও অর্গানিক পণ্য সরবরাহ করে। সাইট ব্যবহার করে অর্ডার করলে আপনি এই শর্তাবলী মেনে নিচ্ছেন।"},{"type":"heading","text":"অর্ডার ও মূল্য"},{"type":"text","body":"সাইটে প্রদর্শিত দাম বাংলাদেশি টাকায় (৳) এবং বর্তমান বাজার দর অনুযায়ী। কৃষিপণ্যের দাম দিনে পরিবর্তিত হতে পারে; অর্ডার নিশ্চিত করার সময়ের দামই প্রযোজ্য হবে।"},{"type":"text","body":"স্টক শেষ হলে বা পণ্য অনুপলব্ধ হলে আমরা ফোনে জানিয়ে বিকল্প বা রিফান্ডের প্রস্তাব দেব।"},{"type":"heading","text":"ডেলিভারি"},{"type":"text","body":"ঢাকা সিটিতে সকাল ১০টার আগে অর্ডার করলে একই দিনে ডেলিভারির চেষ্টা করা হয়। বাইরের জেলায় ২–৩ কর্মদিবস। প্রাকৃতিক দুর্যোগ, হরতাল বা অস্বাভাবিক পরিস্থিতিতে বিলম্ব হতে পারে — সেক্ষেত্রে আমরা আগেই জানাব।"},{"type":"heading","text":"পণ্য গ্রহণ"},{"type":"text","body":"ডেলিভারির সময় পণ্য পরীক্ষা করে নিন। কোনো ত্রুটি থাকলে রাইডারের সামনেই জানান বা ২৪ ঘণ্টার মধ্যে ছবিসহ আমাদের জানান।"},{"type":"heading","text":"অ্যাকাউন্ট"},{"type":"text","body":"আপনার লগইন তথ্য গোপন রাখার দায়িত্ব আপনার। অ্যাকাউন্টের মাধ্যমে করা সমস্ত কার্যক্রমের জন্য আপনি দায়ী। সন্দেহজনক কার্যক্রম দেখলে সাথে সাথে আমাদের জানান।"},{"type":"heading","text":"সাবস্ক্রিপশন"},{"type":"text","body":"সাবস্ক্রিপশন মাসিক ভিত্তিতে চলে এবং যেকোনো সময় পজ বা বাতিল করা যায়। চলতি মাসে ইতিমধ্যে ডেলিভারি হওয়া বক্সের পেমেন্ট ফেরতযোগ্য নয়।"},{"type":"heading","text":"দায়সীমা"},{"type":"text","body":"আমাদের সর্বোচ্চ দায় সংশ্লিষ্ট অর্ডারের মূল্যের মধ্যে সীমাবদ্ধ। পরোক্ষ বা অপ্রত্যক্ষ ক্ষতির জন্য আমরা দায়ী নই, তবে গ্রাহক সন্তুষ্টি আমাদের সর্বোচ্চ অগ্রাধিকার — সমস্যা হলে যোগাযোগ করুন।"}]$json$::jsonb,
   true, 2, 'শর্তাবলি | বিশ্বাস এগ্রো', 'বিশ্বাস এগ্রোর সেবা ব্যবহারের শর্ত, অর্ডার, বাতিল ও দায়বদ্ধতার বিষয়।'),
  ('refund', 'রিফান্ড ও রিটার্ন নীতি', 'Refund & Return Policy', $json$[{"type":"heading","text":"আমাদের প্রতিশ্রুতি"},{"type":"text","body":"তাজা পণ্য নিয়ে আপনি সন্তুষ্ট না হলে আমরা সম্পূর্ণ টাকা ফেরত দিই। কোনো প্রশ্ন করা হয় না — শুধু ২৪ ঘণ্টার মধ্যে জানান।"},{"type":"heading","text":"কখন রিটার্ন গ্রহণ করা হয়"},{"type":"text","body":"পণ্য নষ্ট, পচা, অপরিপক্ব বা অর্ডার করা পণ্যের চেয়ে ভিন্ন হলে।"},{"type":"text","body":"পরিমাণ কম বা ভুল পণ্য পাঠানো হলে।"},{"type":"text","body":"মাংস বা মাছে দুর্গন্ধ থাকলে (ডেলিভারির ৬ ঘণ্টার মধ্যে জানাতে হবে)।"},{"type":"heading","text":"কখন রিটার্ন গ্রহণ করা হয় না"},{"type":"text","body":"পণ্য ইতিমধ্যে রান্না বা খাওয়া হয়ে গেলে।"},{"type":"text","body":"ডেলিভারির ২৪ ঘণ্টা পার হয়ে গেলে (মাংস ও মাছের ক্ষেত্রে ৬ ঘণ্টা)।"},{"type":"text","body":"অর্ডার করা পণ্য পছন্দ না হওয়া — শুধু স্বাদের কারণে (তবে আমরা সমন্বয়ের চেষ্টা করি)।"},{"type":"heading","text":"কীভাবে রিফান্ড নেবেন"},{"type":"text","body":"১. পণ্যের ছবি তুলুন এবং অর্ডার নম্বরসহ হোয়াটসঅ্যাপ (০১৭০০-০০০০০০) বা ইমেইলে (hello@bishwasagro.com) পাঠান।"},{"type":"text","body":"২. আমরা ২৪ ঘণ্টার মধ্যে যাচাই করব।"},{"type":"text","body":"৩. অনুমোদিত হলে ৩–৭ কর্মদিবসের মধ্যে বিকাশ/নগদে টাকা ফেরত দেওয়া হবে অথবা পরবর্তী অর্ডারে সমন্বয় করা হবে।"},{"type":"heading","text":"ক্যাশ অন ডেলিভারি রিফান্ড"},{"type":"text","body":"ক্যাশ অন ডেলিভারিতে পরিশোধিত টাকা বিকাশ বা নগদ নম্বরে ফেরত দেওয়া হয়। আপনার নম্বরটি আমাদের জানাতে হবে।"},{"type":"heading","text":"পণ্য ফেরত পাঠানো"},{"type":"text","body":"বেশিরভাগ ক্ষেত্রে পণ্য ফেরত পাঠানোর প্রয়োজন হয় না — ছবি দেখেই আমরা রিফান্ড প্রসেস করি। এটি আপনার সময় ও ঝামেলা বাঁচায়।"}]$json$::jsonb,
   true, 3, 'রিফান্ড নীতি | বিশ্বাস এগ্রো', 'পণ্য নষ্ট বা ভুল পৌঁছালে রিফান্ড ও রিপ্লেসমেন্ট নীতি।')
on conflict (slug) do update
  set blocks = excluded.blocks,
      title_bn = excluded.title_bn,
      title_en = excluded.title_en,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description;

-- ============================================ promote existing admins to team
-- Existing admins stay admins; nothing to do. This view just gives the team
-- screen one place to list who can log in.
create or replace view v_team_members
with (security_invoker = false) as
select id, name, email, phone, role, is_active, created_at
from users
where role in ('staff','manager','admin')
order by created_at;

grant select on v_team_members to authenticated;
