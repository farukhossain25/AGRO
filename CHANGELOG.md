# CHANGELOG

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
