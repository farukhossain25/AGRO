-- বিশ্বাস এগ্রো / Biswas Agro — seed data
-- Generated from data/seed.mjs. Idempotent.
begin;

-- 1. categories
insert into categories (slug, name_bn, name_en, description_bn, icon, sort_order, is_active) values
  ('shakshobji', 'তাজা শাকসবজি', 'Fresh Vegetables', 'প্রতিদিন ভোরে খামার থেকে তোলা কচি শাক, সবজি ও কাঁচা মরিচ।', '🥬', 1, true),
  ('folmul', 'ফলমূল', 'Fruits', 'মৌসুমি দেশি ফলের সেরা সংগ্রহ — আম, লিচু, কলা, পেয়ারা।', '🥭', 2, true),
  ('deshi-dim', 'দেশি ডিম', 'Eggs', 'মুক্ত চারণে বেড়ে ওঠা মুরগির দেশি ডিম ও হাঁসের ডিম।', '🥚', 3, true),
  ('mangsho', 'মাংস ও পোল্ট্রি', 'Meat & Poultry', 'গরু, ছাগল ও মুরগির টাটকা মাংস — হালাল ও ফ্রেশ কাট।', '🥩', 4, true),
  ('mach', 'মাছ', 'Fish', 'পদ্মার টাটকা মাছ, চিংড়ি ও সামুদ্রিক মাছ — বরফে সংরক্ষিত।', '🐟', 5, true),
  ('dudh-dudhgiyo', 'দুধ ও দুগ্ধজাত পণ্য', 'Milk & Dairy', 'খাঁটি গরুর দুধ, ঘি, মাখন, ছানা ও দই।', '🥛', 6, true),
  ('chal-dal-mosla', 'চাল, ডাল, তেল ও মসলা', 'Rice, Lentils, Oil & Spices', 'মিনিকেট চাল, দেশি ডাল, সরিষার তেল ও খাঁটি মসলা।', '🌾', 7, true),
  ('modhu-organic', 'মধু ও অর্গানিক পণ্য', 'Honey & Organic', 'সুন্দরবনের খাঁটি মধু, অর্গানিক ঘি ও প্রাকৃতিক উপাদান।', '🍯', 8, true),
  ('krishi-upokoron', 'কৃষি উপকরণ', 'Agri Inputs', 'বীজ, জৈব সার ও বাগান পরিচর্যার সরঞ্জাম।', '🌱', 9, true)
on conflict (slug) do update set
  name_bn = excluded.name_bn,
  name_en = excluded.name_en,
  description_bn = excluded.description_bn,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;

-- 2. products
insert into products (slug, category_id, name_bn, name_en, description_bn, unit, unit_en, price, compare_price, stock, image, images, farm_source_bn, harvest_date, badge_bn, rating, review_count, is_featured, is_active) values
  ('palong-shak', (select id from categories where slug = 'shakshobji'), 'পালং শাক', 'Spinach Bundle', 'ভোর ৫টায় সাভারের মাঠ থেকে তোলা কচি পালং শাক। আঁশ ও লোহার ভালো উৎস, রক্তশূন্যতায় উপকারী।', 'আঁটি', 'pack', 25, 30, 120, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'সাভার, ঢাকা', '2026-11-21', 'সকালে তোলা', 4.5, 12, true, true),
  ('lal-shak', (select id from categories where slug = 'shakshobji'), 'লাল শাক', 'Red Amaranth', 'লাল শাক ভিটামিন এ, সি ও লৌহে সমৃদ্ধ। প্রতিদিনের বাড়ির রান্নার জন্য টাটকা আঁটি।', 'আঁটি', 'pack', 30, 35, 90, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'মধুপুর, টাঙ্গাইল', '2026-11-20', null, 4.7, 25, false, true),
  ('korola', (select id from categories where slug = 'shakshobji'), 'করলা', 'Bitter Gourd', 'রক্তে সুগারের মাত্রা নিয়ন্ত্রণে সহায়ক করলা। ছোট, কচি ও কাঁচের মতো সবুজ।', 'কেজি', 'kg', 80, 95, 45, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'গাজীপুর সদর', '2026-11-19', 'অর্গানিক', 4.8, 41, false, true),
  ('potol', (select id from categories where slug = 'shakshobji'), 'পটল', 'Pointed Gourd', 'হালকা সবুজ-সাদা ডোরাকাটা পটল, ভাজি ও ঝোলের জন্য আদর্শ।', 'কেজি', 'kg', 60, 70, 60, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'যশোর সদর', '2026-11-21', null, 5, 8, false, true),
  ('dherosh', (select id from categories where slug = 'shakshobji'), 'ঢেঁড়স', 'Okra', 'কচি ঢেঁড়স, ভেতরে নরম বিচি — ভুনা ও ভাজি দুইয়ের জন্যই সেরা।', 'কেজি', 'kg', 65, 75, 55, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'নরসিংদী সদর', '2026-11-20', null, 4.5, 63, false, true),
  ('begun', (select id from categories where slug = 'shakshobji'), 'বেগুন', 'Brinjal (Eggplant)', 'চিকন বেগুন ও গোল বেগুনের মিশ্রণ। ফুলকপির মতো ভেতরে নরম, ভর্তায় দুর্দান্ত।', 'কেজি', 'kg', 55, 65, 80, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'যশোর সদর', '2026-11-19', 'তাজা', 4.7, 12, true, true),
  ('tokori', (select id from categories where slug = 'shakshobji'), 'কাঁচা মরিচ', 'Green Chilli', 'ঝাঁঝালো কাঁচা মরিচ — বাজারের থেকে তাজা ও পরিষ্কার।', '১০০ গ্রাম', 'pack', 15, 20, 200, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'সাভার, ঢাকা', '2026-11-21', null, 4.8, 25, false, true),
  ('kacha-tomato', (select id from categories where slug = 'shakshobji'), 'টমেটো', 'Tomato', 'পাকা টমেটো, সালাদ ও সসের জন্য। রসালো ও মিষ্টি স্বাদ।', 'কেজি', 'kg', 70, 85, 0, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'রাজশাহী সদর', '2026-11-20', 'শেষ হচ্ছে', 5, 41, false, true),
  ('kumra', (select id from categories where slug = 'shakshobji'), 'মিষ্টি কুমড়া', 'Sweet Pumpkin', 'মিষ্টি স্বাদের দেশি কুমড়া — ভর্তা, চচ্চড়ি ও পায়েসে দুর্দান্ত।', 'কেজি', 'kg', 40, null, 35, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'মুন্সিগঞ্জ সদর', '2026-11-19', null, 4.5, 8, false, true),
  ('mula', (select id from categories where slug = 'shakshobji'), 'মূলা', 'Radish', 'শীতের কচি মূলা, ঝালি-সালাদের জন্য নরম ও রসালো।', 'কেজি', 'kg', 35, 45, 70, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'শ্রীপুর, গাজীপুর', '2026-11-21', null, 4.7, 63, false, true),
  ('fulkopi', (select id from categories where slug = 'shakshobji'), 'ফুলকপি', 'Cauliflower', 'সাদা ফুলকপি, ঘরে তুলে আনা — তরকারি ও রোস্টের জন্য সেরা।', 'পিস', 'pack', 50, 60, 40, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'যশোর সদর', '2026-11-20', null, 4.8, 12, false, true),
  ('bashor-alu', (select id from categories where slug = 'shakshobji'), 'আলু', 'Potato', 'দেশি জাতের আলু — রান্নায় মিষ্টি স্বাদ ও কম ভাঙে।', 'কেজি', 'kg', 30, 35, 300, '/images/cat/vegetables.jpg', array['/images/cat/vegetables.jpg']::text[], 'মুন্সিগঞ্জ সদর', '2026-11-19', null, 5, 25, false, true),
  ('himsagar-aam', (select id from categories where slug = 'folmul'), 'হিমসাগর আম', 'Himsagar Mango', 'চাঁপাইনবাবগঞ্জ-সাতক্ষীরার বিখ্যাত হিমসাগর আম — আঁশহীন, মিষ্টি ও সুগন্ধি। বিছানায় রেখে ২ দিন পাক করুন।', 'কেজি', 'kg', 120, 150, 60, '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg']::text[], 'সাতক্ষীরা সদর', '2026-11-21', 'মৌসুমি', 4.5, 41, true, true),
  ('litchu', (select id from categories where slug = 'folmul'), 'লিচু', 'Litchi', 'দিনাজপুরের রসালো লিচু — ছোট বিচি, পাতলা খোসা, অত্যন্ত মিষ্টি।', '১০০ পিস', 'pack', 180, 220, 25, '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg']::text[], 'দিনাজপুর সদর', '2026-11-20', 'সীমিত', 4.7, 8, true, true),
  ('deshi-kola', (select id from categories where slug = 'folmul'), 'সবরি দেশি কলা', 'Sabri Banana', 'দেশি সবরি কলা — প্রাকৃতিকভাবে সিরা, কোনো রাসায়নিক ক্যালসিয়াম কার্বাইড নয়।', 'ডজন', 'dozen', 60, 75, 90, '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg']::text[], 'যশোর সদর', '2026-11-19', null, 4.8, 63, false, true),
  ('peyara', (select id from categories where slug = 'folmul'), 'পেয়ারা', 'Guava', 'ভিটামিন সি সমৃদ্ধ রসালো পেয়ারা, খেতে মিষ্টি ও সুগন্ধি।', 'কেজি', 'kg', 90, 110, 45, '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg']::text[], 'বরিশাল সদর', '2026-11-21', null, 5, 12, false, true),
  ('papaya', (select id from categories where slug = 'folmul'), 'পেঁপে', 'Papaya', 'হলুদ-লাল শাঁসের পাকা পেঁপে — হজমে সহায়ক ও স্কিনের জন্য ভালো।', 'কেজি', 'kg', 45, 55, 50, '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg']::text[], 'গাজীপুর সদর', '2026-11-20', null, 4.5, 25, false, true),
  ('anarosh', (select id from categories where slug = 'folmul'), 'আনারস', 'Pineapple', 'মধুপুরের জাম্বুরা-মিষ্টি আনারস, সুবাসে ভরপুর।', 'পিস', 'pack', 80, 95, 30, '/images/cat/fruits.jpg', array['/images/cat/fruits.jpg']::text[], 'মধুপুর, টাঙ্গাইল', '2026-11-19', null, 4.7, 41, false, true),
  ('deshi-murgir-dim', (select id from categories where slug = 'deshi-dim'), 'দেশি মুরগির ডিম', 'Free-range Country Eggs', 'মুক্ত চারণে বেড়ে ওঠা মুরগির ডিম — গাঢ় কমলা কুসুম, ঘন শাঁস, দুর্গন্ধহীন।', 'ডজন', 'dozen', 180, 200, 100, '/images/cat/eggs.jpg', array['/images/cat/eggs.jpg']::text[], 'টাঙ্গাইল সদর', '2026-11-21', 'বেস্ট সেলার', 4.8, 8, true, true),
  ('hasher-dim', (select id from categories where slug = 'deshi-dim'), 'হাঁসের ডিম', 'Duck Eggs', 'বড় আকারের হাঁসের ডিম — কেক, পিঠা ও নাস্তায় দুর্দান্ত।', 'ডজন', 'dozen', 210, 230, 55, '/images/cat/eggs.jpg', array['/images/cat/eggs.jpg']::text[], 'বরিশাল সদর', '2026-11-20', null, 5, 63, false, true),
  ('broiler-dim', (select id from categories where slug = 'deshi-dim'), 'ফার্মের ডিম', 'Farm Eggs', 'দৈনন্দিন রান্নার জন্য সাশ্রয়ী ফার্ম ডিম, প্রতিদিন তাজা সংগ্রহ।', 'ডজন', 'dozen', 130, 145, 200, '/images/cat/eggs.jpg', array['/images/cat/eggs.jpg']::text[], 'গাজীপুর সদর', '2026-11-19', null, 4.5, 12, false, true),
  ('koli-dim', (select id from categories where slug = 'deshi-dim'), 'কোলি মুরগির ডিম', 'Quail Eggs', 'ছোট কিন্তু পুষ্টিগুণে ভরপুর কোয়েল (কোলি) ডিম।', '৩০ পিস', 'pack', 120, 140, 40, '/images/cat/eggs.jpg', array['/images/cat/eggs.jpg']::text[], 'নরসিংদী সদর', '2026-11-21', 'নতুন', 4.7, 25, false, true),
  ('deshi-murgi-full', (select id from categories where slug = 'mangsho'), 'দেশি মুরগি (কাটা)', 'Country Chicken (cut)', 'দেশি জাতের মুরগি, অর্ডার পাওয়ার পর জবাই করে কাটা হয়। কোনো অ্যান্টিবায়োটিক নেই।', 'কেজি', 'kg', 520, 560, 20, '/images/cat/meat.jpg', array['/images/cat/meat.jpg']::text[], 'কিশোরগঞ্জ সদর', '2026-11-20', 'হালাল', 4.8, 41, true, true),
  ('broiler-murgi', (select id from categories where slug = 'mangsho'), 'ব্রয়লার মুরগি (কাটা)', 'Broiler Chicken (cut)', 'টাটকা ব্রয়লার মাংস, পরিষ্কার কাটা ও আইস প্যাকে ডেলিভারি।', 'কেজি', 'kg', 190, 210, 35, '/images/cat/meat.jpg', array['/images/cat/meat.jpg']::text[], 'গাজীপুর সদর', '2026-11-19', null, 5, 8, false, true),
  ('gorur-mangsho', (select id from categories where slug = 'mangsho'), 'গরুর মাংস (বোনলেস)', 'Beef Boneless', 'দেশি গরুর বোনলেস মাংস, মাংসের রঙ লাল ও চর্বি কম। ২ কেজি অর্ডারে ফ্রি হাড়।', 'কেজি', 'kg', 820, 880, 15, '/images/cat/meat.jpg', array['/images/cat/meat.jpg']::text[], 'সিরাজগঞ্জ সদর', '2026-11-21', 'প্রিমিয়াম', 4.5, 63, true, true),
  ('chagol-mangsho', (select id from categories where slug = 'mangsho'), 'খাসির মাংস', 'Mutton (Goat)', 'ছোট খাসির মাংস — নরম, কম গন্ধ, কোরবানির মতো স্বাদ সারা বছর।', 'কেজি', 'kg', 1150, 1250, 10, '/images/cat/meat.jpg', array['/images/cat/meat.jpg']::text[], 'রাজবাড়ী সদর', '2026-11-20', 'হালাল', 4.7, 12, false, true),
  ('murgir-buk', (select id from categories where slug = 'mangsho'), 'মুরগির বুকের মাংস', 'Chicken Breast', 'চর্বিহীন বুকের মাংস — জিম ও প্রোটিন ডায়েটের জন্য আদর্শ।', '৫০০ গ্রাম', 'pack', 240, 270, 25, '/images/cat/meat.jpg', array['/images/cat/meat.jpg']::text[], 'গাজীপুর সদর', '2026-11-19', null, 4.8, 25, false, true),
  ('rui-mach', (select id from categories where slug = 'mach'), 'রুই মাছ', 'Rohu Fish', 'পদ্মার টাটকা রুই মাছ, পরিষ্কার করে কেটে আইস প্যাকে ডেলিভারি।', 'কেজি', 'kg', 320, 360, 25, '/images/cat/fish.jpg', array['/images/cat/fish.jpg']::text[], 'চাঁদপুর সদর', '2026-11-21', 'পদ্মার', 5, 41, true, true),
  ('ilish', (select id from categories where slug = 'mach'), 'ইলিশ মাছ', 'Hilsa Fish', 'পদ্মা-মেঘনার ইলিশ — ৮০০ গ্রাম+ সাইজ, বরফে সংরক্ষিত, সরাসরি জেলে থেকে।', 'কেজি', 'kg', 1450, 1600, 8, '/images/cat/fish.jpg', array['/images/cat/fish.jpg']::text[], 'ভোলা সদর', '2026-11-20', 'মৌসুমি', 4.5, 8, true, true),
  ('tilapia', (select id from categories where slug = 'mach'), 'তেলাপিয়া', 'Tilapia', 'ফার্মে চাষ করা তেলাপিয়া, কাঁটাযুক্ত কিন্তু মাংস নরম।', 'কেজি', 'kg', 190, 210, 30, '/images/cat/fish.jpg', array['/images/cat/fish.jpg']::text[], 'ময়মনসিংহ সদর', '2026-11-19', null, 4.7, 63, false, true),
  ('chingri', (select id from categories where slug = 'mach'), 'বাগদা চিংড়ি', 'Tiger Prawn', 'খুলনার বাগদা চিংড়ি — বড় সাইজ, মাথা পরিষ্কার, রান্নায় দ্রুত নরম হয়।', '৫০০ গ্রাম', 'pack', 680, 750, 12, '/images/cat/fish.jpg', array['/images/cat/fish.jpg']::text[], 'খুলনা সদর', '2026-11-21', 'রপ্তানি কোয়ালিটি', 4.8, 12, false, true),
  ('koi-mach', (select id from categories where slug = 'mach'), 'কৈ মাছ', 'Climbing Perch', 'ছোট কৈ মাছ — দুর্বল রোগীর পথ্য, ঝোল করে খেতে দুর্দান্ত।', 'কেজি', 'kg', 380, 420, 18, '/images/cat/fish.jpg', array['/images/cat/fish.jpg']::text[], 'জামালপুর সদর', '2026-11-20', null, 5, 25, false, true),
  ('khanti-gorur-dudh', (select id from categories where slug = 'dudh-dudhgiyo'), 'খাঁটি গরুর দুধ', 'Pure Cow Milk', 'সকালে দোহন করা খাঁটি গরুর দুধ, কোনো পাউডার বা পানি মেশানো নেই।', 'লিটার', 'litre', 130, 150, 40, '/images/cat/dairy.jpg', array['/images/cat/dairy.jpg']::text[], 'সিরাজগঞ্জ সদর', '2026-11-19', 'সকালের দুধ', 4.5, 41, true, true),
  ('deshi-ghi', (select id from categories where slug = 'dudh-dudhgiyo'), 'দেশি ঘি', 'Desi Ghee', 'ঘি তৈরি করা হয় মাখন থেকে, ধীরে জ্বাল দিয়ে — ঘরোয়া ঘ্রাণ ও দানাদার।', '৫০০ গ্রাম', 'pack', 750, 850, 15, '/images/cat/dairy.jpg', array['/images/cat/dairy.jpg']::text[], 'পাবনা সদর', '2026-11-21', 'অর্গানিক', 4.7, 8, true, true),
  ('doi', (select id from categories where slug = 'dudh-dudhgiyo'), 'মিষ্টি দই', 'Sweet Yogurt', 'বগুড়ার বিখ্যাত মিষ্টি দই, মাটির ভাঁড়ে প্যাক করা।', '৫০০ গ্রাম', 'pack', 150, 170, 25, '/images/cat/dairy.jpg', array['/images/cat/dairy.jpg']::text[], 'বগুড়া সদর', '2026-11-20', null, 4.8, 63, false, true),
  ('chana', (select id from categories where slug = 'dudh-dudhgiyo'), 'ঘন ছানা', 'Fresh Chhana', 'মিষ্টি তৈরির জন্য ঘন ছানা, ঘরে বানানো — ফরমালিন মুক্ত।', '৫০০ গ্রাম', 'pack', 260, 280, 20, '/images/cat/dairy.jpg', array['/images/cat/dairy.jpg']::text[], 'সিরাজগঞ্জ সদর', '2026-11-19', null, 5, 12, false, true),
  ('miniket-chal', (select id from categories where slug = 'chal-dal-mosla'), 'মিনিকেট চাল', 'Miniket Rice', 'দেশি মিনিকেট চাল, পলিশ কম — রান্নায় ঝরঝরে ভাত।', '৫ কেজি', 'pack', 400, 440, 80, '/images/cat/staples.jpg', array['/images/cat/staples.jpg']::text[], 'দিনাজপুর সদর', '2026-11-21', null, 4.5, 25, true, true),
  ('chinigura-chal', (select id from categories where slug = 'chal-dal-mosla'), 'চিনিগুঁড়া চাল', 'Chinigura Rice', 'পোলাও-বিরিয়ানির জন্য স্পেশাল চিনিগুঁড়া চাল, সুগন্ধি ও নরম।', '২ কেজি', 'pack', 320, 350, 45, '/images/cat/staples.jpg', array['/images/cat/staples.jpg']::text[], 'নওগাঁ সদর', '2026-11-20', 'পোলাও', 4.7, 41, false, true),
  ('masoor-dal', (select id from categories where slug = 'chal-dal-mosla'), 'মসুর ডাল', 'Red Lentil', 'দেশি মসুর ডাল, ছোট দানা ও দ্রুত সিদ্ধ হয়।', 'কেজি', 'kg', 165, 180, 60, '/images/cat/staples.jpg', array['/images/cat/staples.jpg']::text[], 'রাজশাহী সদর', '2026-11-19', null, 4.8, 8, false, true),
  ('sorisar-tel', (select id from categories where slug = 'chal-dal-mosla'), 'সরিষার তেল', 'Mustard Oil', 'কাঠের ঘানিতে ভাঙা খাঁটি সরিষার তেল — ঝাঁঝালো ঘ্রাণ ও স্বাদ।', '১ লিটার', 'pack', 280, 310, 50, '/images/cat/staples.jpg', array['/images/cat/staples.jpg']::text[], 'পাবনা সদর', '2026-11-21', 'কোল্ড প্রেস', 5, 63, true, true),
  ('holud-gura', (select id from categories where slug = 'chal-dal-mosla'), 'হলুদ গুঁড়া', 'Turmeric Powder', 'বান্দরবানের পাহাড়ি হলুদ, রোদে শুকিয়ে ভাঙা — রঙে ভরপুর।', '২৫০ গ্রাম', 'pack', 90, 100, 120, '/images/cat/staples.jpg', array['/images/cat/staples.jpg']::text[], 'বান্দরবান সদর', '2026-11-20', null, 4.5, 12, false, true),
  ('lanka-gura', (select id from categories where slug = 'chal-dal-mosla'), 'মরিচ গুঁড়া', 'Chilli Powder', 'তেজা শুকনো লঙ্কা ভাঙা, কোনো কৃত্রিম রং নেই।', '২৫০ গ্রাম', 'pack', 110, 125, 95, '/images/cat/staples.jpg', array['/images/cat/staples.jpg']::text[], 'বগুড়া সদর', '2026-11-19', 'ঝাল', 4.7, 25, false, true),
  ('sundarban-modhu', (select id from categories where slug = 'modhu-organic'), 'সুন্দরবনের মধু', 'Sundarban Honey', 'সুন্দরবনের খলিশা ফুলের মধু, জেলে-মৌয়ালদের কাছ থেকে সরাসরি। কোনো চিনি বা ভেজাল নেই।', '৫০০ গ্রাম', 'pack', 620, 700, 30, '/images/cat/honey.jpg', array['/images/cat/honey.jpg']::text[], 'মোংলা, বাগেরহাট', '2026-11-21', 'খাঁটি', 4.8, 41, true, true),
  ('litchu-modhu', (select id from categories where slug = 'modhu-organic'), 'লিচু ফুলের মধু', 'Litchi Blossom Honey', 'দিনাজপুরের লিচু বাগানের মৌসুমি মধু, হালকা মিষ্টি সুগন্ধ।', '৫০০ গ্রাম', 'pack', 550, 600, 22, '/images/cat/honey.jpg', array['/images/cat/honey.jpg']::text[], 'দিনাজপুর সদর', '2026-11-20', null, 5, 8, false, true),
  ('organic-gur', (select id from categories where slug = 'modhu-organic'), 'অর্গানিক খেজুর গুড়', 'Organic Date Jaggery', 'খেজুর গাছের রস থেকে প্রাকৃতিকভাবে তৈরি গুড় — পিঠা ও পায়েসের জন্য।', '৫০০ গ্রাম', 'pack', 240, 270, 18, '/images/cat/honey.jpg', array['/images/cat/honey.jpg']::text[], 'ঝিনাইদহ সদর', '2026-11-19', 'শীতে সীমিত', 4.5, 63, false, true),
  ('jobic-sar', (select id from categories where slug = 'krishi-upokoron'), 'জৈব কম্পোস্ট সার', 'Organic Compost', 'গোবর ও কেঁচোর সার মিশিয়ে তৈরি জৈব কম্পোস্ট - বাগান ও ছাদবাগানের জন্য সেরা।', '৫ কেজি', 'pack', 180, 200, 40, '/images/cat/agri.jpg', array['/images/cat/agri.jpg']::text[], 'সাভার, ঢাকা', '2026-11-21', null, 4.7, 12, false, true),
  ('touta-beej', (select id from categories where slug = 'krishi-upokoron'), 'টমেটো বীজ প্যাকেট', 'Tomato Seed Packet', 'উচ্চ ফলের জন্য হাইব্রিড টমেটো বীজ — ছাদবাগানে চাষের উপযোগী।', 'প্যাকেট', 'pack', 60, 75, 100, '/images/cat/agri.jpg', array['/images/cat/agri.jpg']::text[], 'বগুড়া সদর', '2026-11-20', 'ছাদবাগান', 4.8, 25, false, true)
on conflict (slug) do update set
  category_id = excluded.category_id,
  name_bn = excluded.name_bn,
  name_en = excluded.name_en,
  description_bn = excluded.description_bn,
  unit = excluded.unit,
  unit_en = excluded.unit_en,
  price = excluded.price,
  compare_price = excluded.compare_price,
  stock = excluded.stock,
  image = excluded.image,
  images = excluded.images,
  farm_source_bn = excluded.farm_source_bn,
  badge_bn = excluded.badge_bn,
  rating = excluded.rating,
  review_count = excluded.review_count,
  is_featured = excluded.is_featured,
  is_active = true;

-- 3. combos
insert into combos (slug, name_bn, name_en, description_bn, kind, price, original_price, image, sort_order, contents, is_active) values
  'daily-combo-small', 'ডেইলি সবজি কম্বো (ছোট পরিবার)', 'Daily Veggie Combo — Small', '২–৩ জনের এক বেলার রান্নার জন্য প্রয়োজনীয় সবজির সেট, প্রতিদিন সকালে প্যাক করা।', 'daily', 249, 320, '/images/cat/vegetables.jpg', 1, '[{"name":"পালং শাক","qty":"১ আঁটি"},{"name":"ঢেঁড়স","qty":"২৫০ গ্রাম"},{"name":"বেগুন","qty":"২৫০ গ্রাম"},{"name":"কাঁচা মরিচ","qty":"৫০ গ্রাম"},{"name":"আলু","qty":"৫০০ গ্রাম"}]'::jsonb, true,
  'daily-combo-family', 'ডেইলি সবজি কম্বো (বড় পরিবার)', 'Daily Veggie Combo — Family', '৪–৬ জনের দুবেলার রান্নার সবজি — মিশ্র সবজি, শাক এবং মসলা সবজি।', 'daily', 449, 560, '/images/cat/vegetables.jpg', 2, '[{"name":"পালং শাক","qty":"১ আঁটি"},{"name":"লাল শাক","qty":"১ আঁটি"},{"name":"বেগুন","qty":"৫০০ গ্রাম"},{"name":"পটল","qty":"৪০০ গ্রাম"},{"name":"মিষ্টি কুমড়া","qty":"৫০০ গ্রাম"},{"name":"টমেটো","qty":"৩০০ গ্রাম"},{"name":"কাঁচা মরিচ","qty":"১০০ গ্রাম"},{"name":"আলু","qty":"১ কেজি"}]'::jsonb, true,
  'weekly-combo-veg', 'উইকলি সবজি বক্স', 'Weekly Veggie Box', 'সপ্তাহের ৭ দিনের সবজি একবারে — সোমবার সকালে ডেলিভারি।', 'weekly', 1290, 1560, '/images/cat/vegetables.jpg', 3, '[{"name":"মিশ্র সবজি","qty":"১.৫ কেজি"},{"name":"শাক (৩ ধরনের)","qty":"৩ আঁটি"},{"name":"আলু","qty":"২ কেজি"},{"name":"দেশি পেঁয়াজ","qty":"১ কেজি"},{"name":"কাঁচা মরিচ","qty":"২০০ গ্রাম"},{"name":"টমেটো","qty":"৫০০ গ্রাম"}]'::jsonb, true,
  'weekly-family-combo', 'উইকলি ফ্যামিলি কম্বো', 'Weekly Family Combo', 'সবজি + ডিম + মাছের সাপ্তাহিক প্যাক — সপ্তাহের বাজার এক কলেই।', 'weekly', 2100, 2450, '/images/cat/fish.jpg', 4, '[{"name":"উইকলি সবজি বক্স","qty":"১টি"},{"name":"দেশি ডিম","qty":"১ ডজন"},{"name":"রুই মাছ","qty":"১ কেজি"},{"name":"সরিষার তেল","qty":"১ লিটার"}]'::jsonb, true
on conflict (slug) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, description_bn = excluded.description_bn, kind = excluded.kind, price = excluded.price, original_price = excluded.original_price, image = excluded.image, sort_order = excluded.sort_order, contents = excluded.contents, is_active = true;

-- 4. packages
insert into packages (slug, name_bn, name_en, members_label, members_min, members_max, price_monthly, saving_label, image, is_popular, sort_order, features) values
  'family-2-3', 'স্টার্টার ফ্যামিলি', 'Starter Family', '২–৩ জনের পরিবার', 2, 3, 3200, 'মাসে ৮০০৳ সাশ্রয়', '/images/cat/vegetables.jpg', false, 1, '["সপ্তাহে ২ দিন তাজা সবজি ডেলিভারি","মাসে ২ ডজন দেশি ডিম","১ লিটার খাঁটি দুধ (সাপ্তাহিক)","যেকোনো সময় পজ/রিসুম","ফ্রি হোম ডেলিভারি"]'::jsonb,
  'family-4-5', 'ফ্যামিলি প্লাস', 'Family Plus', '৪–৫ জনের পরিবার', 4, 5, 4800, 'সবচেয়ে জনপ্রিয়', '/images/cat/fruits.jpg', true, 2, '["সপ্তাহে ৩ দিন তাজা সবজি ডেলিভারি","মাসে ৩ ডজন দেশি ডিম","মাসে ২ কেজি মাছ","১ লিটার দেশি ঘি (মাসিক)","যেকোনো সময় পজ/রিসুম + ফ্রি হোম ডেলিভারি"]'::jsonb,
  'family-6-plus', 'জয়েন্ট ফ্যামিলি', 'Joint Family', '৬+ জনের পরিবার', 6, 20, 6900, 'সর্বোচ্চ সাশ্রয়', '/images/cat/honey.jpg', false, 3, '["সপ্তাহে ৩ দিন বড় সবজি বক্স","মাসে ৪ ডজন দেশি ডিম","মাসে ৩ কেজি মাছ বা মুরগি","২ লিটার খাঁটি দুধ (সাপ্তাহিক)","ডেডিকেটেড অ্যাকাউন্ট ম্যানেজার"]'::jsonb
on conflict (slug) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, members_label = excluded.members_label, members_min = excluded.members_min, members_max = excluded.members_max, price_monthly = excluded.price_monthly, saving_label = excluded.saving_label, image = excluded.image, is_popular = excluded.is_popular, sort_order = excluded.sort_order, features = excluded.features;

-- 5. delivery zones
insert into delivery_zones (district, district_en, division, scope, charge, free_over, eta_days) values
  'ঢাকা', 'Dhaka', 'ঢাকা', 'inside_dhaka', 60, 1200, 'আজকের মধ্যে',
  'গাজীপুর', 'Gazipur', 'ঢাকা', 'inside_dhaka', 80, 1500, '১ দিন',
  'নারায়ণগঞ্জ', 'Narayanganj', 'ঢাকা', 'inside_dhaka', 80, 1500, '১ দিন',
  'সাভার', 'Savar', 'ঢাকা', 'inside_dhaka', 80, 1500, '১ দিন',
  'চট্টগ্রাম', 'Chattogram', 'চট্টগ্রাম', 'outside_dhaka', 150, 2500, '২ দিন',
  'সিলেট', 'Sylhet', 'সিলেট', 'outside_dhaka', 160, 2500, '২–৩ দিন',
  'খুলনা', 'Khulna', 'খুলনা', 'outside_dhaka', 150, 2500, '২–৩ দিন',
  'রাজশাহী', 'Rajshahi', 'রাজশাহী', 'outside_dhaka', 150, 2500, '২–৩ দিন',
  'বরিশাল', 'Barishal', 'বরিশাল', 'outside_dhaka', 160, 2500, '৩ দিন',
  'রংপুর', 'Rangpur', 'রংপুর', 'outside_dhaka', 170, 3000, '৩ দিন',
  'ময়মনসিংহ', 'Mymensingh', 'ময়মনসিংহ', 'outside_dhaka', 140, 2500, '২ দিন'
on conflict (district) do update set district_en = excluded.district_en, division = excluded.division, scope = excluded.scope, charge = excluded.charge, free_over = excluded.free_over, eta_days = excluded.eta_days;

-- 6. coupons
insert into coupons (code, type, value, min_order, max_discount, usage_limit, expires_at, is_active) values
  ('BISWAS10', 'percent', 10, 500, 200, 500, now() + interval '180 days', true),
  ('FRESH100', 'fixed', 100, 900, null, 300, now() + interval '180 days', true),
  ('NEW200', 'fixed', 200, 1500, null, 100, now() + interval '180 days', true)
on conflict (code) do update set
  type = excluded.type,
  value = excluded.value,
  min_order = excluded.min_order,
  max_discount = excluded.max_discount,
  usage_limit = excluded.usage_limit,
  expires_at = excluded.expires_at,
  is_active = true;

-- 7. farmers
delete from farmers where name_bn in ('মোঃ রহিম উদ্দিন', 'ফাতেমা বেগম', 'আব্দুল করিম মিয়া', 'মৌয়াল জমাদার আলী');
insert into farmers (name_bn, location_bn, specialty_bn, story_bn, years, image, is_active, sort_order) values
  ('মোঃ রহিম উদ্দিন', 'সাভার, ঢাকা', 'পালং ও লাল শাক', 'তিন প্রজন্ম ধরে সাভারে শাক চাষ করছেন রহিম ভাই। ১২ বিঘা জমিতে গোবর সার আর জৈব বালাইনাশ ব্যবহার করেন। প্রতিদিন ভোর ৫টায় সবজি তোলা হয়, তাই আপনার হাতে পৌঁছায় কমপক্ষে ১২ ঘণ্টার মধ্যে।', 22, '/images/cat/vegetables.jpg', true, 1),
  ('ফাতেমা বেগম', 'মধুপুর, টাঙ্গাইল', 'আনারস ও সবজি', 'নারী উদ্যোক্তা ফাতেমা বেগম ৩৫ জন কৃষক পরিবারকে নিয়ে সমবায় চালান। তার আনারস আর খিরা প্রতিবছর বিশ্বাস এগ্রোর সবচেয়ে জনপ্রিয় পণ্যের তালিকায় থাকে।', 14, '/images/cat/fruits.jpg', true, 2),
  ('আব্দুল করিম মিয়া', 'সিরাজগঞ্জ সদর', 'খাঁটি গরুর দুধ', '৪০টি দেশি গাভী নিয়ে ডেইরি চালান করিম মিয়া। কোনো বুস্টার বা হরমোন ব্যবহার করেন না। প্রতিদিন সকালের দুধ দুপুরের মধ্যে কোল্ড চেইনে পৌঁছে যায়।', 18, '/images/cat/dairy.jpg', true, 3),
  ('মৌয়াল জমাদার আলী', 'মোংলা, বাগেরহাট', 'সুন্দরবনের মধু', 'মৌসুমে সুন্দরবনে গিয়ে খলিশা ফুল থেকে মধু সংগ্রহ করেন। জেলে-মৌয়ালদের কাছ থেকে সরাসরি মধু কিনে মেশিনে ফিল্টার করে বোতলভর্তি করা হয় — চিনি বা পানি মেশানোর সুযোগ নেই।', 30, '/images/cat/honey.jpg', true, 4);

-- 8. reviews
delete from reviews where user_id is null;
insert into reviews (product_id, name_bn, location_bn, rating, comment, is_approved, created_at) values
  ((select id from products where slug = 'palong-shak'), 'সাদিয়া আফরিন', 'ধানমন্ডি, ঢাকা', 5, 'শাকসবজি একেবারে বাগান থেকে তোলা মনে হয়েছে। মা বললেন অনেক দিন পর এমন টাটকা পালং পেলেন!', true, now() - interval '1 days'),
  ((select id from products where slug = 'rui-mach'), 'তানভীর হাসান', 'উত্তরা, ঢাকা', 5, 'ফ্যামিলি প্যাকেজ নিয়েছি দুই মাস। প্রতিবারই সময়মতো ডেলিভারি, সবজির কোয়ালিটি কখনো পড়েনি।', true, now() - interval '4 days'),
  ((select id from products where slug = 'himsagar-aam'), 'নুসরাত জাহান', 'চট্টগ্রাম', 4, 'ঢাকার বাইরে ডেলিভারি একটু দেরি হয়, কিন্তু মাছের ফ্রেশনেস দেখে মুগ্ধ। ইলিশ একেবারে জেলের মতো।', true, now() - interval '7 days'),
  ((select id from products where slug = 'deshi-murgi-full'), 'ডা. মাহমুদুল হাসান', 'সিলেট', 5, 'দেশি মুরগির মাংসের স্বাদ বাজারের চেয়ে অনেক আলাদা। পরিবারের জন্য নির্ভরযোগ্য জায়গা পেয়েছি।', true, now() - interval '10 days'),
  ((select id from products where slug = 'sundarban-modhu'), 'রুমানা আক্তার', 'মিরপুর, ঢাকা', 5, 'মধু খাঁটি কিনা পরীক্ষা করেছি — পানিতে দিলে তলায় যায়নি। সুন্দরবনের আসল মধু।', true, now() - interval '13 days'),
  ((select id from products where slug = 'ilish'), 'শাকিল আহমেদ', 'গাজীপুর', 4, 'অর্ডার ট্র্যাকিং খুব সুবিধাজনক, কুরিয়ার কোথায় আছে দেখতে পারি। দামও যুক্তিসঙ্গত।', true, now() - interval '16 days');

-- 9. blog posts
insert into blog_posts (slug, title_bn, excerpt_bn, content_bn, cover, author_bn, tag_bn, read_minutes, is_active) values
  ('shiter-taja-sabji-kothay-pabem', 'শীতে কোন সবজি সবচেয়ে পুষ্টিকর?', 'শীতের বাজারে কোন সবজি কিনবেন এবং কীভাবে বুঝবেন সবজি সত্যিই তাজা? জানুন ৫টি সহজ নিয়ম।', '## শীতের সবজির সেরা সময়
শীতে আমাদের দেশে সবজির বৈচিত্র্য সবচেয়ে বেশি। ফুলকপি, বাঁধাকপি, গাজর, মুলা, শালগম — প্রতিটিই শীতে সবচেয়ে মিষ্টি ও পুষ্টিকর হয়, কারণ দিনের তাপমাত্রা কমলে সবজিতে চিনির পরিমাণ বাড়ে এবং আঁশ নরম হয়।

### তাজা সবজি চেনার ৫টি নিয়ম
- **শক্ত কাণ্ড**: শাকের কাণ্ড ভাঙলে ফাঁপা শব্দ হলে বুঝবেন ভেতরে পানি কম — ফ্রেশ নয়।
- **পাতার রঙ**: গাঢ় সবুজ পাতা মানে বেশি ক্লোরোফিল, তবে সাদা দাগ বা হলদে ছোপ থাকলে এড়িয়ে চলুন।
- **ওজন**: একই আকারের সবজির মধ্যে ভারীটি কিনুন, বেশি রস মানে বেশি ফ্রেশনেস।
- **ঘ্রাণ**: কাঁচা মরিচ বা ঢেঁড়সের তাজা ঘ্রাণ — সস্তা বাঁচাতে পরে কেমিক্যাল দিয়ে ধরা বোঝায়।
- **কাটা দাগ**: বেগুন বা কুমড়ার কাটা অংশ শুকিয়ে গেলে বুঝবেন ২৪ ঘণ্টার বেশি পুরোনো।

### কেন মৌসুমি সবজি কিনবেন
অফ-সিজনে সবজি চাষে বেশি সার ও বালাইনাশ ব্যবহার হয়। মৌসুমে সবজি কম স্প্রে করেই ভালো জন্মে, দামও কম। বিশ্বাস এগ্রোতে আমরা প্রতি সপ্তাহে মৌসুম অনুযায়ী বক্স তৈরি করি — তাই আপনার ঘরে পৌঁছায় সবচেয়ে তাজা, সবচেয়ে কম রাসায়নিকের সবজি।', '/images/cat/vegetables.jpg', 'বিশ্বাস এগ্রো টিম', 'মৌসুমি সবজি', 5, true),
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
সবচেয়ে নির্ভরযোগ্য — কোন মৌসুমে, কোন ফুল থেকে, কোন মৌয়াল সংগ্রহ করেছেন তার তথ্য আছে কীনা দেখুন। বিশ্বাস এগ্রোর প্রতিটি মধুর বোতলে সংগ্রহকারীর নাম ও মৌসুম লেখা থাকে।', '/images/cat/honey.jpg', 'বিশ্বাস এগ্রো টিম', 'অর্গানিক', 6, true),
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
এক চামচ দেশি ঘি রুটিতে মাখিয়ে খান — ভালো চর্বি শক্তি দেয় এবং ভিটামিন D শোষণে সাহায্য করে।', '/images/cat/eggs.jpg', 'বিশ্বাস এগ্রো টিম', 'স্বাস্থ্য টিপস', 4, true),
  ('jibon-theke-golpo-ek-krishoker', 'খামার থেকে টেবিল: রহিম ভাইয়ের একদিন', 'ভোর ৫টা থেকে আপনার দরজায় সবজি পৌঁছানো পর্যন্ত — খামার থেকে টেবিলের পুরো যাত্রাটা চোখে দেখুন।', '## ভোর ৫:০০ — মাঠে
সাভার, ঢাকা। শিশিরভেজা সবজির মাঠে বাঁশের ঝুড়ি হাতে হাঁটছেন মোঃ রহিম উদ্দিন। কচি পালং শাক পাতা বেছে তুলছেন — যেগুলো একটুও ফ্যাকাশে নয়।

## সকাল ৭:৩০ — সংগ্রহ কেন্দ্র
সবজি জমা হয় বিশ্বাস এগ্রোর সংগ্রহ কেন্দ্রে। ওজন মাপা হয়, প্রতিটি কৃষকের নামে ট্যাগ লাগানো হয়। এই ট্যাগটাই পরে আপনার বক্সে স্টিকার হয়ে যায়।

## সকাল ৯:০০ — র‍্যাবিট রেসিডিউ টেস্ট
প্রতিটি ব্যাচ থেকে নমুনা নেওয়া হয়। নতুন ব্যাচ হলে বারবি টেস্ট — ফেল করলে পুরো ব্যাচ ফেরত।

## বেলা ১১:০০ — প্যাকিং
বাঁশের ঝুড়ি ও কাগজের বক্সে প্যাকিং হয়, ঠান্ডা ঘরে রাখা হয়। এক ঘণ্টার মধ্যে কুরিয়ারে।

## সন্ধ্যা ৭:০০ — আপনার দরজায়
আপনার বক্সে লেবেল — খামারের নাম, তোলার তারিখ, প্যাকিং তারিখ।', '/images/cat/fruits.jpg', 'বিশ্বাস এগ্রো টিম', 'খামার', 7, true),
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

বিশ্বাস এগ্রোতে চাল আসে দিনাজপুর ও নওগাঁর কৃষকের কাছ থেকে সরাসরি, পলিশ কমিয়ে।', '/images/cat/staples.jpg', 'বিশ্বাস এগ্রো টিম', 'স্বাস্থ্য টিপস', 5, true),
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

বিশ্বাস এগ্রো থেকে অর্ডার করলে মাছ পরিষ্কার করে আইস প্যাকে পৌঁছানো হয়।', '/images/cat/fish.jpg', 'বিশ্বাস এগ্রো টিম', 'স্বাস্থ্য টিপস', 4, true)
on conflict (slug) do update set
  title_bn = excluded.title_bn,
  excerpt_bn = excluded.excerpt_bn,
  content_bn = excluded.content_bn,
  cover = excluded.cover,
  tag_bn = excluded.tag_bn,
  read_minutes = excluded.read_minutes,
  is_active = true;

-- 10. banners
delete from banners;
insert into banners (title_bn, subtitle_bn, image, link, placement, is_active, sort_order) values
  ('খামার থেকে সরাসরি — এই সপ্তাহে ২০% ছাড়', 'প্রথম অর্ডারে কুপন কোড BISWAS10 ব্যবহার করে ১০% ছাড় নিন। ঢাকায় আজকের মধ্যে ডেলিভারি।', '/images/cat/vegetables.jpg', '/products', 'home_hero', true, 1);

-- 11. settings
insert into settings (key, value) values
  ('store', '{"name":"বিশ্বাস এগ্রো","phone":"+8801700000000","email":"hello@bishwasagro.com"}'::jsonb),
  ('delivery', '{"inside_dhaka":60,"outside_dhaka":120,"free_over":1200}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

commit;