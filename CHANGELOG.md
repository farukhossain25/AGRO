# CHANGELOG

## 2026-11-24 — মালিকের দেওয়া লোগো "বিশ্বাস এগ্রো — BISHWAS AGRO" পুরো সাইটে

- **মূল ফাইল:** `assets/brand/bishwas-agro-logo.jpg` (মালিকের দেওয়া ছবি)। `node scripts/generate-brand.mjs`
  থেকেই বাকি সব তৈরি — হাতে কিছু আঁকা নয়: `public/brand/logo-full.webp` (পুরো লোগো: প্রতীক + বাংলা + ইংরেজি +
  ঢেউ + ট্যাগলাইন), `public/brand/logo-mark.webp` (বর্গ প্রতীক: পাতা, সূর্য, খামারবাড়ি, ক্ষেত), favicon, PWA আইকন,
  নোটিফিকেশন ব্যাজ ও iOS স্প্ল্যাশ। `scripts/generate-splash.mjs` এর কাজ এই স্ক্রিপ্টেই এসেছে।
- **হেডার (`components/icon-logo.tsx`):** সবুজ পাতার SVG-এর জায়গায় লোগোর প্রতীক (গোল কোণার টাইল), পাশে লোগোর
  রঙে দুই টোন "বিশ্বাস **এগ্রো**" (#06591b / #23961c) আর নিচে "BISHWAS AGRO" (AGRO কমলা #e98206)। আকার একটি
  `--logo-size` থেকেই: মোবাইল ৪০px → ৪০০px+ ৪৪px → ডেস্কটপ ৫২px; ৩২০px ফোনে লেখা ছোট হয়ে কেটে যায়, হেডার ফাটে না।
  লেখা HTML — যেকোনো মাপে ঝকঝকে, স্ক্রিন রিডারে "বিশ্বাস এগ্রো BISHWAS AGRO"।
- **হেডারের লগইন বোতাম (ফোন):** ৩৬০px-এ "লগইন" লেখার জায়গায় ৪০px গোল বোতামে শুধু অ্যাকাউন্ট-আইকন (aria-label
  অপরিবর্তিত) — নইলে লোগোর লেখা কেটে যেত; ৬৪০px+ (`sm`) থেকে আগের মতো লেখা সহ পিল। ৩২০px-এর নিচে হেডারে শুধু প্রতীক।
- **ফুটার:** সাদা গোল প্লেটে মালিকের **পুরো** লোগো (ট্যাগলাইনসহ) — গাঢ় সবুজ প্যানেলে সাদা প্লেট, লিঙ্কসহ।
- **রসিদ (`receipt-sheet.tsx`):** সবুজ ব্যান্ডের পাতার SVG-এর জায়গায় একই প্রতীক।
- **favicon/PWA:** `public/favicon.ico` (16/32/48, প্রতীক ভরাট), `icon-192/512` ও `apple-touch-icon` (গাঢ় সবুজ
  বর্গে সাদা গোল প্লেটে প্রতীক), `maskable-512` (নিরাপদ অঞ্চলের ভেতরে), `badge-72` (সাদা সিলুয়েট)।
  `public/favicon.svg` মুছে দেওয়া হয়েছে; `app/layout.tsx` ও ম্যানিফেস্ট নতুন ফাইল ব্যবহার করে।
- **স্প্ল্যাশ:** গাঢ় সবুজ গ্রেডিয়েন্টে সাদা প্লেটে পুরো লোগো; ম্যানিফেস্টের `background_color` স্প্ল্যাশের সাথে মেলে।
- সার্ভিস ওয়ার্কার `ba-v2` (প্রিক্যাশে favicon), `/brand/` মিডলওয়্যার ও ৭ দিনের ক্যাশ — `/icons/`-এর মতোই।

## 2026-11-24 — পণ্য পৃষ্ঠার বাটন একই রকম, সেলারের লোগো/ব্যানার "আমাদের খামার"-এ

- **পণ্য পৃষ্ঠা:** "কার্টে যোগ করুন" ও "এখনই অর্ডার" এখন একই আকার-উচ্চতার দুটি সমান বাটন (গোষ্ঠীভুক্ত মোবাইল সারিতে);
  আগে পরিমাণ স্টেপারের পাশে চাপা পড়ে একটি বৃত্ত, আরেকটি ডিম্বাকৃতি হয়ে যেত। মোবাইলে স্টেপার + পছন্দ এক সারিতে,
  দুটি বাটন নিচে পূর্ণ প্রস্থ।
- **"আমাদের খামার" `/farm`:** কার্ডের ছবি এখন সেলারের **ব্যানার** (না থাকলে খামারের cover), কোণায় সেলারের **লোগো**;
  সেলার-খামারের এক লাইনের বিবরণ আর দুবার (গল্প + "বিশেষত্ব") দেখায় না। ছবি না থাকলে নরম প্লেসহোল্ডার, ছবির কলাম কার্ডের
  পুরো উচ্চতা জুড়ে। কার্ড `components/farm/farmer-card.tsx`-এ আলাদা।
- **তথ্য:** `listFarms()`/`getFarmBySlug()`/`getFarmers()` এখন `sellers(slug, logo, banner)` জয়েন করে — ব্যানার
  থাকলে সেটিই cover, লোগো `farm.logo`। মাইগ্রেশন 22 না চালানো ডেটাবেসে (কলাম নেই) নিজে থেকে আগের সিলেক্টে ফেরে।
  `PATCH /api/sellers/profile` ব্যানার বদলালে সংযুক্ত `farms.cover`-ও আপডেট করে এবং `/farm`, `/live`, `/live/farms`,
  হোমপেজের ক্যাশ পরিষ্কার করে; `createFarmForSeller` ব্যানারকে cover বানায়।
- হোমপেজের লাইভ-খামার স্ট্রিপ ও `/live/farms` ডিরেক্টরির কার্ডেও খামারের নামের পাশে সেলারের লোগো।
- সেলার ড্যাশবোর্ডের খামার বাক্সের টেক্সট: "উপরের 'স্টোরের লোগো ও ব্যানার' থেকে দেওয়া ছবি এখানেও দেখা যাবে।"

## 2026-11-24 — `/lumen` সরানো, রিভিউ সাথে সাথে প্রকাশ, সেলারের লোগো/ব্যানার ও গ্যালারি আপলোড

### `/lumen` স্থায়ীভাবে বাদ

- `app/(lumen)/` ও `components/lumen/` মুছে দেওয়া হয়েছে (LumenStudio ডেমো কিট ক্যারোসেল)।
  `/lumen` এখন ৪০৪; অন্য কোথাও এর কোনো রেফারেন্স ছিল না।

### রিভিউ/রেটিং — অনুমোদন নেই, সাথে সাথে প্রকাশ

- `POST /api/reviews` (সাইটের মতামত ফর্ম) এখন সবসময় `status = published`; `reviews.auto_publish`
  সেটিং ও অ্যাডমিন সেটিংসের টগল বাদ। `POST /api/reviews/order` আগেই সরাসরি প্রকাশ করত।
- গ্রাহক মতামত দেওয়ার পর টোস্ট: "আপনার মতামত এখনই প্রকাশিত হয়েছে" (আগে ছিল "অ্যাপ্রুভালের পর দেখা যাবে")।
- অ্যাডমিন `/foisal/reviews` পেজ নতুন করে: একটাই তালিকা (অর্ডারের ভেরিফাইড রিভিউ + সাইটের মতামত),
  ফিল্টার সব/প্রকাশিত/লুকানো/১–২ তারা, রিভিউয়ারের নাম (প্রোফাইল বা লেখা নাম), ছবি, বাংলা ট্যাগ,
  সেলারের উত্তর। অ্যাকশন: **লুকান / পুনরুদ্ধার** এবং নতুন **মুছুন** (`DELETE /api/foisal/reviews?id=`,
  অডিট সহ, পণ্যের রেটিং আবার হিসাব হয়)। পুরোনো "অনুমোদনের অপেক্ষায়" সেকশন
  (`review-moderation.tsx`) ছিল ভাঙা — টেবিলে নেই এমন `is_approved`/`name_bn` কলাম পড়ত, তাই প্রতিটি রিভিউ
  "অপেক্ষমাণ" দেখাত — সেটি মুছে দেওয়া হয়েছে।

### সেলার ড্যাশবোর্ডে লোগো ও ব্যানার

- **মাইগ্রেশন `supabase/sql/22_seller_logo_banner.sql`** (চালাতে হবে): `sellers.logo`, `sellers.banner`
  কলাম + `public_sellers` ভিউ নতুন করে (দুটি কলাম সহ)। `03`/`10`/`ALL_IN_ONE`-এও যোগ, `npm run db:types` চালানো।
- `/seller` ড্যাশবোর্ডের ডান কলামে **"স্টোরের লোগো ও ব্যানার"** কার্ড: ফোনের গ্যালারি/ক্যামেরা বা
  কম্পিউটার থেকে সরাসরি আপলোড (ড্র্যাগ-অ্যান্ড-ড্রপ), উপরে স্টোর পৃষ্ঠায় কেমন দেখাবে তার প্রিভিউ,
  সেভ → `PATCH /api/sellers/profile` (শুধু নিজের সারি, অডিট সহ, `/market/[slug]` ক্যাশ পরিষ্কার)।
- `/market/[slug]`: সেলারের ব্যানার থাকলে সেটিই কভার (না থাকলে আগের মতো প্রথম খামারের ছবি), নামের পাশে
  লোগো; মার্কেটপ্লেস কার্ডেও ব্যানার + লোগো; ড্যাশবোর্ড হেডারে লোগো।
- `/api/upload` এখন **অনুমোদিত সেলারের** জন্য `product-images`, `logos`, `farm-images` বাকেটও নেয়
  (সার্ভিস রোল, ইউজার-প্রতি পাথ; AVIF স্নিফ যোগ)। নতুন বাকেট লাগে না।

### সেলারের পণ্য ছবি — গ্যালারি থেকে

- পণ্য ফর্মের "ছবির URL" ইনপুটের জায়গায় **ছবি গ্যালারি** (সর্বোচ্চ ৫টি): প্রথমটি কভার
  (`products.image`), সবগুলো `products.images`-এ পণ্য পৃষ্ঠার গ্যালারির জন্য; "কভার করুন" দিয়ে সাজানো যায়।
  মোবাইলে ট্যাপ করলেই গ্যালারি/ক্যামেরা খোলে, ডেস্কটপে ড্র্যাগ-অ্যান্ড-ড্রপ; ব্রাউজারে কমপ্রেস করে
  `/api/upload`-এ যায়, শুধু পাবলিক URL সেভ হয়।
- `sellerProductSchema.images` যোগ; POST/PATCH `/api/sellers/products` `images` সামলায় (এডিটে কভার
  বদলালে বাকিগুলো থাকে)।

## 2026-11-24 — পেমেন্ট প্রত্যাখ্যান, অর্ডার বাতিলে সেলার ক্যাসকেড, সেলার বিক্রয় ওভারভিউ

তিনটি সমস্যা একসাথে: ফেক TrxID প্রত্যাখ্যান করার উপায় ছিল না; অর্ডার বাতিল হলে
সেলারের হিসাব থেকে বিক্রয় বাদ যেত না; আর অ্যাডমিন জানতে পারত না কোন সেলারের
কত পাওনা বাকি।

### পেমেন্ট প্রত্যাখ্যান (fake TrxID)

- **`app/api/foisal/orders/route.ts`** PATCH-এ নতুন `action: "reject_payment"`:
  `payment_status = failed`, অর্ডার `cancelled`, `cancel_reason`-এ প্রশাসকের লেখা কারণ।
  যাচাই-ব্যর্থতার ফলে অর্ডার বাতিলের সব পার্শ্বপ্রতিক্রিয়া (নিচে) একসাথে চলে।
- **`components/admin/order-manager.tsx`** অর্ডার ড্রয়ারে "পেমেন্ট বাতিল (ভুল/ফেক TrxID)"
  বাটন — কারণসহ কনফার্ম ডায়ালগ, রিপোর্ট করা TrxID দেখিয়ে। পেমেন্ট ব্যাজে `failed`/`refunded`
  আলাদা রঙ, টেবিলে TrxID দেখা যায়, বাতিল অর্ডারে কারণসহ লাল নোট।
- অর্ডার বাতিলের পার্শ্বপ্রতিক্রিয়া (`lib/orders.ts` `applyOrderCancellation`):
  প্রতিটি সেলারের `sub_orders` → `cancelled` (বিক্রয় থেকে বাদ), চেকআউটে রিজার্ভ করা স্টক
  ফেরত, কুপনের `used_count` ফেরত, গ্রাহক ও সংশ্লিষ্ট সেলারদের নোটিফিকেশন। সব পদক্ষেপ
  idempotent — বাতিল অর্ডারে আবার চালালে কিছু ঘটে না।

### অর্ডারের স্টেটাস সেলার পর্যন্ত

- অর্ডার `received → packing → shipped → delivered` করলে সেলারদের `sub_orders.status`
  একইভাবে আপডেট হয় (আগে শুধু `delivered`-এ হতো)। `cancelled` হলে উপরের ক্যাসকেড।
- অর্ডার বাতিল এখন এক ক্লিকে নয় — কারণ লিখে কনফার্ম করতে হয়; কারণ গ্রাহক ও সেলার দেখতে পায়।

### সেলার ড্যাশবোর্ড

- বাতিল অর্ডার হিসাব (মোট আয়/গ্রস/কমিশন) থেকে বাদ, তালিকায় "বাতিল (হিসাবে নেই)" গণনা।
- অর্ডারের স্টেটাস (গৃহীত/প্যাকিং/ডেলিভারির পথে/সম্পন্ন) প্রতিটি লাইনে।
- `lib/sellers.ts` মার্কেটপ্লেস পরিসংখ্যান থেকেও বাতিল সাব-অর্ডার বাদ।

### নতুন: `/foisal/seller-sales` — সেলার বিক্রয় ও পেমেন্ট

- ন্যাভ "মার্কেটপ্লেস → বিক্রয় ও পেমেন্ট" (`payouts.read`)। প্রতি সেলার: কত অর্ডার ডেলিভারি হয়েছে
  (বিক্রয়), কত পেন্ডিং, ডেলিভারিভুক্ত আয় থেকে পরিশোধিত বাদ দিয়ে **প্রদেয়**, না-ডেলিভারি অর্ডারের
  **বন্দী অর্থ**, লাইভ/পেন্ডিং পণ্যের সংখ্যা। ক্লিক করলে সাম্প্রতিক সাব-অর্ডার ও পণ্যের তালিকা, CSV।
- সবটুকু বিদ্যমান টেবিলের উপর read-only অ্যাগ্রিগেশন — কোনো স্কিমা পরিবর্তন নেই।

### যাচাই

- `npm run typecheck` → ০ এরর · `npm run lint` → ০ এরর · `npm run db:columns` → মিল
- `npm run build` → সব রুট বিল্ড · প্রোডাকশন সার্ভারে `/foisal/seller-sales`, `/foisal/orders`,
  `/seller`, `/foisal/sellers` → ২০০

## 2026-11-23 — ডেটাবেস লেয়ার সম্পূর্ণ নতুন করে (Supabase SQL v2)

পুরোনো ১৮টি মাইগ্রেশন, সিড আর স্ক্রিপ্ট-জেনারেটর মুছে ফেলে ডেটাবেসটা একটা
নম্বরযুক্ত, হাতে-চালানো SQL সেটে রূপান্তর করা হয়েছে। **অ্যাপ আর স্কিমার মধ্যে
কোনো অপ্রকাশিত পার্থক্য নেই** — `lib/database.types.ts` এখন `supabase/sql/`
থেকে জেনারেট হয়, আর `npm run db:columns` কোডের প্রতিটি কলাম নাম স্কিমার সাথে
মিলিয়ে দেখে।

### নতুন করে যা যোগ হলো

**`supabase/sql/` — ১৪টি ফাইল (ক্রম মেনে SQL Editor-এ চালাতে হবে)**

| ফাইল | সারমর্ম |
|---|---|
| `00_RESET_ALL_DANGEROUS.sql` | সব অ্যাপ অবজেক্ট ড্রপ (auth.users-কে স্পর্শ করে না) |
| `01_extensions_and_enums.sql` | `pgcrypto`, `pg_trgm`, ৩০টি enum, `set_updated_at()` |
| `02_core_tables.sql` | ১২টি কোর টেবিল |
| `03_catalog_tables.sql` | ক্যাটালগ, খামার, ক্যামেরা, সেলার, কুপন, ডেলিভারি |
| `04_orders_payments_tables.sql` | কার্ট → অর্ডার → পেমেন্ট → পার্সেল |
| `05_premium_reviews_tables.sql` | প্রিমিয়াম, রিভিউ, অভিযোগ, নোটিফিকেশন |
| `06_homepage_cms_tables.sql` | হোমপেজ সেকশন, ব্যানার, মেনু, ব্লগ, FAQ |
| `07_functions_and_triggers.sql` | RLS হেল্পার, `place_order()`, `approve_payment()`, ট্রিগার |
| `08_rls_policies.sql` | ৬০টি টেবিলে RLS পলিসি |
| `09_storage_buckets_and_policies.sql` | ১১টি বাকেট + গার্ড + পলিসি |
| `10_indexes_and_views.sql` | ইনডেক্স + ১১টি ভিউ |
| `11_seed_sample_data.sql` | ঐচ্ছিক ডেমো ডেটা |
| `12_make_admin.sql` | একটি ইমেইলকে অ্যাডমিন বানায় |
| `13_verify_setup.sql` | রিড-অনলি PASS/FAIL চেক (১৮২টি চেক) |
| `ALL_IN_ONE.sql` | `01`–`10` একসাথে (রিসেট/সিড/অ্যাডমিন ছাড়া) |

### মুছে ফেলা ফাইল (৩০টি)

```
data/seed.mjs
lib/seed-data.ts
lib/seed-premium.ts
scripts/generate-catalogue-sql.mjs
scripts/migrate.mjs
scripts/seed.mjs
scripts/seed-sql.mjs
scripts/seed-premium-sql.mjs
supabase/admin.sql
supabase/seed.sql
supabase/seed-premium.sql
supabase/seed/catalogue.sql
supabase/migrations/0001_init.sql
supabase/migrations/0002_otp.sql
supabase/migrations/0003_premium_multivendor.sql
supabase/migrations/0004_profiles_auth_rls.sql
supabase/migrations/0005_reviews_complaints.sql
supabase/migrations/0006_seo_content.sql
supabase/migrations/0007_cms_team_security.sql
supabase/migrations/0008_security_hardening.sql
supabase/migrations/0009_manual_payments_content.sql
supabase/migrations/0010_realtime_admin.sql
supabase/migrations/0011_auth_rebuild.sql
supabase/migrations/0012_login_help.sql
supabase/migrations/0013_announcement_and_admin.sql
supabase/migrations/0014_service_role_grants.sql
supabase/migrations/0015_schema_alignment.sql
supabase/migrations/0016_checkout_storage_and_admin_gaps.sql
supabase/migrations/0017_status_vocabulary.sql
supabase/migrations/0018_rls_hardening_and_payments.sql
```

পুরোনো `npm run db:migrate` / `db:seed` স্ক্রিপ্টগুলো সরানো হয়েছে — ডেটাবেস
শুধু SQL Editor দিয়ে বদলানো হয়, প্রোগ্রাম দিয়ে নয়।

### নতুন করে তৈরি টেবিল (৬০টি)

```
access_codes            addresses               audit_log              banners
blog_posts              camera_requests         camera_view_logs       cameras
cart_items              categories              combo_items            combos
complaint_messages      complaints              contact_messages       coupons
custom_combos           delivery_charges        faq_items              farms
fcm_tokens              hero_slides             homepage_sections      login_attempts
media_assets            menu_items              menus                  newsletter_subscribers
notifications           order_items             orders                 parcels
payment_logs            payment_methods         payments               plans
premium_devices         product_images          products               profiles
push_subscriptions      recently_viewed         review_photos          review_tags
reviews                 seller_payouts          seller_warnings        sellers
seo_meta                site_settings           social_links           static_pages
stream_tokens           sub_orders              subscription_plans     subscriptions
team_members            trials                  user_subscriptions     wishlist
```

পুরোনো নাম → নতুন নাম (কোড সর্বত্র আপডেট করা হয়েছে):

| পুরোনো | নতুন |
|---|---|
| `users` | `profiles` |
| `settings` | `site_settings` |
| `delivery_zones` | `delivery_charges` |
| `cms_pages` | `static_pages` |
| `audit_logs` | `audit_log` |
| `wishlists` | `wishlist` |
| `order_reviews` | `reviews` (`status = 'published'`) |
| `premium_plans` | `plans` |
| `premium_subscriptions` | `user_subscriptions` |
| `premium_access_codes` | `access_codes` |
| `trial_grants` | `trials` |
| `stream_sessions` | `stream_tokens` |
| `packages` | `subscription_plans` |
| `team_directory` (টেবিল) | `team_members` + `v_team_members` ভিউ |
| bucket `catalog-media` | `product-images`, `blog-images` |

### নতুন ফাংশন / ট্রিগার / ভিউ / বাকেট

- **RPC**: `place_order`, `approve_payment`, `login_help`, `is_admin`, `is_staff`,
  `is_seller`, `has_role`, `is_my_seller`, `recalc_product_rating`, `log_audit`,
  `gen_order_no`, `gen_payment_no`, `sync_product_images`, `set_complaint_ticket`,
  `handle_new_user`, `guard_profile_role`
- **ট্রিগার**: `on_auth_user_created`, `trg_guard_profile_role`, `trg_reviews_recalc`,
  `trg_product_images_sync`, `trg_review_photos_sync`, `trg_complaint_ticket`,
  প্রতিটি টেবিলে `updated_at`
- **ভিউ**: `public_sellers`, `public_cameras`, `v_team_members`,
  `v_product_rating_breakdown`, `v_product_supplier`, `v_supplier_quality`,
  `v_farm_stats`, `v_payment_queue`, `v_payment_reconciliation`,
  `v_premium_revenue`, `v_seller_leaderboard`
- **বাকেট (১১)**: `avatars`, `product-images`, `category-images`, `farm-images`,
  `logos`, `slides`, `team`, `review-photos`, `complaint-photos`, `blog-images`,
  `payment-proofs` (private)

### কোডে যা বদলাল

- **রিড ফ্যাসাড** `lib/data.ts` পুরো নতুন করে লেখা: কোনো সিড ফলব্যাক নেই; ডেটাবেস
  না থাকলে বা কুয়েরি ফেল করলে `safe()` খালি তালিকা/`null` ফেরায়, পাবলিক পেজ
  কখনো এরর দেখায় না।
- **চেকআউট** `lib/orders.ts` এখন শুধু `place_order()` RPC ডাকে — দাম, স্টক, কুপণ,
  ডেলিভারি, সাব-অর্ডার, পেমেন্ট রো, পার্সেল ও নোটিফিকেশন এক ট্রানজ্যাকশনে।
  পুরোনো dual-dialect ইনসার্ট (যে `tracking_id`, `items`, `note`, `email` কলাম
  লাগাত) সম্পূর্ণ বাদ।
- **পেমেন্ট অনুমোদন** `lib/manual-payments.ts` → `approve_payment()` RPC; reject/
  needs_info আগের মতোই (কোনো টাকা নড়ে না)। `settleOrder`/`activatePremium`
  ডুপ্লিকেট কোড মুছে ফেলা হয়েছে।
- **নোটিফিকেশন** `notify()`-এ `storeInApp` অপশন — RPC যে ইন-অ্যাপ রো লিখেছে
  সেখানে আবার লেখা হয় না, শুধু push/email/SMS ফ্যান-আউট হয়।
- **অ্যাডমিন CRUD** `app/api/foisal/[resource]/route.ts` নতুন টেবিল ম্যাপে
  (`menus`, `static-pages` যোগ, `dbDynamic()` দিয়ে ডাইনামিক টেবিল)।
- **সিস্টেম চেক** `app/api/foisal/system-check/route.ts` এখন `13_verify_setup.sql`-এর
  অ্যাপ-সংস্করণ (৬০ টেবিল, ১১ ভিউ, ৩ RPC, ১১ বাকেট, write probe, অ্যাডমিন)।
- **টাইপ** `lib/database.types.ts` জেনারেটেড (৬০ টেবিল, ১১ ভিউ, ২০ ফাংশন, ২৭ enum)।
- **এরর বাউন্ডারি**: রুট `not-found`/`error` এবং `/foisal`-এর নিজস্ব
  `error`/`loading`/`not-found` যোগ — সব বাংলায়, কোনো স্ট্যাক ট্রেস নেই।
- **নতুন স্ক্রিপ্ট**: `db:types` (PGlite থেকে টাইপ), `db:check` (সব SQL দুবার চালিয়ে
  যাচাই + `13`-এর FAIL), `db:columns` (কোড ↔ স্কিমা কলাম মিল), `verify` (সব একসাথে)।

### ব্রেকিং (মাইগ্রেশন করতে হলে)

1. পুরোনো `supabase/migrations/*` চালানো **বন্ধ** করুন — ফাইলগুলো আর নেই।
2. নতুন প্রজেক্ট: `01` → `11` (চাইলে), `12`, `13`।
3. পুরোনো লাইভ ডেটা থাকলে: ব্যাকআপ নিন, তারপর `00` → `13`। `orders`-এ
   `tracking_id`/`items`/`note` কলাম আর নেই; ট্র্যাকিং `order_no` + `customer_phone`।
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` নাম দুটো এখনো
   ফলব্যাক হিসেবে কাজ করে, তবে নতুন নাম (`…_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`)
   ব্যবহার করাই ভালো।

### যাচাই (এই রিলিজে চালানো হয়েছে)

- `npm run typecheck` → ০ এরর · `npm run lint` → ০ এরর
- `npm run build` → সব ১৬২ রুট বিল্ড
- `npm run db:check` → ০১–১৩ দুবার করে চালিয়ে ০ এরর; `13_verify_setup` → ১৮২ চেক,
  ০ FAIL, ০ WARN; `00` → পাবলিক স্কিমা খালি, আবার চালানো যায়
- `npm run db:columns` → ৭১ টেবিল/ভিউ, প্রতিটি কলাম মিল
- `npm run security` → ০ ফাইন্ডিং · `npm run budget` → ০ রুট বাজেটের বাইরে
