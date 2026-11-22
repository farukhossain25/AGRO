-- ============================================================================
-- 0006 — SEO content + editable per-page metadata
-- ============================================================================
-- Run AFTER 0001 → 0005.
--
-- Two things happen here:
--
--   1. `seo_meta` — one row per route, editable from the admin panel (section
--      D says title/description/OG must be editable). The runtime falls back to
--      the hard-coded defaults in lib/seo.ts when a row is missing or blank, so
--      a half-filled table never breaks a page.
--
--   2. Six keyword-targeted blog posts. The brief asks for organic-traffic
--      Bangla content around "organic food bangladesh", "fresh vegetables
--      delivery dhaka" and "farm to home". Existing 6 posts stay; these add the
--      money keywords and internal links to the category pages.
-- ============================================================================

create extension if not exists pgcrypto;

-- ======================================================== per-route metadata
create table if not exists seo_meta (
  id            uuid primary key default gen_random_uuid(),
  -- canonical route this row describes, e.g. "/", "/products", "/products/:slug"
  path          text unique not null,
  title_bn      text,
  title_en      text,
  description_bn text check (char_length(description_bn) <= 320),
  description_en text check (char_length(description_en) <= 320),
  keywords_bn   text[] default '{}',
  og_title      text,
  og_description text,
  og_image      text,
  canonical     text,
  noindex       boolean not null default false,
  -- per-page verification codes (GA4 / Search Console) when they differ
  ga_measurement_id     text,
  search_console_verification text,
  updated_by    uuid references users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists seo_meta_path_idx on seo_meta(path);

alter table seo_meta enable row level security;

drop policy if exists seo_meta_public_read on seo_meta;
drop policy if exists seo_meta_admin_write on seo_meta;

-- the renderer reads this with the service role, but anon/authenticated may
-- read too so a future client-side editor can show current values
create policy seo_meta_public_read on seo_meta for select using (true);
create policy seo_meta_admin_write on seo_meta
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists seo_meta_updated_at on seo_meta;
create trigger seo_meta_updated_at before update on seo_meta
  for each row execute function public.touch_updated_at();

-- Seed the routes that exist today with their current copy, so the admin editor
-- opens pre-filled instead of blank.
insert into seo_meta (path, title_bn, description_bn, keywords_bn) values
  ('/', 'বিশ্বাস এগ্রো | খামার থেকে আপনার ঘরে',
   'খামার থেকে সরাসরি তাজা শাকসবজি, ফলমূল, দেশি ডিম, মাছ, মাংস, দুধ ও অর্গানিক পণ্য। সারা বাংলাদেশে হোম ডেলিভারি, ক্যাশ অন ডেলিভারি।',
   array['অর্গানিক খাবার বাংলাদেশ','তাজা সবজি ডেলিভারি ঢাকা','খামার থেকে ঘরে','organic food bangladesh','fresh vegetables delivery dhaka']),
  ('/products', 'সব পণ্য — তাজা ও অর্গানিক',
   'বিশ্বাস এগ্রোর সব তাজা ও অর্গানিক পণ্য — শাকসবজি, ফল, ডিম, মাংস, মাছ, দুধ, চাল-ডাল-তেল-মসলা ও মধু। সারা বাংলাদেশে হোম ডেলিভারি।',
   array['অর্গানিক সবজি','দেশি ডিম','খাঁটি মধু','তাজা মাছ']),
  ('/categories', 'ক্যাটাগরি — সবজি, ফল, দুধ, মাছ, মাংস',
   'নয়টি ক্যাটাগরিতে সাজানো তাজা বাজার — শাকসবজি, ফলমূল, দুধ ও দুগ্ধ, ডিম, মাছ, মাংস, চাল-ডাল-তেল, মসলা ও মধু।',
   array['সবজির বাজার','দুধ ও দুগ্ধ','মসলা']),
  ('/market', 'মার্কেটপ্লেস — যাচাইকৃত খামার ও বিক্রেতা',
   'বাংলাদেশের যাচাইকৃত খামার ও বিক্রেতাদের পণ্য এক জায়গায়। প্রতিটি সেলারের রেটিং, অভিযোগের হার ও ডেলিভারি স্কোর দেখে কিনুন।',
   array['farm to home','খামারি পণ্য','মার্কেটপ্লেস']),
  ('/live/farms', 'লাইভ খামার ক্যামেরা',
   'খামারে বসানো লাইভ ক্যামেরা দেখুন — সবজি তোলা, গাভীর দোহন, ডিম বাছাই সবকিছু সরাসরি।',
   array['লাইভ খামার','খামার ক্যামেরা']),
  ('/subscription', 'মাসিক ফুড প্যাকেজ',
   'পরিবারের সদস্য অনুযায়ী মাসিক বাজার প্যাকেজ — নির্দিষ্ট দিনে ঘরে পৌঁছে যাবে, যেকোনো সময় পজ বা বাতিল।',
   array['মাসিক বাজার প্যাকেজ','ফুড সাবস্ক্রিপশন']),
  ('/blog', 'ব্লগ — স্বাস্থ্য, রান্না ও খামারের গল্প',
   'খাঁটি খাবার চেনার উপায়, মৌসুমি সবজি, রান্নার টিপস ও আমাদের কৃষকদের গল্প।',
   array['খাঁটি খাবার','মৌসুমি সবজি']),
  ('/faq', 'সাধারণ প্রশ্ন ও উত্তর',
   'ডেলিভারি চার্জ, ডেলিভারি সময়, পেমেন্ট, রিটার্ন ও সাবস্ক্রিপশন নিয়ে সব প্রশ্নের উত্তর।',
   array['ডেলিভারি চার্জ ঢাকা']),
  ('/about', 'আমাদের সম্পর্কে',
   '২০২১ সাল থেকে বাংলাদেশের কৃষকদের কাছ থেকে সরাসরি তাজা ও নিরাপদ খাবার পরিবারের কাছে পৌঁছে দিচ্ছি।',
   array['বিশ্বাস এগ্রো','খামার থেকে ঘরে']),
  ('/contact', 'যোগাযোগ',
   'ফোন, হোয়াটসঅ্যাপ বা ইমেইলে যোগাযোগ করুন — সকাল ৭টা থেকে রাত ১০টা, সপ্তাহে সাত দিন।',
   array['যোগাযোগ'])
on conflict (path) do nothing;

-- ============================================== keyword blog posts (six)
-- `content_bn` uses the same lightweight markdown the renderer supports:
--   ## heading   •  - bullet  •  **bold**  •  blank line = new paragraph
insert into blog_posts (slug, title_bn, excerpt_bn, content_bn, cover, author_bn, tag_bn, read_minutes, published_at, is_active) values
(
  'organic-food-bangladesh-guide',
  'অর্গানিক খাবার বাংলাদেশে চেনার সহজ উপায়',
  'বাজারে “অর্গানিক” লেখা অনেক প্যাকেট, কিন্তু আসল অর্গানিক কীভাবে চিনবেন? পেস্টিসাইড রেসিডিউ, সার্টিফিকেশন ও দামের হিসাব নিয়ে সম্পূর্ণ গাইড।',
  '## “অর্গানিক” মানে আসলে কী?

অর্গানিক মানে শুধু “কীটনাশক ছাড়া” নয় — মাটি, পানি, বীজ ও ফসল তোলার পরের প্রক্রিয়া সবকিছু একটি নির্দিষ্ট নিয়মে চলে।

- কৃত্রিম সার ও পেস্টিসাইড ব্যবহার নিষিদ্ধ
- বীজ সাধারণত দেশি বা অর্গানিক সার্টিফাইড
- ফসল তোলার পর কৃত্রিম রঙ বা প্রিজারভেটিভ নেই
- জমি অন্তত তিন বছর রাসায়নিকমুক্ত থাকতে হয়

## বাংলাদেশে সার্টিফিকেশন

দেশে এখনো সর্বজনীন অর্গানিক লেবেল নেই। তাই নির্ভর করতে হয়:

- খামারের সরাসরি তথ্য (কোথায়, কে চাষ করছে)
- ব্যাচভিত্তিক ল্যাব টেস্ট রিপোর্ট
- বিক্রেতার ট্র্যাক রেকর্ড — রিভিউ ও অভিযোগের হিসাব

## দাম বেশি হলে কী লাভ?

অর্গানিক চাষে ফলন ২০–৩০% কম হয়, তাই দাম একটু বেশি। কিন্তু পুষ্টিগুণ ও স্বাদে পার্থক্য থাকে, এবং শিশুদের ক্ষেত্রে কীটনাশকের দীর্ঘমেয়াদি ঝুঁকি কমে।

## কীভাবে শুরু করবেন

১. প্রথমে কম দামের শাকসবজি দিয়ে শুরু করুন — লাউ, কুমড়া, শাক
২. প্রতিটি পণ্যের খামার ও ব্যাচ নম্বর দেখুন
৩. স্বাদ ও ঘ্রাণে পার্থক্য বুঝুন — অর্গানিক টমেটো বেশি সুগন্ধি হয়

[সবজির ক্যাটাগরি দেখুন](/categories/shakshobji) · [লাইভ খামার দেখুন](/live/farms)',
  '/images/cat/vegetables.jpg', 'বিশ্বাস এগ্রো টিম', 'অর্গানিক গাইড', 7, now() - interval '3 days', true
),
(
  'fresh-vegetables-delivery-dhaka',
  'ঢাকায় তাজা সবজি হোম ডেলিভারি — কীভাবে সবচেয়ে তাজা পাবেন',
  'সকালে তোলা সবজি সন্ধ্যায় আপনার রান্নাঘরে — ঢাকায় ফার্ম-টু-হোম ডেলিভারির সম্পূর্ণ সময়সূচি, চার্জ ও সংরক্ষণের টিপস।',
  '## কেন সময় গুরুত্বপূর্ণ

সবজি তোলার পর প্রতি ঘণ্টায় ভিটামিন সি কমতে থাকে। ভোর ৫টায় তোলা সবজি সন্ধ্যায় পৌঁছালে ১২–১৪ ঘণ্টার মধ্যে রান্নায় চলে যায় — বাজারের পথে ২–৩ দিন ঘোরার পর বিক্রি হওয়া সবজির চেয়ে অনেক ভালো।

## ঢাকায় আমাদের সময়সূচি

- সকাল ১০টার আগে অর্ডার → একই দিন সন্ধ্যা ৬–৯টায় ডেলিভারি
- দুপুর ২টার আগে অর্ডার → পরদিন সকালে ডেলিভারি
- রাত ৮টার পর অর্ডার → পরদিন সকালে ডেলিভারি

## ডেলিভারি চার্জ

- ঢাকা সিটিতে ৳৬০
- ৳১,২০০+ অর্ডারে ঢাকায় ফ্রি
- ঢাকার উপকণ্ঠে ৳৮০–১০০

## সবজি তাজা রাখার ৫টি নিয়ম

- ধোয়ার আগে সংরক্ষণ করুন — পানি থাকলে দ্রুত নষ্ট হয়
- সবুজ শাক ভেজা কাপড়ে মুড়ে ফ্রিজে
- টমেটো ও বেগুন ঘরের তাপমাত্রায় রাখুন
- আলু-পেঁয়াজ অন্ধকার, শুকনো জায়গায়
- কাটা সবজি এয়ারটাইট বক্সে ২ দিনের মধ্যে শেষ করুন

[সব পণ্য দেখুন](/products) · [মাসিক প্যাকেজ](/subscription)',
  '/images/cat/vegetables.jpg', 'বিশ্বাস এগ্রো টিম', 'ডেলিভারি গাইড', 6, now() - interval '8 days', true
),
(
  'farm-to-home-bangladesh',
  'ফার্ম টু হোম: মধ্যস্বত্বভোগী বাদ দিলে কৃষক ও ক্রেতা দুজনেই লাভবান',
  'ঢাকার বাজারে যে টমেটোর দাম ৬০ টাকা, খামারে তার দাম ২০ টাকা — বাকি ৪০ টাকা কোথায় যায়? সরাসরি কেনাকাটার হিসাব।',
  '## দামের ব্যবধান কোথায় যায়

খামার থেকে আপনার প্লেট পর্যন্ত একটি সবজি সাধারণত ৪–৬ হাত ঘোরে: ফড়িয়া, আড়ত, পাইকারি বাজার, খুচরা বাজার, তারপর ক্রেতা। প্রত্যেক ধাপে ১০–২০% যোগ হয়, আর পথে ২০–৩০% নষ্ট হয়।

## সরাসরি মডেলে কী বদলায়

- কৃষক খুচরা দামের ৫৫–৬৫% পান (আগে ২৫–৩০%)
- ক্রেতা পাবেন খুচরা বাজারের চেয়ে ১০–২০% কম দাম
- পণ্য ২–৩ দিনের বদলে ১২–১৪ ঘণ্টায় পৌঁছায়
- কোন খামারের পণ্য, সেটি জানা যায়

## আমাদের প্রতিশ্রুতি

প্রতিটি পণ্যের সাথে খামারের নাম, জেলা ও ব্যাচ নম্বর থাকে। বিক্রেতার রেটিং ও অভিযোগের হিসাব প্রকাশ্যে দেখা যায় — অর্থাৎ কোয়ালিটি নিয়ে লুকোচুরি নেই।

[মার্কেটপ্লেস দেখুন](/market) · [আমাদের খামার](/farm)',
  '/images/hero/farm.jpg', 'বিশ্বাস এগ্রো টিম', 'খামার', 6, now() - interval '15 days', true
),
(
  'deshi-dim-vs-farm-egg',
  'দেশি ডিম বনাম ফার্মের ডিম — পার্থক্য চেনার ৫টি পরীক্ষা',
  'রঙ, কুসুমের গঠন, খোসার পুরুত্ব আর স্বাদ — কোনটা আসল দেশি ডিম, ঘরেই পরীক্ষা করুন।',
  '## ১. কুসুমের রঙ

গাঢ় কমলা-হলুদ কুসুম সাধারণত দেশি বা ফ্রি-রেঞ্জ মুরগির। তবে রঙ খাবারের উপরও নির্ভর করে (যেমন ক্যারোটিনযুক্ত খাবার), তাই এটি একমাত্র প্রমাণ নয়।

## ২. কুসুমের গঠন

দেশি ডিমের কুসুম বেশি টাইট, আঙুলে তুললে সহজে ছড়ায় না। ফার্মের ডিমের কুসুম পাতলা হয়।

## ৩. খোসার পুরুত্ব

দেশি মুরগির খোসা মোটা ও অমসৃণ হয়; ফার্মের ডিমের খোসা পাতলা ও সমান।

## ৪. সাদা অংশ

দেশি ডিমে সাদা অংশ কম, কুসুম বড় — অনুপাত প্রায় ১:১। ফার্মের ডিমে সাদা অংশ অনেক বেশি।

## ৫. স্বাদ ও গন্ধ

দেশি ডিমে হালকা মিষ্টি গন্ধ থাকে, ভাজার সময় ছড়িয়ে পড়ে। ফার্মের ডিমে সেই গন্ধ কম।

## দামের হিসাব

দেশি ডিম সাধারণত ২২–২৮ টাকা, ফার্মের ডিম ১০–১৩ টাকা। পুষ্টিগুণে বড় পার্থক্য না থাকলেও স্বাদ ও ওমেগা-৩ অনুপাতে দেশি ডিম এগিয়ে।

[ডিমের ক্যাটাগরি](/categories/deshi-dim)',
  '/images/cat/eggs.jpg', 'বিশ্বাস এগ্রো টিম', 'পুষ্টি', 5, now() - interval '22 days', true
),
(
  'shiter-moushumi-sabji-dam-guide',
  'শীতে তাজা সবজি কেনার আগে যা জানা দরকার — মৌসুমি তালিকা ও দাম',
  'শীতে কোন সবজি সবচেয়ে ভালো, কোনটি এড়িয়ে চলবেন, আর কীভাবে দামে কম পড়বেন — মৌসুমি গাইড।',
  '## শীতের সেরা সবজি

ডিসেম্বর থেকে ফেব্রুয়ারি বাংলাদেশের সবজির সোনালি সময়। ফুলকপি, বাঁধাকপি, গাজর, মটরশুঁটি, টমেটো, শিম, লালশাক — সবই এই সময়ে সবচেয়ে মিষ্টি ও সস্তা।

## কোন সবজি এড়িয়ে চলবেন

গ্রীষ্মকালীন সবজি (যেমন ঢেঁড়স, পটল) শীতে পলিহাউসে হয় — দাম বেশি, স্বাদ কম। এই সময়ে মৌসুমি সবজিতেই থাকুন।

## দাম কম রাখার উপায়

- মৌসুমের শুরুতেই মাসিক প্যাকেজ নিন — দাম আগেই ঠিক হয়ে যায়
- বড় আকারে কিনে কেটে ফ্রিজে রাখুন (গাজর, মটরশুঁটি)
- সপ্তাহে একবার বড় অর্ডার করুন, ডেলিভারি চার্জ বাঁচবে

## সংরক্ষণ

মটরশুঁটি খোসা ছাড়িয়ে ব্লাঞ্চ করে ফ্রিজে রাখলে ৬ মাস ভালো থাকে। গাজর পলিব্যাগে ছিদ্র করে রাখুন, ভেজা অবস্থায় নয়।

[শাকসবজি ক্যাটাগরি](/categories/shakshobji) · [মাসিক প্যাকেজ](/subscription)',
  '/images/cat/vegetables.jpg', 'বিশ্বাস এগ্রো টিম', 'মৌসুমি', 5, now() - interval '30 days', true
),
(
  'modhu-test-lab-vs-ghoroa-porikkha',
  'খাঁটি মধু চেনা: ঘরোয়া পরীক্ষা বনাম ল্যাব টেস্ট',
  'পানি পরীক্ষা, আঙুল পরীক্ষা, পিঁপড়া পরীক্ষা — কোনটা আসলে কাজ করে আর কোনটা ভুল ধারণা, জেনে নিন।',
  '## যা আসলে কাজ করে

### ১. পানিতে মিশিয়ে দেখা

এক গ্লাস পানিতে এক চামচ মধু দিলে খাঁটি মধু তলায় গিয়ে জমে; ভেজাল মধু সহজে মিশে যায়।

### ২. আঙুলে ফোঁটা

খাঁটি মধু আঙুলে ফোঁটা দিলে ছড়ায় না, ধীরে গড়িয়ে পড়ে।

### ৩. কাগজ পরীক্ষা

টিস্যু পেপারে এক ফোঁটা মধু দিলে খাঁটি মধু ভিজে যায় না; চিনির সিরাপ দ্রুত ভিজিয়ে ফেলে।

### ৪. দীর্ঘদিন রাখা

খাঁটি মধু বছরের পর বছর নষ্ট হয় না। চিনি মেশানো মধু কয়েক মাসেই গাঁজন করে।

## যা ভুল ধারণা

- **পিঁপড়া আসে না** — এটি নির্ভরযোগ্য নয়, আর্দ্রতার উপর নির্ভর করে
- **জ্বাল দিলে ফেনা হয়** — ভেজাল মধুতেও হয়
- **সূতা দিয়ে ফোঁটা** — অভিজ্ঞতা ছাড়া বোঝা কঠিন, সুতার মানের উপরও নির্ভর করে

## আসল পরীক্ষা ল্যাবে

সবচেয়ে নির্ভরযোগ্য হলো ল্যাব টেস্ট: সুক্রোজ, ফ্রুক্টোজ-গ্লুকোজ অনুপাত, HMF ও ডায়াস্টেজ। আমরা প্রতিটি ব্যাচের টেস্ট রিপোর্ট রাখি।

[মধু কিনুন](/categories/modhu-organic)',
  '/images/cat/honey.jpg', 'বিশ্বাস এগ্রো টিম', 'পরীক্ষা', 4, now() - interval '38 days', true
)
on conflict (slug) do nothing;

-- ============================================ home + sitemap sanity check
-- Views are handy when auditing from the Supabase SQL editor.
create or replace view v_seo_coverage
with (security_invoker = false) as
select
  (select count(*) from seo_meta)                                        as routes_with_meta,
  (select count(*) from products where is_active)                         as products,
  (select count(*) from categories where is_active)                       as categories,
  (select count(*) from blog_posts where is_active)                       as posts,
  (select count(*) from blog_posts where is_active and coalesce(char_length(content_bn),0) > 800) as substantial_posts;

grant select on v_seo_coverage to authenticated;
