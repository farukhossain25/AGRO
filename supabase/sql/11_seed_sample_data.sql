-- ============================================================================
-- 11_seed_sample_data.sql  (OPTIONAL)
-- ============================================================================
-- WHAT IT DOES
--   Fills an empty store with demo content so every public page and every
--   /foisal screen has something to show:
--     9 categories · 5 farms · 10 cameras · 3 seller placeholders ·
--     47 Bangla products · 4 combos · 3 subscription plans · 11 delivery rates ·
--     4 payment methods (bKash/Nagad/Rocket/COD placeholders) · 3 premium plans ·
--     default site settings · 1 sample coupon · 12 homepage sections ·
--     3 hero slides (text only, no images) · FAQ · menus · 3 policy pages ·
--     6 blog posts · review tags
--
-- WHEN TO RUN
--   Optional. After 10_indexes_and_views.sql, before 12_make_admin.sql.
--   Skip it for a clean production launch and add your own products instead.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--   Then: products = 47, categories = 9, farms = 5, cameras = 10,
--   payment_methods = 4, plans = 3, homepage_sections = 12, hero_slides = 3
--   (13_verify_setup.sql prints these counts for you).
--
-- IMPORTANT
--   • Every payment receiving number below is a PLACEHOLDER (01XXXXXXXXX).
--     Replace it in /foisal → পেমেন্ট মাধ্যম before taking a real order.
--   • The seller rows have user_id = NULL on purpose: they are demo stores.
--   • Re-running is safe: inserts are guarded by slug/code/key.
-- ============================================================================

begin;

-- ------------------------------------------------------------ site settings --
insert into public.site_settings (key, value) values
  ('store', '{"name_bn":"বিশ্বাস এগ্রো","name_en":"Biswas Agro","tagline_bn":"বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে","phone":"01700000000","whatsapp":"01700000000","email":"hello@bishwasagro.com","address_bn":"ঢাকা, বাংলাদেশ","logo_url":"","favicon_url":"/favicon.svg","currency":"BDT","primary_color":"#1f7a4d"}'::jsonb),
  ('delivery', '{"inside_dhaka":60,"outside_dhaka":120,"free_over":1200,"combo_free_delivery":true}'::jsonb),
  ('seller', '{"auto_approve":false,"default_commission_percent":10}'::jsonb),
  ('reviews', '{"auto_publish":true,"max_photos":3,"edit_window_days":7,"low_rating_threshold":2}'::jsonb),
  ('premium', '{"trial_minutes":10,"grace_days":3,"default_device_limit":2,"max_viewers_per_camera":50}'::jsonb),
  ('announcement', '{"text_bn":"সকাল ১০টার আগে অর্ডার করলে আজই ডেলিভারি — ঢাকার ভেতরে ফ্রি ডেলিভারি ১২০০৳+ অর্ডারে","is_active":true}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------- 9 categories --
insert into public.categories (slug, name_bn, name_en, icon, image, sort_order, is_active) values
  ('shakshobji', 'তাজা শাকসবজি', 'Fresh Vegetables', '🥬', '/images/cat/vegetables.jpg', 1, true),
  ('folmul', 'ফলমূল', 'Fruits', '🥭', '/images/cat/fruits.jpg', 2, true),
  ('deshi-dim', 'দেশি ডিম', 'Eggs', '🥚', '/images/cat/eggs.jpg', 3, true),
  ('mangsho', 'মাংস ও পোল্ট্রি', 'Meat & Poultry', '🥩', '/images/cat/meat.jpg', 4, true),
  ('mach', 'মাছ', 'Fish', '🐟', '/images/cat/fish.jpg', 5, true),
  ('dudh-dudhgiyo', 'দুধ ও দুগ্ধজাত পণ্য', 'Milk & Dairy', '🥛', '/images/cat/dairy.jpg', 6, true),
  ('chal-dal-mosla', 'চাল, ডাল, তেল ও মসলা', 'Rice, Lentils, Oil & Spices', '🌾', '/images/cat/staples.jpg', 7, true),
  ('modhu-organic', 'মধু ও অর্গানিক পণ্য', 'Honey & Organic', '🍯', '/images/cat/honey.jpg', 8, true),
  ('krishi-upokoron', 'কৃষি উপকরণ', 'Agri Inputs', '🌱', '/images/cat/agri.jpg', 9, true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------- 5 farms --
insert into public.farms (
  slug, name_bn, name_en, type, owner_name_bn, owner_phone, owner_bio_bn,
  division, district, upazila, address_bn, lat, lng, description_bn, story_bn,
  cover, images, established_year, certifications, is_active, is_premium, sort_order
) values
  ('savar-greens', 'সাভার গ্রিনস', 'Savar Greens', 'vegetables', 'মোঃ রহিম উদ্দিন', '01700000001',
   'তিন প্রজন্ম ধরে সাভারে শাক চাষ করছেন রহিম ভাই।', 'ঢাকা', 'ঢাকা', 'সাভার', 'সাভার, ঢাকা',
   23.8583, 90.2667, 'জৈব পদ্ধতিতে চাষ করা তাজা শাকসবজির খামার।',
   'প্রতিদিন ভোর ৫টায় সবজি তোলা হয় — কোনো গুদাম নেই।',
   '/images/hero/farm.jpg', array['/images/cat/vegetables.jpg','/images/hero/farm.jpg'],
   2003, array['জৈব সার','বালাইনাশ ছাড়া'], true, true, 1),
  ('tangail-dairy', 'টাঙ্গাইল ডেইরি', 'Tangail Dairy', 'dairy', 'আব্দুল করিম', '01700000002',
   '৩৫টি দেশি গরুর খামার, প্রতিদিন সকালে দুধ দোয়ানো হয়।', 'ঢাকা', 'টাঙ্গাইল', 'মধুপুর', 'মধুপুর, টাঙ্গাইল',
   24.2500, 90.0500, 'খাঁটি দেশি গরুর দুধ ও ঘি।', 'কোনো প্যাকেট দুধ নয় — দোয়ানোর ৩ ঘণ্টার মধ্যে ডেলিভারি।',
   '/images/cat/dairy.jpg', array['/images/cat/dairy.jpg'], 1998, array['লাইসেন্সড ডেইরি'], true, true, 2),
  ('rajshahi-mango', 'রাজশাহী আমবাগান', 'Rajshahi Mango Orchard', 'fruits', 'শাহিদুল ইসলাম', '01700000003',
   'চাঁপাইনবাবগঞ্জের আমবাগানের মালিক।', 'রাজশাহী', 'চাঁপাইনবাবগঞ্জ', 'শিবগঞ্জ', 'শিবগঞ্জ, চাঁপাইনবাবগঞ্জ',
   24.9500, 88.2500, 'গাছপাকা আম ও ফল।', 'কার্বাইড ছাড়া, গাছেই পাকা আম।',
   '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg'], 2010, array['জিআই আম'], true, true, 3),
  ('jashore-vegetables', 'যশোর ফ্রেশ', 'Jashore Fresh', 'vegetables', 'ফাতেমা বেগম', '01700000004',
   'নারী উদ্যোক্তা, ৩৫ কৃষক পরিবারের সমবায়।', 'খুলনা', 'যশোর', 'সদর', 'যশোর সদর, খুলনা',
   23.1667, 89.2167, 'সমবায়ভিত্তিক সবজি খামার।', 'ক্ষুদ্র কৃষকদের ফসল সরাসরি আপনার রান্নাঘরে।',
   '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg'], 2015, array['সমবায়'], true, true, 4),
  ('gazipur-poultry', 'গাজীপুর পোল্ট্রি', 'Gazipur Poultry', 'poultry', 'মোছাঃ নাসরিন আক্তার', '01700000005',
   'দেশি মুরগি ও ডিমের খামার।', 'ঢাকা', 'গাজীপুর', 'সদর', 'গাজীপুর সদর, ঢাকা',
   24.0000, 90.4200, 'দেশি মুরগি, ডিম ও হাঁস।', 'মুক্তভাবে ঘুরে বেড়ানো মুরগি — অ্যান্টিবায়োটিক ছাড়া।',
   '/images/cat/eggs.jpg', array['/images/cat/eggs.jpg'], 2012, array['ফ্রি রেঞ্জ'], true, true, 5)
on conflict (slug) do nothing;

-- ------------------------------------------------- 3 seller stores (demo) ----
insert into public.sellers (
  slug, farm_id, name_bn, phone, email, farm_address_bn, division, district,
  product_types, payout_method, payout_number, commission_percent, status, approved_at
) values
  ('savar-organic', (select id from public.farms where slug = 'savar-greens'), 'সাভার অর্গানিক', '01700000001',
   'savar@example.com', 'সাভার, ঢাকা', 'ঢাকা', 'ঢাকা', array['সবজি','শাক'], 'bkash', '01700000001', 10, 'approved', now()),
  ('tangail-dairy-farm', (select id from public.farms where slug = 'tangail-dairy'), 'টাঙ্গাইল ডেইরি ফার্ম', '01700000002',
   'tangail@example.com', 'মধুপুর, টাঙ্গাইল', 'ঢাকা', 'টাঙ্গাইল', array['দুধ','ঘি','ডিম'], 'bkash', '01700000002', 12, 'approved', now()),
  ('jashore-fresh', (select id from public.farms where slug = 'jashore-vegetables'), 'যশোর ফ্রেশ', '01700000004',
   'jashore@example.com', 'যশোর সদর, খুলনা', 'খুলনা', 'যশোর', array['সবজি','ফল'], 'nagad', '01700000004', 10, 'approved', now())
on conflict (slug) do nothing;

-- --------------------------------------------- 10 cameras (2 per farm) ------
insert into public.cameras (farm_id, name_bn, zone_bn, protocol, status, is_active, is_premium, max_viewers, sort_order)
select f.id, v.name_bn, v.zone_bn, 'hls'::public.camera_protocol, 'offline'::public.camera_status, true, true, 50, v.sort_order
from (values
  ('savar-greens', 'সবজি মাঠ — ক্যামেরা ১', 'মাঠ', 1),
  ('savar-greens', 'প্যাকিং শেড — ক্যামেরা ২', 'প্যাকিং', 2),
  ('tangail-dairy', 'গোশালা — ক্যামেরা ১', 'গোশালা', 1),
  ('tangail-dairy', 'দুধ ঘর — ক্যামেরা ২', 'দুগ্ধ ঘর', 2),
  ('rajshahi-mango', 'আমবাগান — ক্যামেরা ১', 'বাগান', 1),
  ('rajshahi-mango', 'প্যাকিং পয়েন্ট — ক্যামেরা ২', 'প্যাকিং', 2),
  ('jashore-vegetables', 'সবজি খেত — ক্যামেরা ১', 'খেত', 1),
  ('jashore-vegetables', 'সংগ্রহ কেন্দ্র — ক্যামেরা ২', 'সংগ্রহ', 2),
  ('gazipur-poultry', 'মুরগির শেড — ক্যামেরা ১', 'শেড', 1),
  ('gazipur-poultry', 'ডিম ঘর — ক্যামেরা ২', 'ডিম ঘর', 2)
) as v(farm_slug, name_bn, zone_bn, sort_order)
join public.farms f on f.slug = v.farm_slug
where not exists (
  select 1 from public.cameras c where c.farm_id = f.id and c.name_bn = v.name_bn
);

-- ------------------------------------------------------- 47 demo products ---
insert into public.products (
  slug, category_id, seller_id, farm_id, name_bn, name_en, description_bn, unit, unit_en,
  price, compare_price, stock, image, farm_source_bn, badge_bn, is_featured, is_active,
  approval_status, rating, review_count, sort_order
) values
  ('palong-shak', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'savar-greens'),
   'পালং শাক', 'Spinach Bundle', 'ভোর ৫টায় সাভারের মাঠ থেকে তোলা কচি পালং শাক। আঁশ ও লোহার ভালো উৎস, রক্তশূন্যতায় উপকারী।', 'আঁটি', 'bunch',
   25, 30, 120, '/images/cat/vegetables.jpg',
   'সাভার, ঢাকা', 'সকালে তোলা', true, true, 'approved',
   4.0, 20, 1),
  ('lal-shak', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'savar-greens'),
   'লাল শাক', 'Red Amaranth', 'লাল শাক ভিটামিন এ, সি ও লৌহে সমৃদ্ধ। প্রতিদিনের বাড়ির রান্নার জন্য টাটকা আঁটি।', 'আঁটি', 'bunch',
   30, 35, 90, '/images/cat/vegetables.jpg',
   'মধুপুর, টাঙ্গাইল', null, false, true, 'approved',
   4.1, 21, 2),
  ('korola', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'savar-greens'),
   'করলা', 'Bitter Gourd', 'রক্তে সুগারের মাত্রা নিয়ন্ত্রণে সহায়ক করলা। ছোট, কচি ও কাঁচের মতো সবুজ।', 'কেজি', 'kg',
   80, 95, 45, '/images/cat/vegetables.jpg',
   'গাজীপুর সদর', 'অর্গানিক', false, true, 'approved',
   4.2, 22, 3),
  ('potol', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'savar-greens'),
   'পটল', 'Pointed Gourd', 'হালকা সবুজ-সাদা ডোরাকাটা পটল, ভাজি ও ঝোলের জন্য আদর্শ।', 'কেজি', 'kg',
   60, 70, 60, '/images/cat/vegetables.jpg',
   'যশোর সদর', null, false, true, 'approved',
   4.3, 23, 4),
  ('dherosh', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'savar-greens'),
   'ঢেঁড়স', 'Okra', 'কচি ঢেঁড়স, ভেতরে নরম বিচি — ভুনা ও ভাজি দুইয়ের জন্যই সেরা।', 'কেজি', 'kg',
   65, 75, 55, '/images/cat/vegetables.jpg',
   'নরসিংদী সদর', null, false, true, 'approved',
   4.4, 24, 5),
  ('begun', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'savar-greens'),
   'বেগুন', 'Brinjal (Eggplant)', 'চিকন বেগুন ও গোল বেগুনের মিশ্রণ। ফুলকপির মতো ভেতরে নরম, ভর্তায় দুর্দান্ত।', 'কেজি', 'kg',
   55, 65, 80, '/images/cat/vegetables.jpg',
   'যশোর সদর', 'তাজা', true, true, 'approved',
   4.5, 25, 6),
  ('tokori', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'savar-greens'),
   'কাঁচা মরিচ', 'Green Chilli', 'ঝাঁঝালো কাঁচা মরিচ — বাজারের থেকে তাজা ও পরিষ্কার।', '১০০ গ্রাম', 'piece',
   15, 20, 200, '/images/cat/vegetables.jpg',
   'সাভার, ঢাকা', null, false, true, 'approved',
   4.6, 26, 7),
  ('kacha-tomato', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'savar-greens'),
   'টমেটো', 'Tomato', 'পাকা টমেটো, সালাদ ও সসের জন্য। রসালো ও মিষ্টি স্বাদ।', 'কেজি', 'kg',
   70, 85, 0, '/images/cat/vegetables.jpg',
   'রাজশাহী সদর', 'শেষ হচ্ছে', false, true, 'approved',
   4.7, 27, 8),
  ('kumra', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'savar-greens'),
   'মিষ্টি কুমড়া', 'Sweet Pumpkin', 'মিষ্টি স্বাদের দেশি কুমড়া — ভর্তা, চচ্চড়ি ও পায়েসে দুর্দান্ত।', 'কেজি', 'kg',
   40, null, 35, '/images/cat/vegetables.jpg',
   'মুন্সিগঞ্জ সদর', null, false, true, 'approved',
   4.8, 28, 9),
  ('mula', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'savar-greens'),
   'মূলা', 'Radish', 'শীতের কচি মূলা, ঝালি-সালাদের জন্য নরম ও রসালো।', 'কেজি', 'kg',
   35, 45, 70, '/images/cat/vegetables.jpg',
   'শ্রীপুর, গাজীপুর', null, false, true, 'approved',
   4.9, 29, 10),
  ('fulkopi', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'savar-greens'),
   'ফুলকপি', 'Cauliflower', 'সাদা ফুলকপি, ঘরে তুলে আনা — তরকারি ও রোস্টের জন্য সেরা।', 'পিস', 'pc',
   50, 60, 40, '/images/cat/vegetables.jpg',
   'যশোর সদর', null, false, true, 'approved',
   4.0, 30, 11),
  ('bashor-alu', (select id from public.categories where slug = 'shakshobji'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'savar-greens'),
   'আলু', 'Potato', 'দেশি জাতের আলু — রান্নায় মিষ্টি স্বাদ ও কম ভাঙে।', 'কেজি', 'kg',
   30, 35, 300, '/images/cat/vegetables.jpg',
   'মুন্সিগঞ্জ সদর', null, false, true, 'approved',
   4.1, 31, 12),
  ('himsagar-aam', (select id from public.categories where slug = 'folmul'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'হিমসাগর আম', 'Himsagar Mango', 'চাঁপাইনবাবগঞ্জ-সাতক্ষীরার বিখ্যাত হিমসাগর আম — আঁশহীন, মিষ্টি ও সুগন্ধি। বিছানায় রেখে ২ দিন পাক করুন।', 'কেজি', 'kg',
   120, 150, 60, '/images/cat/fruits.jpg',
   'সাতক্ষীরা সদর', 'মৌসুমি', true, true, 'approved',
   4.2, 32, 13),
  ('litchu', (select id from public.categories where slug = 'folmul'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'লিচু', 'Litchi', 'দিনাজপুরের রসালো লিচু — ছোট বিচি, পাতলা খোসা, অত্যন্ত মিষ্টি।', '১০০ পিস', 'piece',
   180, 220, 25, '/images/cat/fruits.jpg',
   'দিনাজপুর সদর', 'সীমিত', true, true, 'approved',
   4.3, 33, 14),
  ('deshi-kola', (select id from public.categories where slug = 'folmul'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'সবরি দেশি কলা', 'Sabri Banana', 'দেশি সবরি কলা — প্রাকৃতিকভাবে সিরা, কোনো রাসায়নিক ক্যালসিয়াম কার্বাইড নয়।', 'ডজন', 'dozen',
   60, 75, 90, '/images/cat/fruits.jpg',
   'যশোর সদর', null, false, true, 'approved',
   4.4, 34, 15),
  ('peyara', (select id from public.categories where slug = 'folmul'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'পেয়ারা', 'Guava', 'ভিটামিন সি সমৃদ্ধ রসালো পেয়ারা, খেতে মিষ্টি ও সুগন্ধি।', 'কেজি', 'kg',
   90, 110, 45, '/images/cat/fruits.jpg',
   'বরিশাল সদর', null, false, true, 'approved',
   4.5, 35, 16),
  ('papaya', (select id from public.categories where slug = 'folmul'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'পেঁপে', 'Papaya', 'হলুদ-লাল শাঁসের পাকা পেঁপে — হজমে সহায়ক ও স্কিনের জন্য ভালো।', 'কেজি', 'kg',
   45, 55, 50, '/images/cat/fruits.jpg',
   'গাজীপুর সদর', null, false, true, 'approved',
   4.6, 36, 17),
  ('anarosh', (select id from public.categories where slug = 'folmul'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'আনারস', 'Pineapple', 'মধুপুরের জাম্বুরা-মিষ্টি আনারস, সুবাসে ভরপুর।', 'পিস', 'pc',
   80, 95, 30, '/images/cat/fruits.jpg',
   'মধুপুর, টাঙ্গাইল', null, false, true, 'approved',
   4.7, 37, 18),
  ('deshi-murgir-dim', (select id from public.categories where slug = 'deshi-dim'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'দেশি মুরগির ডিম', 'Free-range Country Eggs', 'মুক্ত চারণে বেড়ে ওঠা মুরগির ডিম — গাঢ় কমলা কুসুম, ঘন শাঁস, দুর্গন্ধহীন।', 'ডজন', 'dozen',
   180, 200, 100, '/images/cat/eggs.jpg',
   'টাঙ্গাইল সদর', 'বেস্ট সেলার', true, true, 'approved',
   4.8, 38, 19),
  ('hasher-dim', (select id from public.categories where slug = 'deshi-dim'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'হাঁসের ডিম', 'Duck Eggs', 'বড় আকারের হাঁসের ডিম — কেক, পিঠা ও নাস্তায় দুর্দান্ত।', 'ডজন', 'dozen',
   210, 230, 55, '/images/cat/eggs.jpg',
   'বরিশাল সদর', null, false, true, 'approved',
   4.9, 39, 20),
  ('broiler-dim', (select id from public.categories where slug = 'deshi-dim'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'ফার্মের ডিম', 'Farm Eggs', 'দৈনন্দিন রান্নার জন্য সাশ্রয়ী ফার্ম ডিম, প্রতিদিন তাজা সংগ্রহ।', 'ডজন', 'dozen',
   130, 145, 200, '/images/cat/eggs.jpg',
   'গাজীপুর সদর', null, false, true, 'approved',
   4.0, 40, 21),
  ('koli-dim', (select id from public.categories where slug = 'deshi-dim'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'কোলি মুরগির ডিম', 'Quail Eggs', 'ছোট কিন্তু পুষ্টিগুণে ভরপুর কোয়েল (কোলি) ডিম।', '৩০ পিস', 'piece',
   120, 140, 40, '/images/cat/eggs.jpg',
   'নরসিংদী সদর', 'নতুন', false, true, 'approved',
   4.1, 41, 22),
  ('deshi-murgi-full', (select id from public.categories where slug = 'mangsho'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'দেশি মুরগি (কাটা)', 'Country Chicken (cut)', 'দেশি জাতের মুরগি, অর্ডার পাওয়ার পর জবাই করে কাটা হয়। কোনো অ্যান্টিবায়োটিক নেই।', 'কেজি', 'kg',
   520, 560, 20, '/images/cat/meat.jpg',
   'কিশোরগঞ্জ সদর', 'হালাল', true, true, 'approved',
   4.2, 42, 23),
  ('broiler-murgi', (select id from public.categories where slug = 'mangsho'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'jashore-vegetables'),
   'ব্রয়লার মুরগি (কাটা)', 'Broiler Chicken (cut)', 'টাটকা ব্রয়লার মাংস, পরিষ্কার কাটা ও আইস প্যাকে ডেলিভারি।', 'কেজি', 'kg',
   190, 210, 35, '/images/cat/meat.jpg',
   'গাজীপুর সদর', null, false, true, 'approved',
   4.3, 43, 24),
  ('gorur-mangsho', (select id from public.categories where slug = 'mangsho'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'গরুর মাংস (বোনলেস)', 'Beef Boneless', 'দেশি গরুর বোনলেস মাংস, মাংসের রঙ লাল ও চর্বি কম। ২ কেজি অর্ডারে ফ্রি হাড়।', 'কেজি', 'kg',
   820, 880, 15, '/images/cat/meat.jpg',
   'সিরাজগঞ্জ সদর', 'প্রিমিয়াম', true, true, 'approved',
   4.4, 44, 25),
  ('chagol-mangsho', (select id from public.categories where slug = 'mangsho'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'savar-greens'),
   'খাসির মাংস', 'Mutton (Goat)', 'ছোট খাসির মাংস — নরম, কম গন্ধ, কোরবানির মতো স্বাদ সারা বছর।', 'কেজি', 'kg',
   1150, 1250, 10, '/images/cat/meat.jpg',
   'রাজবাড়ী সদর', 'হালাল', false, true, 'approved',
   4.5, 45, 26),
  ('murgir-buk', (select id from public.categories where slug = 'mangsho'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'মুরগির বুকের মাংস', 'Chicken Breast', 'চর্বিহীন বুকের মাংস — জিম ও প্রোটিন ডায়েটের জন্য আদর্শ।', '৫০০ গ্রাম', 'piece',
   240, 270, 25, '/images/cat/meat.jpg',
   'গাজীপুর সদর', null, false, true, 'approved',
   4.6, 46, 27),
  ('rui-mach', (select id from public.categories where slug = 'mach'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'রুই মাছ', 'Rohu Fish', 'পদ্মার টাটকা রুই মাছ, পরিষ্কার করে কেটে আইস প্যাকে ডেলিভারি।', 'কেজি', 'kg',
   320, 360, 25, '/images/cat/fish.jpg',
   'চাঁদপুর সদর', 'পদ্মার', true, true, 'approved',
   4.7, 47, 28),
  ('ilish', (select id from public.categories where slug = 'mach'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'jashore-vegetables'),
   'ইলিশ মাছ', 'Hilsa Fish', 'পদ্মা-মেঘনার ইলিশ — ৮০০ গ্রাম+ সাইজ, বরফে সংরক্ষিত, সরাসরি জেলে থেকে।', 'কেজি', 'kg',
   1450, 1600, 8, '/images/cat/fish.jpg',
   'ভোলা সদর', 'মৌসুমি', true, true, 'approved',
   4.8, 48, 29),
  ('tilapia', (select id from public.categories where slug = 'mach'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'তেলাপিয়া', 'Tilapia', 'ফার্মে চাষ করা তেলাপিয়া, কাঁটাযুক্ত কিন্তু মাংস নরম।', 'কেজি', 'kg',
   190, 210, 30, '/images/cat/fish.jpg',
   'ময়মনসিংহ সদর', null, false, true, 'approved',
   4.9, 49, 30),
  ('chingri', (select id from public.categories where slug = 'mach'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'savar-greens'),
   'বাগদা চিংড়ি', 'Tiger Prawn', 'খুলনার বাগদা চিংড়ি — বড় সাইজ, মাথা পরিষ্কার, রান্নায় দ্রুত নরম হয়।', '৫০০ গ্রাম', 'piece',
   680, 750, 12, '/images/cat/fish.jpg',
   'খুলনা সদর', 'রপ্তানি কোয়ালিটি', false, true, 'approved',
   4.0, 20, 31),
  ('koi-mach', (select id from public.categories where slug = 'mach'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'কৈ মাছ', 'Climbing Perch', 'ছোট কৈ মাছ — দুর্বল রোগীর পথ্য, ঝোল করে খেতে দুর্দান্ত।', 'কেজি', 'kg',
   380, 420, 18, '/images/cat/fish.jpg',
   'জামালপুর সদর', null, false, true, 'approved',
   4.1, 21, 32),
  ('khanti-gorur-dudh', (select id from public.categories where slug = 'dudh-dudhgiyo'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'খাঁটি গরুর দুধ', 'Pure Cow Milk', 'সকালে দোহন করা খাঁটি গরুর দুধ, কোনো পাউডার বা পানি মেশানো নেই।', 'লিটার', 'litre',
   130, 150, 40, '/images/cat/dairy.jpg',
   'সিরাজগঞ্জ সদর', 'সকালের দুধ', true, true, 'approved',
   4.2, 22, 33),
  ('deshi-ghi', (select id from public.categories where slug = 'dudh-dudhgiyo'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'দেশি ঘি', 'Desi Ghee', 'ঘি তৈরি করা হয় মাখন থেকে, ধীরে জ্বাল দিয়ে — ঘরোয়া ঘ্রাণ ও দানাদার।', '৫০০ গ্রাম', 'piece',
   750, 850, 15, '/images/cat/dairy.jpg',
   'পাবনা সদর', 'অর্গানিক', true, true, 'approved',
   4.3, 23, 34),
  ('doi', (select id from public.categories where slug = 'dudh-dudhgiyo'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'মিষ্টি দই', 'Sweet Yogurt', 'বগুড়ার বিখ্যাত মিষ্টি দই, মাটির ভাঁড়ে প্যাক করা।', '৫০০ গ্রাম', 'piece',
   150, 170, 25, '/images/cat/dairy.jpg',
   'বগুড়া সদর', null, false, true, 'approved',
   4.4, 24, 35),
  ('chana', (select id from public.categories where slug = 'dudh-dudhgiyo'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'ঘন ছানা', 'Fresh Chhana', 'মিষ্টি তৈরির জন্য ঘন ছানা, ঘরে বানানো — ফরমালিন মুক্ত।', '৫০০ গ্রাম', 'piece',
   260, 280, 20, '/images/cat/dairy.jpg',
   'সিরাজগঞ্জ সদর', null, false, true, 'approved',
   4.5, 25, 36),
  ('miniket-chal', (select id from public.categories where slug = 'chal-dal-mosla'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'মিনিকেট চাল', 'Miniket Rice', 'দেশি মিনিকেট চাল, পলিশ কম — রান্নায় ঝরঝরে ভাত।', '৫ কেজি', 'piece',
   400, 440, 80, '/images/cat/staples.jpg',
   'দিনাজপুর সদর', null, true, true, 'approved',
   4.6, 26, 37),
  ('chinigura-chal', (select id from public.categories where slug = 'chal-dal-mosla'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'চিনিগুঁড়া চাল', 'Chinigura Rice', 'পোলাও-বিরিয়ানির জন্য স্পেশাল চিনিগুঁড়া চাল, সুগন্ধি ও নরম।', '২ কেজি', 'piece',
   320, 350, 45, '/images/cat/staples.jpg',
   'নওগাঁ সদর', 'পোলাও', false, true, 'approved',
   4.7, 27, 38),
  ('masoor-dal', (select id from public.categories where slug = 'chal-dal-mosla'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'jashore-vegetables'),
   'মসুর ডাল', 'Red Lentil', 'দেশি মসুর ডাল, ছোট দানা ও দ্রুত সিদ্ধ হয়।', 'কেজি', 'kg',
   165, 180, 60, '/images/cat/staples.jpg',
   'রাজশাহী সদর', null, false, true, 'approved',
   4.8, 28, 39),
  ('sorisar-tel', (select id from public.categories where slug = 'chal-dal-mosla'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'সরিষার তেল', 'Mustard Oil', 'কাঠের ঘানিতে ভাঙা খাঁটি সরিষার তেল — ঝাঁঝালো ঘ্রাণ ও স্বাদ।', '১ লিটার', 'piece',
   280, 310, 50, '/images/cat/staples.jpg',
   'পাবনা সদর', 'কোল্ড প্রেস', true, true, 'approved',
   4.9, 29, 40),
  ('holud-gura', (select id from public.categories where slug = 'chal-dal-mosla'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'savar-greens'),
   'হলুদ গুঁড়া', 'Turmeric Powder', 'বান্দরবানের পাহাড়ি হলুদ, রোদে শুকিয়ে ভাঙা — রঙে ভরপুর।', '২৫০ গ্রাম', 'piece',
   90, 100, 120, '/images/cat/staples.jpg',
   'বান্দরবান সদর', null, false, true, 'approved',
   4.0, 30, 41),
  ('lanka-gura', (select id from public.categories where slug = 'chal-dal-mosla'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'মরিচ গুঁড়া', 'Chilli Powder', 'তেজা শুকনো লঙ্কা ভাঙা, কোনো কৃত্রিম রং নেই।', '২৫০ গ্রাম', 'piece',
   110, 125, 95, '/images/cat/staples.jpg',
   'বগুড়া সদর', 'ঝাল', false, true, 'approved',
   4.1, 31, 42),
  ('sundarban-modhu', (select id from public.categories where slug = 'modhu-organic'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'rajshahi-mango'),
   'সুন্দরবনের মধু', 'Sundarban Honey', 'সুন্দরবনের খলিশা ফুলের মধু, জেলে-মৌয়ালদের কাছ থেকে সরাসরি। কোনো চিনি বা ভেজাল নেই।', '৫০০ গ্রাম', 'piece',
   620, 700, 30, '/images/cat/honey.jpg',
   'মোংলা, বাগেরহাট', 'খাঁটি', true, true, 'approved',
   4.2, 32, 43),
  ('litchu-modhu', (select id from public.categories where slug = 'modhu-organic'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'jashore-vegetables'),
   'লিচু ফুলের মধু', 'Litchi Blossom Honey', 'দিনাজপুরের লিচু বাগানের মৌসুমি মধু, হালকা মিষ্টি সুগন্ধ।', '৫০০ গ্রাম', 'piece',
   550, 600, 22, '/images/cat/honey.jpg',
   'দিনাজপুর সদর', null, false, true, 'approved',
   4.3, 33, 44),
  ('organic-gur', (select id from public.categories where slug = 'modhu-organic'),
   (select id from public.sellers where slug = 'jashore-fresh'),
   (select id from public.farms where slug = 'gazipur-poultry'),
   'অর্গানিক খেজুর গুড়', 'Organic Date Jaggery', 'খেজুর গাছের রস থেকে প্রাকৃতিকভাবে তৈরি গুড় — পিঠা ও পায়েসের জন্য।', '৫০০ গ্রাম', 'piece',
   240, 270, 18, '/images/cat/honey.jpg',
   'ঝিনাইদহ সদর', 'শীতে সীমিত', false, true, 'approved',
   4.4, 34, 45),
  ('jobic-sar', (select id from public.categories where slug = 'krishi-upokoron'),
   (select id from public.sellers where slug = 'savar-organic'),
   (select id from public.farms where slug = 'savar-greens'),
   'জৈব কম্পোস্ট সার', 'Organic Compost', 'গোবর ও কেঁচোর সার মিশিয়ে তৈরি জৈব কম্পোস্ট - বাগান ও ছাদবাগানের জন্য সেরা।', '৫ কেজি', 'piece',
   180, 200, 40, '/images/cat/agri.jpg',
   'সাভার, ঢাকা', null, false, true, 'approved',
   4.5, 35, 46),
  ('touta-beej', (select id from public.categories where slug = 'krishi-upokoron'),
   (select id from public.sellers where slug = 'tangail-dairy-farm'),
   (select id from public.farms where slug = 'tangail-dairy'),
   'টমেটো বীজ প্যাকেট', 'Tomato Seed Packet', 'উচ্চ ফলের জন্য হাইব্রিড টমেটো বীজ — ছাদবাগানে চাষের উপযোগী।', 'প্যাকেট', 'piece',
   60, 75, 100, '/images/cat/agri.jpg',
   'বগুড়া সদর', 'ছাদবাগান', false, true, 'approved',
   4.6, 36, 47)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------- 4 combos --
insert into public.combos (slug, name_bn, name_en, description_bn, kind, price, original_price, contents, image, sort_order) values
  ('daily-combo-small', 'ডেইলি সবজি কম্বো (ছোট পরিবার)', 'Daily Veggie Combo — Small', '২–৩ জনের এক বেলার রান্নার জন্য প্রয়োজনীয় সবজির সেট, প্রতিদিন সকালে প্যাক করা।', 'daily', 249, 320, '[{"name":"পালং শাক","qty":"১ আঁটি"},{"name":"ঢেঁড়স","qty":"২৫০ গ্রাম"},{"name":"বেগুন","qty":"২৫০ গ্রাম"},{"name":"কাঁচা মরিচ","qty":"৫০ গ্রাম"},{"name":"আলু","qty":"৫০০ গ্রাম"}]'::jsonb, '/images/cat/vegetables.jpg', 1),
  ('daily-combo-family', 'ডেইলি সবজি কম্বো (বড় পরিবার)', 'Daily Veggie Combo — Family', '৪–৬ জনের দুবেলার রান্নার সবজি — মিশ্র সবজি, শাক এবং মসলা সবজি।', 'daily', 449, 560, '[{"name":"পালং শাক","qty":"১ আঁটি"},{"name":"লাল শাক","qty":"১ আঁটি"},{"name":"বেগুন","qty":"৫০০ গ্রাম"},{"name":"পটল","qty":"৪০০ গ্রাম"},{"name":"মিষ্টি কুমড়া","qty":"৫০০ গ্রাম"},{"name":"টমেটো","qty":"৩০০ গ্রাম"},{"name":"কাঁচা মরিচ","qty":"১০০ গ্রাম"},{"name":"আলু","qty":"১ কেজি"}]'::jsonb, '/images/cat/vegetables.jpg', 2),
  ('weekly-combo-veg', 'উইকলি সবজি বক্স', 'Weekly Veggie Box', 'সপ্তাহের ৭ দিনের সবজি একবারে — সোমবার সকালে ডেলিভারি।', 'weekly', 1290, 1560, '[{"name":"মিশ্র সবজি","qty":"১.৫ কেজি"},{"name":"শাক (৩ ধরনের)","qty":"৩ আঁটি"},{"name":"আলু","qty":"২ কেজি"},{"name":"দেশি পেঁয়াজ","qty":"১ কেজি"},{"name":"কাঁচা মরিচ","qty":"২০০ গ্রাম"},{"name":"টমেটো","qty":"৫০০ গ্রাম"}]'::jsonb, '/images/cat/vegetables.jpg', 3),
  ('weekly-family-combo', 'উইকলি ফ্যামিলি কম্বো', 'Weekly Family Combo', 'সবজি + ডিম + মাছের সাপ্তাহিক প্যাক — সপ্তাহের বাজার এক কলেই।', 'weekly', 2100, 2450, '[{"name":"উইকলি সবজি বক্স","qty":"১টি"},{"name":"দেশি ডিম","qty":"১ ডজন"},{"name":"রুই মাছ","qty":"১ কেজি"},{"name":"সরিষার তেল","qty":"১ লিটার"}]'::jsonb, '/images/cat/fish.jpg', 4)
on conflict (slug) do nothing;

-- --------------------------------------------------- 3 subscription plans ---
insert into public.subscription_plans (
  slug, name_bn, name_en, members_label, members_min, members_max, price_monthly,
  saving_label, features, image, is_popular, sort_order
) values
  ('family-2-3', 'স্টার্টার ফ্যামিলি', 'Starter Family', '২–৩ জনের পরিবার', 2, 3, 3200, 'মাসে ৮০০৳ সাশ্রয়', '{"সপ্তাহে ২ দিন তাজা সবজি ডেলিভারি","মাসে ২ ডজন দেশি ডিম","১ লিটার খাঁটি দুধ (সাপ্তাহিক)","যেকোনো সময় পজ/রিসুম","ফ্রি হোম ডেলিভারি"}'::text[], '/images/cat/vegetables.jpg', false, 1),
  ('family-4-5', 'ফ্যামিলি প্লাস', 'Family Plus', '৪–৫ জনের পরিবার', 4, 5, 4800, 'সবচেয়ে জনপ্রিয়', '{"সপ্তাহে ৩ দিন তাজা সবজি ডেলিভারি","মাসে ৩ ডজন দেশি ডিম","মাসে ২ কেজি মাছ","১ লিটার দেশি ঘি (মাসিক)","যেকোনো সময় পজ/রিসুম + ফ্রি হোম ডেলিভারি"}'::text[], '/images/cat/fruits.jpg', true, 2),
  ('family-6-plus', 'জয়েন্ট ফ্যামিলি', 'Joint Family', '৬+ জনের পরিবার', 6, 20, 6900, 'সর্বোচ্চ সাশ্রয়', '{"সপ্তাহে ৩ দিন বড় সবজি বক্স","মাসে ৪ ডজন দেশি ডিম","মাসে ৩ কেজি মাছ বা মুরগি","২ লিটার খাঁটি দুধ (সাপ্তাহিক)","ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার"}'::text[], '/images/cat/honey.jpg', false, 3)
on conflict (slug) do nothing;

-- ------------------------------------------- 11 delivery charges (Dhaka +) --
insert into public.delivery_charges (district, district_en, division, scope, charge, free_over, eta_days, sort_order) values
  ('ঢাকা', 'Dhaka', 'ঢাকা', 'inside_dhaka', 60, 1200, 'আজকের মধ্যে', 1),
  ('গাজীপুর', 'Gazipur', 'ঢাকা', 'inside_dhaka', 80, 1500, '১ দিন', 2),
  ('নারায়ণগঞ্জ', 'Narayanganj', 'ঢাকা', 'inside_dhaka', 80, 1500, '১ দিন', 3),
  ('সাভার', 'Savar', 'ঢাকা', 'inside_dhaka', 80, 1500, '১ দিন', 4),
  ('চট্টগ্রাম', 'Chattogram', 'চট্টগ্রাম', 'outside_dhaka', 150, 2500, '২ দিন', 5),
  ('সিলেট', 'Sylhet', 'সিলেট', 'outside_dhaka', 160, 2500, '২–৩ দিন', 6),
  ('খুলনা', 'Khulna', 'খুলনা', 'outside_dhaka', 150, 2500, '২–৩ দিন', 7),
  ('রাজশাহী', 'Rajshahi', 'রাজশাহী', 'outside_dhaka', 150, 2500, '২–৩ দিন', 8),
  ('বরিশাল', 'Barishal', 'বরিশাল', 'outside_dhaka', 160, 2500, '৩ দিন', 9),
  ('রংপুর', 'Rangpur', 'রংপুর', 'outside_dhaka', 170, 3000, '৩ দিন', 10),
  ('ময়মনসিংহ', 'Mymensingh', 'ময়মনসিংহ', 'outside_dhaka', 140, 2500, '২ দিন', 11)
on conflict (district) do nothing;

-- --------------------------------------------------------- 3 sample coupons -
insert into public.coupons (code, type, value, min_order, max_discount, usage_limit, expires_at, is_active)
select v.code, v.type::public.coupon_type, v.value, v.min_order, v.max_discount, v.usage_limit, v.expires_at::timestamptz, true
from (values
  ('BISWAS10', 'percent', 10, 500, 200, 500, null, true),
  ('FRESH100', 'fixed', 100, 900, null, 300, null, true),
  ('NEW200', 'fixed', 200, 1500, null, 100, null, true)
) as v(code, type, value, min_order, max_discount, usage_limit, expires_at)
where not exists (select 1 from public.coupons c where upper(c.code) = upper(v.code));

-- ----------------------------------- 4 payment methods (PLACEHOLDER numbers) -
insert into public.payment_methods (
  code, name_bn, name_en, kind, account_type, account_number, account_name,
  instruction_bn, min_amount, max_amount, trx_pattern, requires_trx, requires_sender,
  is_active, sort_order
) values
  ('bkash', 'বিকাশ', 'bKash', 'mfs', 'personal', '01XXXXXXXXX', 'বিশ্বাস এগ্রো',
   'বিকাশ অ্যাপ → Send Money → উপরের নম্বরে টাকা পাঠান → TrxID লিখুন।', 1, 50000,
   '^[A-Z0-9]{8,12}$', true, true, true, 1),
  ('nagad', 'নগদ', 'Nagad', 'mfs', 'personal', '01XXXXXXXXX', 'বিশ্বাস এগ্রো',
   'নগদ অ্যাপ → Send Money → উপরের নম্বরে টাকা পাঠান → TrxID লিখুন।', 1, 50000,
   '^[A-Z0-9]{8,12}$', true, true, true, 2),
  ('rocket', 'রকেট', 'Rocket', 'mfs', 'personal', '01XXXXXXXXX-1', 'বিশ্বাস এগ্রো',
   'রকেট (DBBL) → Send Money → উপরের নম্বরে টাকা পাঠান → TrxID লিখুন।', 1, 50000,
   '^[A-Z0-9]{8,14}$', true, true, true, 3),
  ('cod', 'ক্যাশ অন ডেলিভারি', 'Cash on Delivery', 'cod', null, null, null,
   'পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিন।', 0, 20000, null, false, false, true, 4)
on conflict (code) do nothing;

-- -------------------------------------------------------- 3 premium plans ---
insert into public.plans (slug, name_bn, name_en, tier, interval, price, compare_price, duration_days, max_devices, features, is_active, is_popular, sort_order) values
  ('premium-monthly', 'প্রিমিয়াম মাসিক', 'Premium Monthly', 'full', 'monthly', 199, 299, 30, 2,
   array['সব খামারের লাইভ ক্যামেরা','HD স্ট্রিম','২টি ডিভাইস','কোনো বিজ্ঞাপন নেই'], true, false, 1),
  ('premium-half-year', 'প্রিমিয়াম ৬ মাস', 'Premium 6 Months', 'full', 'half_yearly', 999, 1794, 180, 3,
   array['সব খামারের লাইভ ক্যামেরা','HD স্ট্রিম','৩টি ডিভাইস','প্রিমিয়াম সাপোর্ট'], true, true, 2),
  ('premium-yearly', 'প্রিমিয়াম বাৎসরিক', 'Premium Yearly', 'full', 'yearly', 1799, 3588, 365, 4,
   array['সব খামারের লাইভ ক্যামেরা','HD স্ট্রিম','৪টি ডিভাইস','প্রিমিয়াম সাপোর্ট','বছরে ২টি ফ্রি কম্বো'], true, false, 3)
on conflict (slug) do nothing;

-- ------------------------------------------------------- 12 homepage rows ---
insert into public.homepage_sections (key, label_bn, is_visible, sort_order, config) values
  ('hero_slider', 'হিরো স্লাইডার', true, 10, '{"autoplay_ms":6000,"show_arrows":true,"show_dots":true}'::jsonb),
  ('trust_strip', 'বিশ্বাসের স্ট্রিপ', true, 20, '{}'::jsonb),
  ('featured_products', 'ফিচার্ড পণ্য', true, 30, '{"limit":8,"mode":"featured","heading_bn":"আজকের বাছাই"}'::jsonb),
  ('text_block', 'টেক্সট ব্লক', true, 40, '{"heading_bn":"আমরা কেন আলাদা","body_bn":""}'::jsonb),
  ('categories', 'ক্যাটাগরি', true, 50, '{}'::jsonb),
  ('combos', 'কম্বো বক্স', true, 60, '{}'::jsonb),
  ('live_farms', 'লাইভ খামার', true, 70, '{}'::jsonb),
  ('premium_plans', 'প্রিমিয়াম প্ল্যান', true, 80, '{}'::jsonb),
  ('why_choose_us', 'কেন আমরা', true, 90, '{}'::jsonb),
  ('reviews', 'রিভিউ', true, 100, '{"limit":6}'::jsonb),
  ('blog', 'ব্লগ', true, 110, '{"limit":3}'::jsonb),
  ('faq', 'প্রশ্ন-উত্তর', true, 120, '{"limit":5}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------ 3 hero slides (no image) --
insert into public.hero_slides (
  title_bn, subtitle_bn, cta_label_bn, cta_href, secondary_label_bn, secondary_href,
  text_position, text_tone, overlay_opacity, sort_order, is_active
)
select v.title_bn, v.subtitle_bn, v.cta_label_bn, v.cta_href, v.secondary_label_bn, v.secondary_href,
       'left', 'light', 52, v.sort_order, true
from (values
  ('খামার থেকে সোজা আপনার রান্নাঘরে', 'আজ তোলা সবজি, আজই ডেলিভারি। কোনো গুদাম নেই, কোনো কেমিক্যাল নেই।', 'এখনই অর্ডার করুন', '/products', 'ক্যাটাগরি দেখুন', '/categories', 10),
  ('লাইভ দেখুন, তারপর কিনুন', 'প্রতিটি খামারের ক্যামেরা লাইভ — পণ্য আসে কোথা থেকে, নিজেই দেখুন।', 'লাইভ খামার', '/live', 'প্রিমিয়াম প্ল্যান', '/live/plans', 20),
  ('পরিবারের জন্য মাসিক প্যাকেজ', 'মাসে একবার পেমেন্ট, সপ্তাহে তাজা সবজি — যেকোনো সময় পজ করুন।', 'প্যাকেজ দেখুন', '/subscription', 'কম্বো বক্স', '/combos', 30)
) as v(title_bn, subtitle_bn, cta_label_bn, cta_href, secondary_label_bn, secondary_href, sort_order)
where not exists (select 1 from public.hero_slides h where h.title_bn = v.title_bn);

-- ---------------------------------------------------------- 6 FAQ items ----
insert into public.faq_items (group_bn, question_bn, answer_bn, sort_order, is_active)
select v.group_bn, v.question_bn, v.answer_bn, v.sort_order, true
from (values
  ('ডেলিভারি', 'ডেলিভারি চার্জ কত?', 'ঢাকার ভেতরে ৬০৳, ঢাকার বাইরে ১২০৳। ১২০০৳+ অর্ডারে ডেলিভারি ফ্রি।', 1),
  ('ডেলিভারি', 'কত সময়ে পৌঁছাবে?', 'ঢাকার ভেতরে একই দিনে, ঢাকার বাইরে ২-৩ দিনে।', 2),
  ('পেমেন্ট', 'কীভাবে টাকা দেব?', 'বিকাশ, নগদ, রকেট (ম্যানুয়াল ভেরিফিকেশন) অথবা ক্যাশ অন ডেলিভারি।', 3),
  ('পেমেন্ট', 'পেমেন্ট ভেরিফাই হতে কত সময় লাগে?', 'সাধারণত ১০-৩০ মিনিট, কাজের সময়ে সর্বোচ্চ ২ ঘণ্টা।', 4),
  ('পণ্য', 'পণ্য পছন্দ না হলে?', 'ডেলিভারির ২৪ ঘণ্টার মধ্যে অর্ডার থেকে অভিযোগ করুন — রিফান্ড বা রিপ্লেসমেন্ট।', 5),
  ('প্রিমিয়াম', 'লাইভ ক্যামেরা কি ফ্রি?', '১০ মিনিটের ফ্রি ট্রায়াল আছে, এরপর প্রিমিয়াম প্ল্যান নিতে হবে।', 6)
) as v(group_bn, question_bn, answer_bn, sort_order)
where not exists (select 1 from public.faq_items f where f.question_bn = v.question_bn);

-- ------------------------------------------------------------ review tags --
insert into public.review_tags (slug, label_bn, label_en, sentiment, sort_order) values
  ('fresh', 'টাটকা', 'Fresh', 'positive', 1),
  ('good-weight', 'ওজন ঠিক', 'Right weight', 'positive', 2),
  ('fast-delivery', 'দ্রুত ডেলিভারি', 'Fast delivery', 'positive', 3),
  ('good-packaging', 'ভালো প্যাকিং', 'Good packaging', 'positive', 4),
  ('value-for-money', 'দামে সাশ্রয়', 'Value for money', 'positive', 5),
  ('spoiled', 'নষ্ট ছিল', 'Spoiled', 'negative', 6),
  ('short-weight', 'ওজন কম', 'Short weight', 'negative', 7),
  ('late', 'দেরি হয়েছে', 'Late delivery', 'negative', 8)
on conflict (slug) do nothing;

-- ------------------------------------------------------ menus + menu items --
insert into public.menus (key, label_bn, is_active) values
  ('header', 'প্রধান মেনু', true),
  ('footer', 'ফুটার মেনু', true)
on conflict (key) do nothing;

insert into public.menu_items (menu_id, label_bn, href, sort_order, is_active)
select m.id, v.label_bn, v.href, v.sort_order, true
from (values
  ('header', 'পণ্য', '/products', 1),
  ('header', 'ক্যাটাগরি', '/categories', 2),
  ('header', 'কম্বো', '/combos', 3),
  ('header', 'লাইভ খামার', '/live', 4),
  ('header', 'মার্কেট', '/market', 5),
  ('header', 'ব্লগ', '/blog', 6),
  ('footer', 'আমাদের সম্পর্কে', '/about', 1),
  ('footer', 'যোগাযোগ', '/contact', 2),
  ('footer', 'প্রশ্ন-উত্তর', '/faq', 3),
  ('footer', 'প্রাইভেসি পলিসি', '/policies/privacy', 4),
  ('footer', 'রিটার্ন ও রিফান্ড', '/policies/refund', 5)
) as v(menu_key, label_bn, href, sort_order)
join public.menus m on m.key = v.menu_key
where not exists (
  select 1 from public.menu_items mi where mi.menu_id = m.id and mi.label_bn = v.label_bn
);

-- ---------------------------------------------------------- 3 static pages --
insert into public.static_pages (slug, title_bn, title_en, blocks, seo_title, seo_description, is_published, show_in_footer, sort_order) values
  ('privacy', 'প্রাইভেসি পলিসি', 'Privacy Policy', '[{"type":"heading","text":"আপনার তথ্য আমরা কীভাবে ব্যবহার করি"},{"type":"text","body":"আমরা শুধু অর্ডার ডেলিভারি ও সাপোর্টের জন্য নাম, মোবাইল নম্বর ও ঠিকানা সংগ্রহ করি। কোনো তৃতীয় পক্ষের কাছে তথ্য বিক্রি করা হয় না।"},{"type":"text","body":"পেমেন্টের স্ক্রিনশট শুধু অ্যাডমিন দেখতে পারেন এবং ভেরিফিকেশনের পর সংরক্ষিত থাকে।"}]'::jsonb, 'প্রাইভেসি পলিসি — বিশ্বাস এগ্রো', 'আপনার তথ্য কীভাবে সংগ্রহ ও ব্যবহার করা হয়।', true, true, 1),
  ('terms', 'শর্তাবলী', 'Terms of Service', '[{"type":"heading","text":"অর্ডার ও ডেলিভারি"},{"type":"text","body":"অর্ডার কনফার্ম হলে আমরা ফোনে যাচাই করতে পারি। স্টক শেষ হলে অর্ডার বাতিল বা বিকল্প দেওয়া হতে পারে।"},{"type":"text","body":"ডেলিভারি সময় আবহাওয়া ও রাস্তার অবস্থার উপর নির্ভর করে।"}]'::jsonb, 'শর্তাবলী — বিশ্বাস এগ্রো', 'অর্ডার, ডেলিভারি ও পেমেন্টের শর্ত।', true, true, 2),
  ('refund', 'রিটার্ন ও রিফান্ড', 'Return & Refund', '[{"type":"heading","text":"২৪ ঘণ্টার মধ্যে অভিযোগ"},{"type":"text","body":"পণ্য নষ্ট, ওজন কম বা ভুল পণ্য পেলে ডেলিভারির ২৪ ঘণ্টার মধ্যে অর্ডার থেকে অভিযোগ করুন। ছবি দিলে দ্রুত সমাধান হয়।"},{"type":"text","body":"যাচাইয়ের পর রিফান্ড ৩-৭ কর্মদিবসে বিকাশ/নগদে ফেরত দেওয়া হয়।"}]'::jsonb, 'রিটার্ন ও রিফান্ড — বিশ্বাস এগ্রো', 'নষ্ট বা ভুল পণ্যের রিফান্ড নীতি।', true, true, 3)
on conflict (slug) do nothing;

-- ------------------------------------------------------------- 6 blog posts -
insert into public.blog_posts (slug, title_bn, excerpt_bn, content_bn, cover, author_bn, tag_bn, read_minutes, published_at, is_active) values
  ('shiter-taja-sabji-kothay-pabem', 'শীতে কোন সবজি সবচেয়ে পুষ্টিকর?', 'শীতের বাজারে কোন সবজি কিনবেন এবং কীভাবে বুঝবেন সবজি সত্যিই তাজা? জানুন ৫টি সহজ নিয়ম।', '## শীতের সবজির সেরা সময়
শীতে আমাদের দেশে সবজির বৈচিত্র্য সবচেয়ে বেশি। ফুলকপি, বাঁধাকপি, গাজর, মুলা, শালগম — প্রতিটিই শীতে সবচেয়ে মিষ্টি ও পুষ্টিকর হয়, কারণ দিনের তাপমাত্রা কমলে সবজিতে চিনির পরিমাণ বাড়ে এবং আঁশ নরম হয়।

### তাজা সবজি চেনার ৫টি নিয়ম
- **শক্ত কাণ্ড**: শাকের কাণ্ড ভাঙলে ফাঁপা শব্দ হলে বুঝবেন ভেতরে পানি কম — ফ্রেশ নয়।
- **পাতার রঙ**: গাঢ় সবুজ পাতা মানে বেশি ক্লোরোফিল, তবে সাদা দাগ বা হলদে ছোপ থাকলে এড়িয়ে চলুন।
- **ওজন**: একই আকারের সবজির মধ্যে ভারীটি কিনুন, বেশি রস মানে বেশি ফ্রেশনেস।
- **ঘ্রাণ**: কাঁচা মরিচ বা ঢেঁড়সের তাজা ঘ্রাণ — সস্তা বাঁচাতে পরে কেমিক্যাল দিয়ে ধরা বোঝায়।
- **কাটা দাগ**: বেগুন বা কুমড়ার কাটা অংশ শুকিয়ে গেলে বুঝবেন ২৪ ঘণ্টার বেশি পুরোনো।

### কেন মৌসুমি সবজি কিনবেন
অফ-সিজনে সবজি চাষে বেশি সার ও বালাইনাশ ব্যবহার হয়। মৌসুমে সবজি কম স্প্রে করেই ভালো জন্মে, দামও কম। বিশ্বাস এগ্রোতে আমরা প্রতি সপ্তাহে মৌসুম অনুযায়ী বক্স তৈরি করি — তাই আপনার ঘরে পৌঁছায় সবচেয়ে তাজা, সবচেয়ে কম রাসায়নিকের সবজি।', '/images/cat/vegetables.jpg', 'বিশ্বাস এগ্রো টিম', 'মৌসুমি সবজি', 5, '2026-11-23T10:09:32.887Z', true),
  ('khanti-modhu-chenar-upay', 'খাঁটি মধু চেনার ৭টি ঘরোয়া পরীক্ষা', 'বাজারে ভেজাল মধু ঠেকাতে ঘরে বসেই কিছু সহজ পরীক্ষা করে দেখতে পারেন। কোনগুলো সত্যিই কাজ করে?', '## মধু কেন ভেজাল হয়
মধু সারা বছর চাহিদা থাকলেও ফুলের মৌসুম নির্দিষ্ট। তাই কেউ কেউ বেশি লাভের জন্য চিনির সিরাপ মিশিয়ে দিতে পারে। নিচের পরীক্ষাগুলো সবসময় ল্যাব-টেস্টের বিকল্প নয়, তবে প্রথম ধারণা দিতে পারে।

### ১. পানি পরীক্ষা
এক গ্লাস পানিতে এক চামচ মধু ছাড়ুন। খাঁটি মধু অনেক ধীরে নিচে জমে যায়, ভেজাল মধু সাথে সাথে মিশে যায়।

### ২. অঙ্গুলি পরীক্ষা
আঙুলে এক ফোঁটা মধু নিয়ে দেখুন — খাঁটি মধু ফোঁটা ফোঁটা পড়ে না, একটি সূক্ষ্ম ডোরার মতো টানে।

### ৩. কাগজে ছড়ান
মধু কাগজে ছড়িয়ে দেখুন — পুরোপুরি শুষে নিলে পানির পরিমাণ বেশি।

### ৪. ঠান্ডায় জমা
ফ্রিজে রাখলে খাঁটি মধু গ্লুকোজের কারণে জমে যায়; তবে সব মধু একই হারে জমে না।

### ৫. ভিনেগার + বেকিং সোডা
মধুর সাথে সামান্য ভিনেগার দিলে ফেনা (মিথ্যা/অনেক হলে) বুঝায় ভেজাল।

### ৬. রঙ ও খোলস
খাঁটি মধুর রঙ ফুলের উপর নির্ভর করে, তাই রঙ দিয়ে বিচার আন্দাজের।

### ৭. প্রতিষ্ঠানের ট্রেসেবিলিটি
সবচেয়ে নির্ভরযোগ্য — কোন মৌসুমে, কোন ফুল থেকে, কোন মৌয়াল সংগ্রহ করেছেন তার তথ্য আছে কীনা দেখুন। বিশ্বাস এগ্রোর প্রতিটি মধুর বোতলে সংগ্রহকারীর নাম ও মৌসুম লেখা থাকে।', '/images/cat/honey.jpg', 'বিশ্বাস এগ্রো টিম', 'অর্গানিক', 6, '2026-11-23T10:09:32.887Z', true),
  ('shorir-shustho-thakte-sokaler-khabar', 'সকালের নাস্তায় বাংলার ৫টি স্বাস্থ্যকর খাবার', 'জলখাবার কেন সবচেয়ে ভালো — রুটি, ডিংড়ি, দই আর দেশি ডিম দিয়ে সহজ কিছু রেসিপি।', '## দিনের শুরুটা গুরুত্বপূর্ণ
সকালের নাস্তা কোষ্ঠকাঠিন্য, শক্তির মাত্রা আর দিনভর খাওয়ার চাহিদা — তিনটিই প্রভাবিত করে। বাংলাদেশে সহজলভ্য কিছু খাবারই হতে পারে দুর্দান্ত নাস্তা।

### ১. আটার রুটি + দেশি ডিম
দেশি ডিমে ওমেগা-৩ ও প্রোটিন বেশি। দিনে একটি তো বাদ দেবেন না।

### ২. চিড়া (ধানের গুঁড়া)
ভিটামিন B সমৃদ্ধ, আঁশ আছে, আয়রনও। পানিতে ভিজিয়ে দই বা কলা দিয়ে খান।

### ৩. টক দই
প্রোবায়োটিক — পেটের ব্যাকটেরিয়া স্বাস্থ্য ভালো রাখে। চিনি না দিয়ে মিষ্টি দই খান।

### ৪. দেশি কলা
প্রাকৃতিক শর্করা ও পটাশিয়াম। ক্লান্ত পেশিতে ভালো।

### ৫. ঘি ও বাদাম
এক চামচ দেশি ঘি রুটিতে মাখিয়ে খান — ভালো চর্বি শক্তি দেয় এবং ভিটামিন D শোষণে সাহায্য করে।', '/images/cat/eggs.jpg', 'বিশ্বাস এগ্রো টিম', 'স্বাস্থ্য টিপস', 4, '2026-11-23T10:09:32.887Z', true),
  ('jibon-theke-golpo-ek-krishoker', 'খামার থেকে টেবিল: রহিম ভাইয়ের একদিন', 'ভোর ৫টা থেকে আপনার দরজায় সবজি পৌঁছানো পর্যন্ত — খামার থেকে টেবিলের পুরো যাত্রাটা চোখে দেখুন।', '## ভোর ৫:০০ — মাঠে
সাভার, ঢাকা। শিশিরভেজা সবজির মাঠে বাঁশের ঝুড়ি হাতে হাঁটছেন মোঃ রহিম উদ্দিন। কচি পালং শাক পাতা বেছে তুলছেন — যেগুলো একটুও ফ্যাকাশে নয়।

## সকাল ৭:৩০ — সংগ্রহ কেন্দ্র
সবজি জমা হয় বিশ্বাস এগ্রোর সংগ্রহ কেন্দ্রে। ওজন মাপা হয়, প্রতিটি কৃষকের নামে ট্যাগ লাগানো হয়। এই ট্যাগটাই পরে আপনার বক্সে স্টিকার হয়ে যায়।

## সকাল ৯:০০ — র‍্যাবিট রেসিডিউ টেস্ট
প্রতিটি ব্যাচ থেকে নমুনা নেওয়া হয়। নতুন ব্যাচ হলে বারবি টেস্ট — ফেল করলে পুরো ব্যাচ ফেরত।

## বেলা ১১:০০ — প্যাকিং
বাঁশের ঝুড়ি ও কাগজের বক্সে প্যাকিং হয়, ঠান্ডা ঘরে রাখা হয়। এক ঘণ্টার মধ্যে কুরিয়ারে।

## সন্ধ্যা ৭:০০ — আপনার দরজায়
আপনার বক্সে লেবেল — খামারের নাম, তোলার তারিখ, প্যাকিং তারিখ।', '/images/cat/fruits.jpg', 'বিশ্বাস এগ্রো টিম', 'খামার', 7, '2026-11-23T10:09:32.887Z', true),
  ('jal-er-gune-bhater-taste', 'দেশি চালে ফিরুন: মিনিকেট বনাম চিনিগুঁড়া', 'কোন চাল দৈনিক ভাতে আর কোনটি পোলাওতে ভালো? কেমন চাল কেনা উচিত — পুরো গাইড।', '## চালের ধরন
বাংলাদেশের বাজারে সবচেয়ে প্রচলিত চালগুলো — মিনিকেট, নাজিরশাইল, চিনিগুঁড়া, কাটারিভোগ, ব্রাউন রাইস। প্রতিটির ব্যবহার আলাদা।

### মিনিকেট
দৈনিক ভাতের জন্য সেরা। পলিশ বেশি হওয়ায় পুষ্টি কিছুটা কম, তবে রান্নায় ঝরঝরে।

### চিনিগুঁড়া
পোলাও, বিরিয়ানি। আঠালো ও সুগন্ধি।

### নাজিরশাইল
মাঝারি সাইজ, কম রান্না লাগে।

### ব্রাউন / রেড রাইস
আঁশ ও ভিটামিন বেশি। রক্তে গ্লুকোজ ধীরে বাড়ায় — ডায়াবেটিস রোগীদের জন্য ভালো।

### কীভাবে চাল কিনবেন
- দানা দেখুন: ভাঙা দানা কম হলে ভালো।
- গন্ধ: পুরোনো বা ভেজা চালে টক গন্ধ হয়।
- পানি: এক মুঠো চাল পানিতে ভিজিয়ে দেখুন পানি মেঘলা হলে পলিশ বেশি।

বিশ্বাস এগ্রোতে চাল আসে দিনাজপুর ও নওগাঁর কৃষকের কাছ থেকে সরাসরি, পলিশ কমিয়ে।', '/images/cat/staples.jpg', 'বিশ্বাস এগ্রো টিম', 'স্বাস্থ্য টিপস', 5, '2026-11-23T10:09:32.887Z', true),
  ('macher-pusti-gun', 'মাছের পুষ্টিগুণ: কোন মাছ কেন খাবেন?', 'ইলিশ, রুই, কৈ, তেলাপিয়া — কোন মাছে কী পাবেন এবং কাদের বেশি খাওয়া দরকার।', '## বাংলার মাছ = বাংলার পুষ্টি
মাছে আছে ওমেগা-৩ ফ্যাটি অ্যাসিড, প্রোটিন, ভিটামিন D, ক্যালসিয়াম ও আয়োডিন।

### ইলিশ
ওমেগা-৩ সবচেয়ে বেশি। হৃদরোগ প্রতিরোধে ভালো। সিজন মৌসুমে।

### রুই / কাতলা
প্রোটিন ও ভিটামিন A। সস্তা ও সহজলভ্য।

### কৈ
সহজে হজম, দুর্বল রোগী ও শিশুর জন্য।

### তেলাপিয়া
কম দামে বেশি প্রোটিন, তবে ওমেগা-৩ কম।

### চিংড়ি
উচ্চ প্রোটিন, কম চর্বি। অ্যালার্জি থাকলে এড়িয়ে চলুন।

**কেনা ও খাওয়ার টিপস**
- মাছের চোখ পরিষ্কার ও বেরিয়ে থাকা মানে ফ্রেশ
- ফুলকা লাল হলে ফ্রেশ, বাদামি হলে নয়
- মাছ ধরার পর বরফে রাখলে ২৪-৪৮ ঘণ্টা ভালো থাকে

বিশ্বাস এগ্রো থেকে অর্ডার করলে মাছ পরিষ্কার করে আইস প্যাকে পৌঁছানো হয়।', '/images/cat/fish.jpg', 'বিশ্বাস এগ্রো টিম', 'স্বাস্থ্য টিপস', 4, '2026-11-23T10:09:32.887Z', true)
on conflict (slug) do nothing;

-- ------------------------------------------------------------- 1 banner ----
insert into public.banners (title_bn, subtitle_bn, link, placement, is_active, sort_order)
select '১২০০৳+ অর্ডারে ফ্রি ডেলিভারি', 'ঢাকার ভেতরে আজই ডেলিভারি', '/products', 'home_strip', true, 1
where not exists (select 1 from public.banners b where b.title_bn = '১২০০৳+ অর্ডারে ফ্রি ডেলিভারি');

commit;
