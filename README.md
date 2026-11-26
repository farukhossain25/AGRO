# বিশ্বাস এগ্রো (Biswas Agro) — Farm to Family

খামার থেকে সরাসরি পরিবারের টেবিলে — অর্ডার, ম্যানুয়াল পেমেন্ট, মাল্টি-সেলার মার্কেটপ্লেস,
লাইভ খামার ক্যামেরা, প্রিমিয়াম সাবস্ক্রিপশন, ব্লগ আর একটি সম্পূর্ণ বাংলা অ্যাডমিন প্যানেল।

| | |
|---|---|
| **স্ট্যাক** | Next.js 15.5 (App Router) · React 19 · TypeScript · Tailwind 3 · Supabase (Postgres + Auth + Storage) |
| **ভাষা** | পুরো ইন্টারফেস বাংলা, মুদ্রা ৳, তারিখ বাংলায় |
| **অ্যাডমিন প্যানেল** | `/foisal` (`NEXT_PUBLIC_ADMIN_PATH` দিয়ে বদলানো যায়) |
| **ডেটাবেস** | `supabase/sql/` — ১৪টি নম্বরযুক্ত ফাইল, SQL Editor-এ হাতে চালাতে হয় |
| **টাইপ** | `lib/database.types.ts` — SQL থেকে জেনারেট করা (`npm run db:types`) |
| **ডিপ্লয়** | শুধু Vercel |

> **এই রিপোতে কোনো মাইগ্রেশন রানার নেই।** অ্যাপ কখনো নিজে SQL চালায় না, কখনো
> `db push` করে না। স্কিমা বদলাতে হলে SQL Editor-এ ফাইল চালাতে হবে — নিচের
> “Supabase সেটআপ” অংশটি ঠিক সেই কাজটির জন্য লেখা।

---

## ১. দ্রুত চেহারা (৩০ সেকেন্ডে)

```
supabase/sql/        ১৪টি SQL ফাইল — এটাই ডেটাবেসের একমাত্র সত্য
scripts/             টাইপ জেনারেটর, SQL ভ্যালিডেটর, কলাম-চেক, সিকিউরিটি ও বাজেট স্ক্যান
lib/                 ডেটা লেয়ার (queries, data, orders, manual-payments, premium, …)
app/(storefront)/    পাবলিক সাইট
app/foisal/          অ্যাডমিন প্যানেল (লগইন + ৩৫ পেজ)
app/api/             সার্ভার রুট (চেকআউট, পেমেন্ট, রিভিউ, CRUD, সিস্টেম চেক)
components/          UI (admin/, shop/, live/, payments/, home/, account/)
```

পাবলিক সাইট কখনো ভুলের স্ক্রিন দেখায় না: ডেটাবেস ডাউন থাকলে বা টেবিল খালি থাকলে
সেকশনটি সুন্দর “এখনো কিছু নেই” অবস্থায় রেন্ডার হয় (`lib/data.ts` → `safe()`),
এরর শুধু সার্ভার লগে যায়।

---

## ২. Supabase সেটআপ — ধাপে ধাপে (কোড না জানলেও পারবেন)

নিচের ১১টি ধাপ ঠিক ক্রমে করুন। প্রতিটি ধাপে বলা আছে **কোথায় ক্লিক করবেন**,
**কী দেখবেন** আর **সমস্যা হলে কী করবেন**।

### চেকলিস্ট (প্রিন্ট করে টিক দিন)

- [ ] **১.** Supabase-এ নতুন প্রজেক্ট
- [ ] **২.** SQL Editor-এ `00` → `11` ফাইলগুলো ক্রমে চালানো
- [ ] **৩.** Authentication → Users-এ অ্যাডমিন ইউজার, তারপর `12_make_admin.sql`
- [ ] **৪.** Auth → URL Configuration (Site URL + Redirect URLs)
- [ ] **৫.** (ঐচ্ছিক) Google লগইন
- [ ] **৬.** Storage-এ ১১টি বাকেট আছে কি না দেখা
- [ ] **৭.** Vercel-এ Environment Variables
- [ ] **৮.** `13_verify_setup.sql` + `/foisal` → System Check
- [ ] **৯.** রিসেটের আগে ব্যাকআপ
- [ ] **১০.** লঞ্চ-পূর্ব চেকলিস্ট
- [ ] **১১.** সমস্যা হলে Troubleshooting

---

### ধাপ ১ — নতুন প্রজেক্ট তৈরি

1. <https://supabase.com/dashboard> → **New project**
2. **Organization** বেছে নিন → **Name**: `biswas-agro`
3. **Database Password**: শক্ত পাসওয়ার্ড, পাসওয়ার্ড ম্যানেজারে রাখুন
4. **Region**: `Southeast Asia (Singapore)` — বাংলাদেশ থেকে সবচেয়ে কাছের
5. **Create new project** → ২ মিনিট অপেক্ষা করুন
6. **Project Settings → Data API** থেকে কপি করে রাখুন:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (শুধু সার্ভারে, কখনো `NEXT_PUBLIC_` নয়)

### ধাপ ২ — SQL ফাইল চালানো (সবচেয়ে গুরুত্বপূর্ণ ধাপ)

বাম মেনু → **SQL Editor** → **New query** → ফাইল খুলে পুরোটা পেস্ট → **Run**
(`Ctrl/⌘ + Enter`)। **একবারে একটি ফাইল**, নিচের ক্রমে।

| ফাইল | কী করে | কখন চালাবেন | সফল হলে দেখবেন | এরর হলে |
|---|---|---|---|---|
| `00_RESET_ALL_DANGEROUS.sql` | **সব** অ্যাপ টেবিল/ভিউ/ফাংশন/ট্রিগার/পলিসি/এনাম/স্টোরেজ পলিসি/বাকেট মুছে ফেলে। `auth.users`-কে **স্পর্শ করে না** | শুধু তখন, যখন পুরোনো/নোংরা ডেটাবেস পরিষ্কার করতে চান (নতুন প্রজেক্টে দরকার নেই) | `Success. No rows returned` | `permission denied` → প্রজেক্টের owner হিসেবে লগইন করুন |
| `01_extensions_and_enums.sql` | `pgcrypto`, `pg_trgm` এক্সটেনশন + ৩০টি enum + `set_updated_at()` | ০০-এর পরে (বা নতুন প্রজেক্টে সবার আগে) | `Success. No rows returned` | `extension already exists` → উপেক্ষা করুন, ইডেমপোটেন্ট |
| `02_core_tables.sql` | `profiles`, `addresses`, `site_settings`, `social_links`, `team_members`, `static_pages`, `audit_log`, `media_assets`, `seo_meta`, `contact_messages`, `newsletter_subscribers`, `login_attempts` | ০১-এর পরে | `Success. No rows returned` | `relation already exists` → ঠিক আছে, `if not exists` ব্যবহার করা হয়েছে |
| `03_catalog_tables.sql` | ক্যাটাগরি, খামার, ক্যামেরা, সেলার, পেআউট, পণ্য, কুপন, ডেলিভারি চার্জ, কম্বো, প্যাকেজ | ০২-এর পরে | `Success` | `type … does not exist` → ০১ চালাননি |
| `04_orders_payments_tables.sql` | কার্ট, অর্ডার, `order_items`, `sub_orders`, পেমেন্ট মাধ্যম/পেমেন্ট/লগ, পার্সেল, কাস্টম কম্বো | ০৩-এর পরে | `Success` | একই — আগের ফাইল বাদ পড়েছে |
| `05_premium_reviews_tables.sql` | `user_subscriptions`, `access_codes`, `trials`, `stream_tokens`, `premium_devices`, রিভিউ+ছবি+ট্যাগ, অভিযোগ, নোটিফিকেশন, পুশ/FCM, উইশলিস্ট | ০৪-এর পরে | `Success` | আগের ফাইল বাদ পড়েছে |
| `06_homepage_cms_tables.sql` | হিরো স্লাইড, হোমপেজ সেকশন, ব্যানার, মেনু, ব্লগ, FAQ | ০৫-এর পরে | `Success` | — |
| `07_functions_and_triggers.sql` | `is_admin()`/`is_seller()` ইত্যাদি, `handle_new_user()` (signup কখনো ফেল করবে না), `place_order()` (এক ট্রানজ্যাকশনে অর্ডার), `approve_payment()`, রেটিং/কমপ্লেইন/অডিট হেল্পার, সব ট্রিগার | ০৬-এর পরে | `Success` | `function … already exists` → ঠিক আছে |
| `08_rls_policies.sql` | **প্রতিটি** টেবিলে RLS: পাবলিক শুধু প্রকাশিত, নিজের ডেটা নিজের, সেলার নিজের, অ্যাডমিন `is_admin()` | ০৭-এর পরে | `Success` | `policy … already exists` → ঠিক আছে |
| `09_storage_buckets_and_policies.sql` | ১১টি বাকেট + সাইজ/টাইপ গার্ড + পলিসি (`payment-proofs` প্রাইভেট) | ০৮-এর পরে | `Success` | `bucket already exists` → ঠিক আছে |
| `10_indexes_and_views.sql` | ইনডেক্স + ১১টি ভিউ (`public_sellers`, `public_cameras`, `v_payment_queue`, …) | ০৯-এর পরে | `Success` | — |
| `11_seed_sample_data.sql` | **ঐচ্ছিক** ডেমো ডেটা: ৯ ক্যাটাগরি, ৫ খামার, ১০ ক্যামেরা, ৪৭ পণ্য, ৪ কম্বো, ৩ প্যাকেজ, ৩ কুপন, ৪ পেমেন্ট মাধ্যম, ৩ প্ল্যান, ১২ হোম সেকশন, ৬ ব্লগ, ৬ FAQ | ১০-এর পরে (খালি দোকানে দরকার নেই) | `Success` | ডেটা দুবার যোগ হবে না — ইডেমপোটেন্ট |
| `12_make_admin.sql` | `foysaliqbal09@gmail.com`-কে অ্যাডমিন বানায় (profiles.role + auth app_metadata) | ধাপ ৩-এ ইউজার বানানোর **পরে** | `Success` | `no user with that email` → আগে Authentication → Users-এ ইউজার বানান |
| `13_verify_setup.sql` | **রিড-অনলি** চেকলিস্ট: প্রতিটি টেবিল/ফাংশন/ভিউ/ট্রিগার/বাকেট/এনাম/অ্যাডমিন | সবশেষে, আর যেকোনো সময় সন্দেহ হলে | `PASS` সারি (FAIL ০ হওয়া উচিত) | `FAIL` থাকলে `detail` কলামে বলা ফাইলটি আবার চালান |

**সুবিধার জন্য:** `ALL_IN_ONE.sql` (১৪৪ KB) = `01`–`10` একসাথে, রিসেট/সিড/অ্যাডমিন ছাড়া।
SQL Editor-এ একবারে পেস্ট করা যায়; কিন্তু কোনো ফাইলে এরর হলে খুঁজে পাওয়া কঠিন —
তাই প্রথমবার আলাদা আলাদা চালানোই ভালো।

**একই ফাইল দুবার চালালে?** সমস্যা নেই — সব ফাইল ইডেমপোটেন্ট (`if not exists`,
`create or replace`, `on conflict`)। `npm run db:check` এই আচরণটাই যাচাই করে।

### ধাপ ৩ — অ্যাডমিন ইউজার তৈরি + `12_make_admin.sql`

1. **Authentication → Users → Add user → Create new user**
2. Email: `foysaliqbal09@gmail.com`, Password: শক্ত পাসওয়ার্ড
3. **Auto Confirm User** টিক দিন (নাহলে লগইনে “invalid login” আসবে)
4. **Save** → তালিকায় ইউজারটি দেখা যাবে
5. **SQL Editor** → `12_make_admin.sql` খুলে ইমেইলটা নিজের ইমেইলে বদলান (দরকার হলে) → **Run**
6. যাচাই: `select email, role from public.profiles where role = 'admin';`

`12` যা করে: `profiles.role = 'admin'`, `is_active = true`, আর
`auth.users.raw_app_meta_data.role = 'admin'` (middleware ও RLS দুটোই একমত থাকে)।

### ধাপ ৪ — Auth → URL Configuration

**Authentication → URL Configuration**

| ফিল্ড | মান |
|---|---|
| **Site URL** | `https://bishwasagro.vercel.app` (কাস্টম ডোমেইন থাকলে সেটি) |
| **Redirect URLs** | `https://bishwasagro.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |
| | `https://*-<your-team>.vercel.app/auth/callback` (প্রিভিউ ডিপ্লয়ের জন্য) |

**Authentication → Providers → Email**: *Enable email provider* চালু, *Confirm email*
বন্ধ রাখতে পারেন (নাহলে প্রতিটি কাস্টমারকে মেইল কনফার্ম করতে হবে)।
**Authentication → Sessions**: *JWT expiry* ডিফল্ট রাখুন।

### ধাপ ৫ — (ঐচ্ছিক) Google লগইন

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID**
2. Type: **Web application**; **Authorized redirect URI**:
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. Client ID + Secret কপি করুন
4. Supabase → **Authentication → Providers → Google** → চালু করুন, দুটো মান বসান → **Save**
5. Google Cloud Console-এ **Authorized JavaScript origin**: `https://bishwasagro.vercel.app`

Google লগইন বন্ধ থাকলেও ইমেইল+পাসওয়ার্ড ঠিকঠাক কাজ করে — কিছু ভাঙবে না।

### ধাপ ৬ — Storage বাকেট যাচাই

**Storage** মেনুতে ঠিক এই ১১টি বাকেট থাকবে (১০টি public, ১টি private):

`avatars` · `product-images` · `category-images` · `farm-images` · `logos` ·
`slides` · `team` · `review-photos` · `complaint-photos` · `blog-images` ·
**`payment-proofs` (private)**

`09_storage_buckets_and_policies.sql` এগুলো নিজেই বানায়। কোনোটি না থাকলে ওই ফাইলটি
আবার চালান, অথবা Storage → **New bucket** দিয়ে নাম হুবহু মিলিয়ে বানান।

### ধাপ ৭ — Vercel-এ Environment Variables

**বাধ্যতামূলক (অ্যাপ চালু হওয়ার জন্য)**

| নাম | কোথায় পাবেন |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → secret (**server only**) |
| `NEXT_PUBLIC_SITE_URL` | `https://bishwasagro.vercel.app` |

**ঐচ্ছিক (ফিচার চালু করে)**

`NEXT_PUBLIC_ADMIN_PATH` / `ADMIN_PATH` (ডিফল্ট `foisal`), `SUPABASE_TIMEOUT_MS`,
`STREAM_PROXY_TARGET`, `GO2RTC_WHEP_URL`, `STREAM_PROXY_SECRET`,
`STREAM_TOKEN_SECRET`/`JWT_SECRET`, `ORDER_QR_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`SMS_PROVIDER`/`SMS_API_KEY`/`SMS_SENDER_ID`/`SMS_API_URL`,
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, `FCM_SERVER_KEY`,
`BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*`, `PAYMENTS_SANDBOX`,
`NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_GA_ID`,
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`।

Vercel: **Settings → Environment Variables → Add** → প্রতিটি নাম/মান →
**Production + Preview + Development** তিনটেতেই টিক → **Save** → **Deployments →
Redeploy** (এনভায়রনমেন্ট শুধু নতুন ডিপ্লয়ে লোড হয়)।

### ধাপ ৮ — যাচাই: `13_verify_setup.sql` + `/foisal` System Check

1. SQL Editor → `13_verify_setup.sql` → **Run**
   - `section / item / status / detail` কলামে তালিকা আসবে
   - লক্ষ্য: **০টি FAIL** (WARN থাকতে পারে — সাধারণত সিড ডেটা বা প্লেসহোল্ডার নম্বর)
2. সাইটে লগইন করুন → `https://bishwasagro.vercel.app/foisal` → **সিস্টেম চেক**
   - অ্যাপের ভেতর থেকে একই পরীক্ষা: প্রতিটি টেবিল পড়া, ভিউ/ফাংশন, write probe,
     ১১টি বাকেট, `payment-proofs` প্রাইভেট কি না, আপলোড-ডাউনলোড-ডিলিট, অ্যাডমিন।
   - কিছু লাল হলে নিচে আসল Postgres বাক্যটি দেখা যাবে — সেটি হুবহু কপি করে খুঁজুন।

### ধাপ ৯ — রিসেটের আগে ব্যাকআপ (যদি `00` চালাতে হয়)

`00_RESET_ALL_DANGEROUS.sql` **সব ডেটা মুছে দেয়**। আগে:

1. **Database → Backups** → *Scheduled* আছে কি না দেখুন (Free প্ল্যানে নেই → ম্যানুয়াল)
2. **SQL Editor**-এ `pg_dump` শেল নেই, তাই টেবিল ধরে ধরে CSV:
   ```sql
   copy (select * from public.orders) to stdout with (format csv, header true);
   ```
   (Supabase SQL Editor `copy … to stdout` সাপোর্ট করে; ফলাফল কপি করে ফাইলে রাখুন)
3. অথবা টার্মিনাল থেকে (আপনার পিসিতে `psql` থাকলে):
   ```bash
   pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
     --no-owner --no-privileges -f backup-$(date +%F).sql
   ```
4. Storage-এর ফাইল আলাদা করে নামিয়ে রাখুন (Storage → bucket → Download)

### ধাপ ১০ — লঞ্চ-পূর্ব চেকলিস্ট

- [ ] `13_verify_setup.sql` → ০ FAIL, `/foisal` → System Check সব সবুজ
- [ ] `npm run verify` লোকালি পাস (typecheck + lint + SQL + কলাম + সিকিউরিটি + বাজেট)
- [ ] `/foisal` → পেমেন্ট মাধ্যম: আসল bKash/Nagad/ব্যাংক নম্বর বসানো (প্লেসহোল্ডার `01XXX…` বদলানো)
- [ ] `/foisal` → সেটিংস: ডেলিভারি চার্জ, ফ্রি ডেলিভারি সীমা, কমিশন, অ্যানাউন্সমেন্ট
- [ ] `/foisal` → ক্যামেরা/খামার: অন্তত ১টি খামার, ১টি অনলাইন ক্যামেরা
- [ ] `/foisal` → হোমপেজ সেকশন: যেসব সেকশন দেখাতে চান সেগুলো দৃশ্যমান, ক্রম ঠিক
- [ ] ডেমো পণ্য/কুপন মুছে আসল ক্যাটালগ বসানো (অথবা `00` চালিয়ে ০১–১০, তারপর নিজের ডেটা)
- [ ] Auth → URL Configuration-এ প্রোডাকশন ডোমেইন
- [ ] অর্ডার প্লেস করে দেখুন (ক্যাশ অন ডেলিভারি), ট্র্যাকিং কাজ করছে কি না
- [ ] ম্যানুয়াল পেমেন্ট: TrxID জমা → অ্যাডমিন approve → অর্ডার `paid`
- [ ] রিভিউ লিখে দেখুন (auto-publish বন্ধ থাকলে অ্যাডমিন approve করবে)
- [ ] Google লগইন (চালু করলে) ও পাসওয়ার্ড রিসেট মেইল
- [ ] সেলার আবেদন → অ্যাডমিন অনুমোদন → সেলার প্যানেল
- [ ] প্রিমিয়াম প্ল্যান কেনা → approve → `/live` আনলক
- [ ] মোবাইলে হোম, প্রোডাক্ট, চেকআউট খুলে দেখুন (Lighthouse ≥ 90)
- [ ] `NEXT_PUBLIC_SITE_URL` প্রোডাকশন ডোমেইনে, `robots.txt`/`sitemap.xml` খোলা যাচ্ছে

### ধাপ ১১ — Troubleshooting (হুবহু এরর → সমাধান)

| এরর / লক্ষণ | কারণ | সমাধান |
|---|---|---|
| `relation "public.xxx" already exists` | ফাইল আগে চালানো হয়েছে | উপেক্ষা করুন — সব `create table if not exists` |
| `permission denied for schema public` | প্রজেক্টের owner নন / key ভুল | Supabase-এ owner অ্যাকাউন্টে লগইন; `SUPABASE_SECRET_KEY` ঠিক আছে কি না দেখুন |
| `new row violates row-level security policy` | লগইন ছাড়া write, বা রোল ভুল | অ্যাডমিন হলে `12` চালান; কাস্টমার রুটে `auth.uid()` আছে কি না দেখুন |
| `function public.place_order(...) does not exist` | `07` চালানো হয়নি | `07_functions_and_triggers.sql` চালান, তারপর `13` দিয়ে যাচাই |
| `bucket not found` | `09` চালানো হয়নি / নাম বদলেছে | `09_storage_buckets_and_policies.sql` চালান |
| `redirect_uri_mismatch` (Google) | Google Console-এ URI নেই | `https://<ref>.supabase.co/auth/v1/callback` যোগ করুন |
| `Invalid login credentials` | পাসওয়ার্ড ভুল, বা ইউজার কনফার্ম হয়নি | Users → user → **Confirm email**; পাসওয়ার্ড রিসেট |
| `Email not confirmed` | Confirm email চালু | Auth → Providers → Email → Confirm email বন্ধ, বা মেইল কনফার্ম |
| এনভায়রনমেন্ট বদলেও পুরোনো মান | Vercel পুরোনো বিল্ড চালাচ্ছে | **Deployments → Redeploy** (নতুন বিল্ডেই env ইনলাইন হয়) |
| সাইটে সব সেকশন খালি | টেবিল খালি / DB সংযোগ নেই | `/foisal` → System Check; `13` চালান; `11` (সিড) চালান |
| `column ... does not exist` | কোড ও স্কিমা আলাদা | `npm run db:columns` চালান → যে কলামটি অভিযোগ করছে সেটি ঠিক করুন |
| টাইপ এরর (`Property does not exist`) | `lib/database.types.ts` পুরোনো | `npm run db:types` |
| পেমেন্ট approve করলে কিছুই হয় না | `approve_payment` নেই / RLS | `07` চালান; `/foisal` → পেমেন্ট কিউ দেখুন; কনসোল লগ |

---

## ৩. ডেটাবেস ডিজাইন

### টেবিল (৬০টি, গ্রুপে)

| গ্রুপ | টেবিল |
|---|---|
| **কোর** | `profiles`, `addresses`, `site_settings`, `social_links`, `team_members`, `static_pages`, `audit_log`, `media_assets`, `seo_meta`, `contact_messages`, `newsletter_subscribers`, `login_attempts` |
| **ক্যাটালগ** | `categories`, `farms`, `cameras`, `sellers`, `seller_payouts`, `seller_warnings`, `camera_requests`, `camera_view_logs`, `products`, `product_images`, `coupons`, `delivery_charges`, `combos`, `combo_items`, `subscription_plans`, `subscriptions` |
| **অর্ডার ও পেমেন্ট** | `cart_items`, `orders`, `order_items`, `sub_orders`, `payment_methods`, `payments`, `payment_logs`, `parcels`, `custom_combos` |
| **প্রিমিয়াম** | `plans`, `user_subscriptions`, `access_codes`, `trials`, `stream_tokens`, `premium_devices` |
| **ট্রাস্ট** | `reviews`, `review_photos`, `review_tags`, `complaints`, `complaint_messages`, `notifications`, `push_subscriptions`, `fcm_tokens` |
| **কনটেন্ট** | `wishlist`, `recently_viewed`, `hero_slides`, `homepage_sections`, `banners`, `menus`, `menu_items`, `blog_posts`, `faq_items` |

### ভিউ (১১টি)

`public_sellers` (প্রাইভেট কলাম ছাড়া), `public_cameras`, `v_team_members`,
`v_product_rating_breakdown`, `v_product_supplier`, `v_supplier_quality`,
`v_farm_stats`, `v_payment_queue`, `v_payment_reconciliation`,
`v_premium_revenue`, `v_seller_leaderboard`

অ্যানোনিমাস শুধু `public_sellers` আর `public_cameras` পড়তে পারে — সেলারের NID,
ব্যাংক অ্যাকাউন্ট, কমিশন কখনো পাবলিক হয় না।

### RPC (অ্যাপ যেগুলো ডাকে)

| ফাংশন | কাজ |
|---|---|
| `place_order(p_user, p_customer, p_items, p_payment_method, p_coupon)` | **এক ট্রানজ্যাকশনে** দাম হিসাব, স্টক কাটা, কুপন, ডেলিভারি, অর্ডার+আইটেম+সাব-অর্ডার+পেমেন্ট রো+পার্সেল+নোটিফিকেশন |
| `approve_payment(p_payment, p_actor, p_note)` | পেমেন্ট verified, অর্ডার paid / প্রিমিয়াম সক্রিয় + অ্যাক্সেস কোড, লগ, নোটিফিকেশন (শুধু অ্যাডমিন) |
| `login_help(p_email)` | “কেন লগইন হচ্ছে না” — অ্যাকাউন্ট আছে? Google দিয়ে বানানো? কনফার্ম হয়নি? |
| `is_admin()` / `is_staff()` / `is_seller()` / `has_role(text[])` | RLS-এর ভিত্তি |
| `recalc_product_rating(uuid)` | ট্রিগার থেকে রেটিং অ্যাগ্রিগেট |
| `login_audit`, `log_audit`, `gen_order_no`, `gen_payment_no` | হেল্পার |

বাংলা এরর কোড: `CART_EMPTY`, `CUSTOMER_INCOMPLETE`, `PRODUCT_UNAVAILABLE:name`,
`OUT_OF_STOCK:name`, `COUPON_INVALID`, `COUPON_MIN_ORDER:amount`,
`PAYMENT_METHOD_UNAVAILABLE`, `ADMIN_ONLY`, `PAYMENT_NOT_FOUND`।
অ্যাপ এগুলো বাংলা বাক্যে অনুবাদ করে (`lib/orders.ts`), আসল টেক্সট শুধু সার্ভার লগে যায়।

### সেটিংস

`site_settings` গ্রুপ কী: `store`, `delivery`, `seller`, `reviews`, `payments`,
`premium`, `announcement` — প্রতিটির মান JSONB, `/foisal/settings` থেকে সম্পাদনাযোগ্য।

---

## ৪. রোল, RLS ও স্টোরেজ

- **রোল**: `customer`, `seller`, `premium`, `staff`, `admin` (`profiles.role`, enum)
- **RLS**: প্রতিটি টেবিলে চালু (৬০/৬০)। নিয়ম:
  - পাবলিক পড়ে শুধু প্রকাশিত/সক্রিয় রো (`is_active`, `status = 'published'`)
  - কাস্টমার নিজের অর্ডার/পেমেন্ট/ঠিকানা/রিভিউ/অভিযোগ/উইশলিস্ট
  - সেলার নিজের পণ্য, নিজের সাব-অর্ডার, নিজের পেআউট
  - অ্যাডমিন সব (`is_admin()`), স্টাফ সীমিত (`is_staff()`)
  - `payments.status` ক্লায়েন্ট কখনো লিখতে পারে না (কলাম-লেভেল GRANT)
- **স্টোরেজ**: ১০টি পাবলিক বাকেট (jpeg/png/webp/avif, ২–৮ MB, ম্যাজিক-বাইট যাচাই,
  র‍্যান্ডম ফাইলনাম, `media_assets` রো + অডিট), `payment-proofs` প্রাইভেট
  (শুধু মালিক ও অ্যাডমিন)।

অ্যাডমিন লেখালেখি লগইন করা সেশন + RLS দিয়েই হয়। সার্ভিস কী শুধু সেই রুটে
যেখানে সত্যিই দরকার (চেকআউট, পেমেন্ট verdict, সিস্টেম চেক), কখনো ব্রাউজারে নয়।

---

## ৫. অ্যাডমিন প্যানেল (`/foisal`)

লগইন: `/foisal/login` (একই Supabase Auth; অ্যাডমিন ছাড়া কেউ ঢুকতে পারে না)।

পেজগুলো: ড্যাশবোর্ড · অর্ডার (স্টেটাস বদল, লেবেল) · পেমেন্ট কিউ (approve/reject,
CSV) · পেমেন্ট মাধ্যম · পণ্য · ক্যাটাগরি · কম্বো · খামার · ক্যামেরা · সেলার ·
পেআউট · ক্যামেরা অনুরোধ · প্রিমিয়াম প্ল্যান · অ্যাক্সেস কোড · সাবস্ক্রিপশন ·
রিভিউ মডারেশন · অভিযোগ · গ্রাহক · টিম ও রোল · হোমপেজ সেকশন · হিরো স্লাইড ·
ব্যানার · মেনু · ব্লগ · FAQ · স্ট্যাটিক পেজ · SEO · সোশ্যাল · মিডিয়া · অডিট লগ ·
সেটিংস · **সিস্টেম চেক**।

সব জায়গায়: বাংলা ভ্যালিডেশন মেসেজ, টোস্ট, লোডিং স্কেলিটন, ডাবল-সাবমিট
প্রোটেকশন (বাটন ডিজেবল + `useTransition`), খালি অবস্থার বার্তা, আর প্রতিটি
লেখার পরে `revalidateContent()` — পাবলিক পেজ সাথে সাথে আপডেট হয়। প্রতিটি
পরিবর্তন `audit_log`-এ যায় (কে, কখন, কী বদলাল, পুরোনো→নতুন)।

---

## ৬. মূল ফ্লো (কোডে কোথায়)

| ফ্লো | এন্ট্রি | ডেটাবেস |
|---|---|---|
| সাইনআপ/লগইন | `app/(storefront)/login`, `app/api/auth/*` | Supabase Auth + `handle_new_user()` → `profiles` |
| কার্ট | `lib/cart.tsx` (localStorage) → লগইনে `cart_items` | `cart_items` |
| চেকআউট | `app/api/orders` → `lib/orders.ts` | **`place_order()`** |
| ম্যানুয়াল পেমেন্ট | `app/api/payments/submit` | `payments` (TrxID ইউনিক) |
| পেমেন্ট অনুমোদন | `/foisal/payments` → `lib/manual-payments.ts` | **`approve_payment()`** |
| ট্র্যাকিং | `/track` → `app/api/orders/track` | `orders` + `order_items` (অর্ডার নম্বর + ফোন) |
| রিভিউ | `components/review-form.tsx` → `app/api/reviews` | `reviews` + `review_photos` → রেটিং ট্রিগার |
| প্রিমিয়াম | `/live/plans` → `app/api/premium/*` | `user_subscriptions`, `access_codes`, `trials` |
| লাইভ ক্যামেরা | `/live` → `app/api/stream/token` | `cameras`, `stream_tokens`, `premium_devices` |
| সেলার | `/seller/apply` → `app/api/sellers/apply` | `sellers` (pending → approved) |

---

## ৭. লোকাল সেটআপ

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_SUPABASE_URL, PUBLISHABLE_KEY, SECRET_KEY বসান
npm run dev                     # http://localhost:3000
```

`.env.local` ছাড়াও অ্যাপ চালু হয় — তখন প্রতিটি সেকশন “এখনো কিছু নেই” অবস্থায়
থাকে, কোনো ক্র্যাশ নেই। প্যানেল `/foisal` তখন “ডেটাবেস কনফিগার করা নেই” দেখায়।

### স্ক্রিপ্ট

| কমান্ড | কাজ |
|---|---|
| `npm run dev` | ডেভ সার্ভার (0.0.0.0:3000) |
| `npm run build` / `start` | প্রোডাকশন বিল্ড/রান |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run db:types` | `supabase/sql` পড়ে `lib/database.types.ts` বানায় (PGlite, Supabase লাগে না) |
| `npm run db:check` | সব SQL ফাইল দুবার চালিয়ে যাচাই (ইডেমপোটেন্সি + `13`-এর FAIL) |
| `npm run db:columns` | কোডের `.from().select()/eq()/order()` কলাম ও স্কিমা মেলায় |
| `npm run security` | সিকিউরিটি স্ক্যান (গার্ডহীন রুট, লিক হওয়া সিক্রেট, CSP) |
| `npm run budget` | রুট-ভিত্তিক JS বাজেট |
| `npm run verify` | উপরের সব (ডিপ্লয়ের আগে এটাই চালান) |

---

## ৮. Vercel ডিপ্লয়

1. GitHub-এ পুশ → Vercel → **Add New → Project** → রিপো সিলেক্ট
2. Framework: **Next.js** (অটো ডিটেক্ট), Build: `npm run build`
3. **Environment Variables** যোগ করুন (ধাপ ৭)
4. **Deploy** → ডোমেইন: `https://bishwasagro.vercel.app`
5. Auth → URL Configuration-এ ডোমেইনটি আছে কি না মিলিয়ে নিন (ধাপ ৪)
6. কাস্টম ডোমেইন যোগ করলে `NEXT_PUBLIC_SITE_URL` বদলে **Redeploy**

> মাইগ্রেশন ডিপ্লয়ের অংশ নয় — SQL সবসময় হাতে, SQL Editor-এ।

---

## ৯. স্কিমা বদলাতে চাইলে (ভবিষ্যতের জন্য)

1. `supabase/sql/`-এ নতুন ফাইল বা বিদ্যমান ফাইলে কলাম যোগ করুন (ইডেমপোটেন্ট রাখুন)
2. `npm run db:check` — সব ফাইল এখনো পরিষ্কার?
3. `npm run db:types` — টাইপ রিজেনারেট
4. `npm run db:columns` — কোডে পুরোনো নাম রয়ে গেলে ধরা পড়বে
5. SQL Editor-এ শুধু বদলানো অংশটি (বা পুরো ফাইল) চালান
6. `13_verify_setup.sql` → ০ FAIL, `/foisal` → System Check

---

## ১০. আরও

- **লাইভ ক্যামেরা (ভিপিএস ছাড়া — প্রস্তাবিত)**: Imou Life / EZVIZ অ্যাপে ক্যামেরা যোগ করে
  `IMOU_APP_ID`/`IMOU_APP_SECRET` (বা `EZVIZ_APP_KEY`/`EZVIZ_APP_SECRET`) ও
  `STREAM_TOKEN_SECRET` দিন, তারপর অ্যাডমিনে ক্যামেরার **স্ট্রিম সোর্স** বেছে নিন।
  দেখুন `docs/live-camera-no-vps.md`।
- **লাইভ ক্যামেরা (ভিপিএস পথ)**: MediaMTX/go2rtc নিজের VPS-এ চালান, `STREAM_PROXY_TARGET`
  দিন। Vercel ক্যামেরা রেকর্ড রাখে, স্ট্রিম প্রক্সি করে (`app/api/stream/*`)।
  AWS Free Tier-এ ৫–৭ দিনের টেস্ট: `docs/live-camera-aws-test.md`।
  টোকেন স্বল্পমেয়াদি (`STREAM_TOKEN_SECRET`), প্রতি ইউজার ডিভাইস-লিমিট
  `premium_devices`-এ থাকে।
- **PWA/Android**: `manifest.ts`, service worker, Capacitor (`npm run cap:sync`)।
  পুশ নোটিফিকেশন VAPID কী ছাড়া চুপচাপ বন্ধ থাকে।
- **ব্লগ/SEO**: `app/sitemap.ts`, `lib/seo.ts`, JSON-LD, `seo_meta` টেবিল (প্রতি পেজে
  টাইটেল/ডেসক্রিপশন ওভাররাইড)।
- **অডিট**: প্রতিটি অ্যাডমিন কাজ `audit_log`-এ; `/foisal/audit`-এ ফিল্টার সহ দেখা যায়।

লাইসেন্স: প্রাইভেট প্রজেক্ট — বিশ্বাস এগ্রো কর্তৃক ব্যবহৃত।

---

## নতুন আপডেট: স্টোরেজ ফিক্স, সেলার অ্যাক্সেস, পেমেন্ট মেথড ও রিয়েলটাইম নোটিফিকেশন

### নতুন SQL ফাইল চালানোর নিয়ম (Supabase SQL Editor)
আগের `01` থেকে `13` চালানো থাকলে শুধু নিচের নতুন ৩টি ফাইল একের পর এক চালান:
1. `supabase/sql/14_storage_fix.sql` — সব ১১টি Storage বাকেট ও RLS পলিসি ঠিক করে ("Bucket not found" সমাধান)।
2. `supabase/sql/15_seller_applications_and_panel_path.sql` — `seller_applications` টেবিল, `panel_path` কলাম, `notifications` Realtime এবং অর্ডার নোটিফিকেশন ট্রিগার যোগ করে।
3. `supabase/sql/16_verify_seller_rls_and_storage.sql` — সব ঠিক আছে কিনা যাচাই করে (সবগুলো `PASS` দেখাবে)।

### সেলার আবেদন ও অ্যাডমিন অনুমোদন
- **সেলার হতে আবেদন:** সাধারণ কাস্টমার লগইন করে অ্যাকাউন্ট পেজ থেকে **"বিক্রেতা হতে আবেদন করুন"** ফর্ম পূরণ করবেন (খামারের নাম, ফোন, ঠিকানা, ছবি, NID ও পেমেন্ট তথ্য)।
- **অ্যাডমিন অনুমোদন / সরাসরি সেলার:** অ্যাডমিন প্যানেলের **সেলার** সেকশন থেকে আবেদন Approve/Reject করতে পারবেন, অথবা **"ইউজার থেকে সেলার যোগ করুন"** দিয়ে যেকোনো সাধারণ ইউজারকে সরাসরি সেলার বানাতে পারবেন।
- **কাস্টম সেলার প্যানেল URL:** অ্যাডমিন প্যানেল থেকে গ্লোবাল ডিফল্ট (`/seller`) অথবা নির্দিষ্ট সেলারের জন্য কাস্টম পাথ (যেমন `/fijir`) সেট করা যায়। সেলার সেই URL-এ গিয়ে লগইন করলেই নিজের প্যানেল দেখতে পাবেন।

### পেমেন্ট মেথড ও লোগো আপলোড ("Bucket not found" সমাধান)
- অ্যাডমিন → **পেমেন্ট মাধ্যম** পেজে গিয়ে **প্রোভাইডার** ড্রপডাউন (bKash, Nagad, Rocket, Upay, Bank Transfer, Cash on Delivery) থেকে বাছাই করলে বাংলা নির্দেশনা অটো-পূরণ হবে।
- লোগো আপলোড করলে `logos/payment-methods/` বাকেটে সেভ হবে। যদি কখনো `"Bucket not found"` দেখায়, তাহলে `14_storage_fix.sql` চালিয়ে অ্যাডমিন → **System Check** পেজে সব বাকেট সবুজ (green) আছে কিনা দেখে নিন।

### রিয়েলটাইম অর্ডার নোটিফিকেশন
- কোনো কাস্টমার অর্ডার করলে সাথে সাথে অ্যাডমিন ও সংশ্লিষ্ট সব সেলারের কাছে বেল আইকনে রিয়েলটাইম নোটিফিকেশন চলে যাবে।

---

## নতুন পেমেন্ট সিস্টেম (SQL ফাইল ১৭ থেকে ২১)
Supabase Dashboard → **SQL Editor**-এ নিচের ৫টি ফাইল একের পর এক চালান:
1. `supabase/sql/17_payments_reset.sql` — শুধু পুরোনো পেমেন্ট টেবিল/পলিসি মুছে ফেলে (অর্ডার, প্রোডাক্ট বা ইউজার মুছে না)।
2. `supabase/sql/18_payments_schema.sql` — নতুন `payment_methods`, `payments`, `payment_logs`, `payment_settings` টেবিল তৈরি করে।
3. `supabase/sql/19_payments_functions.sql` — `submit_payment()`, `review_payment()`, `cancel_unpaid_orders()` RPC ও ট্রিগার তৈরি করে।
4. `supabase/sql/20_payments_rls_storage.sql` — RLS পলিসি, `payment-logos` ও `payment-proofs` বাকেট এবং `payments` Realtime চালু করে।
5. `supabase/sql/21_payments_seed.sql` — bKash, Nagad, Rocket, Upay, Bank, COD ডিফল্ট মেথড যোগ করে (অ্যাডমিন চালু না করা পর্যন্ত নিষ্ক্রিয় থাকবে)।

---

## কুপন, রেফারেল ও ওয়ালেট (SQL ফাইল ২৫)
একটি ফাইলই — Supabase → **SQL Editor**-এ `supabase/sql/25_coupons_referrals_wallet.sql`
পুরোটা পেস্ট করে **Run**। রি-রানেবল (দুবার চালালেও ক্ষতি নেই)।

যা তৈরি/বদলায়:

| কী | বিস্তারিত |
| --- | --- |
| `coupons` কলাম | `audience` (`all`/`assigned`/`influencer`), `funder_user_id`, `funder_note`, `is_referral` |
| নতুন টেবিল | `coupon_redemptions` (কে কখন কোন কুপন ব্যবহার করল), `coupon_audiences` (কারা পারবে), `wallet_transactions` (লেনদেন) |
| `profiles` | `referral_code`, `referred_by`, `referred_at`, `wallet_balance`, `wallet_earned`, `wallet_spent` — প্রতিটি প্রোফাইলে কোড স্বয়ংক্রিয়ভাবে বসে |
| `orders` | `wallet_used` (ওয়ালেট থেকে কত টাকা গেল) |
| ফাংশন | `wallet_apply`, `credit_referral`, `coupon_allows_user`, `coupon_refusal`, `apply_referral`, `gen_referral_code` |
| `place_order` | নতুন আর্গুমেন্ট `p_wallet`; **পুরোনো ৫-আর্গুমেন্ট ভার্সন drop করা হয়** যাতে PostgREST "could not choose best candidate" না দেয় |
| `site_settings.referral` | `{enabled, commission_percent:5, wallet_max_percent:30, credit_on:'delivered', min_order:300, commission_base:'subtotal'}` — অ্যাডমিন → সাইট সেটিংস → "রেফারেল ও ওয়ালেট" |
| `coupons.share_token` | ইনফ্লুয়েন্সার কুপনের পাবলিক শেয়ার টোকেন (`?ref=TOKEN`), স্বয়ংক্রিয়ভাবে তৈরি |

**রেফারেল কীভাবে কাজ করে (রিভিশন ২):** ইনভাইট করা গ্রাহকের **প্রতিটি** ডেলিভারি হওয়া অর্ডার থেকে ইনভাইটার কমিশন পান (অর্ডারপ্রতি একবার)। যে কোনো শেয়ার লিংক — প্রোফাইল লিংক বা **প্রোডাক্ট লিংক** — `?ref=` বহন করে, তাই ওই লিংক দিয়ে কেউ অ্যাকাউন্ট খুললেই সে ইনভাইটার হিসেবে যুক্ত হয়। ইনফ্লুয়েন্সারের কোড খোলা: তিনি যাকেই খুশি দিতে পারেন।

চালানোর পরে অ্যাডমিন → **System Check** দেখুন, তারপর
`/foisal/coupons`, `/foisal/wallet`, `/foisal/settings` ঘুরে নিন।

### সমস্যা সমাধান (Troubleshooting)
- **Bucket not found:** `14_storage_fix.sql` এবং `20_payments_rls_storage.sql` চালান, তারপর অ্যাডমিন → **System Check** পেজ দেখুন।
- **Duplicate TrxID:** একই TrxID দিয়ে দ্বিতীয়বার সাবমিট করলে বাতিল হবে (শুধুমাত্র অ্যাডমিন Reject করলে পুনরায় সাবমিট করা যাবে)।
- **Permission denied / RLS violation:** সাধারণ ইউজার অন্যের পেমেন্ট দেখতে বা অ্যাপ্রুভ করতে পারবে না — এটি নিরাপত্তার জন্য।
