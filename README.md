# বিশ্বাস এগ্রো (Biswas Agro) — Farm to Family

> **বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে**

A production-ready, mobile-first, Bangla-first e-commerce storefront for fresh farm produce, daily combo boxes and monthly family food subscriptions — built with **Next.js 15 + Tailwind + Supabase**, deployed on **Vercel**.

- 🌐 Domain: **https://bishwasagro.com**
- 🗄️ Database: Supabase Postgres (RLS enabled)
- 🎨 Dark theme · greens `#1f7a4d` / mint `#b7ead2` / bg `#111`

---

## ১. যা যা আছে (Features)

| # | Section | Route |
|---|---------|-------|
| 1 | হেডার + ঘোষণা বার + সার্চ + কার্ট কাউন্ট + অ্যাকাউন্ট আইকন | every page |
| 2 | হিরো — পণ্য দেখুন / মাসিক প্যাকেজ | `/` |
| 3 | ৯টি ক্যাটাগরি পেজ | `/categories`, `/categories/[slug]` |
| 4 | প্রোডাক্ট কার্ড, বিস্তারিত পেজ, সার্চ + ফিল্টার + সর্টিং | `/products`, `/products/[slug]` |
| 5 | দৈনিক / সাপ্তাহিক কম্বো বক্স | `/combos`, `/combos/[slug]` |
| 6 | মাসিক ফ্যামিলি সাবস্ক্রিপশন (pause/cancel) | `/subscription`, `/account/subscriptions` |
| 7 | কার্ট (localStorage) + চেকআউট (বিভাগ→জেলা→উপজেলা) | `/cart`, `/checkout` |
| 8 | পেমেন্ট — bKash / Nagad / SSLCommerz / COD | `/payment/[method]` |
| 9 | অর্ডার ট্র্যাকিং (৪ ধাপ) | `/track` |
| 10 | খামার ও কৃষক, সার্টিফিকেশন | `/farm` |
| 11 | কেন আমাদের বেছে নেবেন | `/` (home section) |
| 12 | রিভিউ + স্টার রেটিং + টেস্টিমোনিয়াল স্লাইডার | `/products/[slug]`, `/` |
| 13 | ব্লগ / হেলথ টিপস | `/blog`, `/blog/[slug]` |
| 14 | About / Contact (ফর্ম, ফোন, WhatsApp, ম্যাপ) / FAQ | `/about`, `/contact`, `/faq` |
| 15 | ফুটার, নিউজলেটার, পলিসি পেজ | `/policies/privacy`, `/policies/terms`, `/policies/refund` |
| 16 | ইউজার অ্যাকাউন্ট — OTP / ইমেইল লগইন, অর্ডার, ঠিকানা, সাবস্ক্রিপশন | `/login`, `/account/**` |
| 17 | অ্যাডমিন প্যানেল | `/admin/**` |
| 18 | **লাইভ খামার ক্যামেরা** (প্রিমিয়াম CCTV, ১০ মিনিট ফ্রি ট্রায়াল) | `/live`, `/live/farms`, `/live/farms/[slug]` |
| 19 | **ডেইরি লাইভ** — আজকের দুধ উৎপাদন ও বিক্রি রিয়েল-টাইমে | `/live/dairy` |
| 20 | **প্রিমিয়াম প্ল্যান + পেমেন্ট + অ্যাক্সেস কোড** | `/live/plans`, `/live/trial`, `/account/premium` |
| 21 | **মাল্টি-ভেন্ডর মার্কেটপ্লেস** — সেলার স্টোর, আবেদন, ড্যাশবোর্ড | `/market`, `/market/[slug]`, `/seller/**` |
| 22 | **কাস্টম কম্বো বিল্ডার** (৫%/৮% বান্ডল ছাড়) | `/combos/build`, `/account/combos` |
| 23 | **QR শিপিং লেবেল + রাইডার স্ক্যান পেজ** | `/admin/orders/[orderNo]/label`, `/p/[token]` |
| 24 | **PWA + Web Push + Android (Capacitor) শেল** | `/manifest.webmanifest`, `/sw.js`, `capacitor.config.ts` |

**Extras:** ফ্লোটিং WhatsApp/কল, back-to-top, লোডিং স্কেলিটন, টোস্ট, বাংলা/English টগল, idempotent seed (৪৭ পণ্য), Zod ভ্যালিডেশন, bcrypt পাসওয়ার্ড, JWT সেশন, in-memory rate limiting।

### অ্যাডমিন প্যানেল (`/admin`)

| পেজ | কী করে |
|-----|---------|
| `/admin` | আজকের অর্ডার/বিক্রয়, কম স্টক, সাম্প্রতিক অর্ডার |
| `/admin/orders` | স্টেটাস আপডেট, ইনভয়েস প্রিন্ট, CSV এক্সপোর্ট |
| `/admin/products` | পণ্য CRUD + ছবি আপলোড (Supabase Storage) |
| `/admin/categories` | ক্যাটাগরি CRUD |
| `/admin/subscriptions` | সাবস্ক্রিপশন active/paused/cancelled |
| `/admin/customers` | কাস্টমার তালিকা |
| `/admin/coupons` | কুপন CRUD |
| `/admin/delivery` | ডেলিভারি জোন ও চার্জ |
| `/admin/banners` | ব্যানার CRUD |
| `/admin/blog` | ব্লগ CRUD |
| `/admin/reviews` | রিভিউ মডারেশন (approve / hide / delete) |
| `/admin/reports` | দৈনিক/সাপ্তাহিক/মাসিক বিক্রয় + CSV |
| `/admin/premium` | প্রিমিয়াম সাবস্ক্রিপশন, লাইভ দর্শক, ডিভাইস |
| `/admin/plans` | প্রিমিয়াম প্ল্যান CRUD (দাম, ফিচার, মেয়াদ) |
| `/admin/codes` | অ্যাক্সেস কোড ব্যাচ তৈরি, কপি, CSV এক্সপোর্ট |
| `/admin/farms` | খামার CRUD (ম্যাপ কোঅর্ডিনেট, সার্টিফিকেশন) |
| `/admin/cameras` | ক্যামেরা CRUD (stream key, প্রোটোকল, স্টেটাস) |
| `/admin/sellers` | সেলার অনুমোদন, কমিশন, পেমেন্ট তথ্য |
| `/admin/camera-requests` | ক্যামেরা ইনস্টল রিকোয়েস্ট |
| `/admin/orders/[orderNo]/label` | A6 শিপিং লেবেল + QR প্রিন্ট |

---

## ২. লোকাল সেটআপ

```bash
# ১) ডিপেন্ডেন্সি
npm install

# ২) এনভায়রনমেন্ট
cp .env.example .env.local
# → Supabase URL, anon key, service role key, JWT_SECRET বসান

# ৩) ডেভ সার্ভার
npm run dev
# http://localhost:3000
```

### স্ক্রিপ্ট

| কমান্ড | কাজ |
|--------|-----|
| `npm run dev` | ডেভ সার্ভার (`0.0.0.0:3000`) |
| `npm run build` | প্রোডাকশন বিল্ড |
| `npm run start` | প্রোডাকশন সার্ভার |
| `npm run typecheck` | TypeScript চেক |
| `npm run db:migrate` | `supabase/migrations/*.sql` প্রয়োগ |
| `npm run db:seed` | ৪৭ পণ্য + ক্যাটাগরি + কম্বো + কুপন সিড (idempotent) |
| `npm run db:admin` | অ্যাডমিন অ্যাকাউন্ট তৈরি/আপডেট |
| `npm run db:seed:sql` | সিড SQL জেনারেট → `supabase/seed.sql` |

---

## ৩. ডেটাবেসের বর্তমান অবস্থা (ইতিমধ্যে লাইভ)

প্রজেক্ট `biswas-agro` (ref `lyihdzgmtjkkhybpkqot`, region `ap-southeast-1`) ইতিমধ্যে তৈরি,
মাইগ্রেশন প্রয়োগ এবং সিড করা হয়েছে:

| টেবিল | রো |
|-------|-----|
| categories | 9 |
| products | 47 |
| combos | 4 |
| packages | 3 |
| delivery_zones | 11 |
| coupons | 3 |
| farmers | 4 |
| reviews | 6 |
| blog_posts | 6 |
| banners | 3 |
| users (admin) | 1 |
| **farms** | **5** |
| **cameras** | **10** |
| **premium_plans** | **4** |
| **sellers** | **3** (approved, ২২টি পণ্য সংযুক্ত) |

স্টোরেজ বাকেট `product-images` ও `farm-media` (public) তৈরি করা আছে।
আপনার শুধু দরকার `.env.local` (বা Vercel env) বসানো — বাকি সব প্রস্তুত।

### ১৯টি অতিরিক্ত টেবিল (0003)

`farms`, `cameras`, `camera_view_logs`, `premium_plans`, `premium_subscriptions`,
`premium_access_codes`, `premium_devices`, `trial_grants`, `stream_sessions`, `sellers`,
`seller_payouts`, `camera_requests`, `sub_orders`, `custom_combos`, `notifications`,
`push_subscriptions`, `fcm_tokens`, `parcels`, `audit_logs` — সাথে ভিউ
`v_farm_stats`, `v_premium_revenue`, `v_seller_leaderboard`।

সিড ফাইল দুইটি:

```bash
npm run db:seed        # মূল ক্যাটালগ (৪৭ পণ্য …)
npm run db:seed:sql    # supabase/seed.sql পুনরায় জেনারেট

# প্রিমিয়াম ফার্ম/ক্যামেরা/প্ল্যান/সেলার (idempotent)
node --experimental-strip-types scripts/seed-premium-sql.mjs > supabase/seed-premium.sql
# তারপর supabase/seed-premium.sql ফাইলটি Supabase SQL Editor-এ চালান
```

---

## ৪. Supabase সেটআপ (নতুন প্রজেক্টে)

1. [supabase.com](https://supabase.com) → **New project** → নাম `biswas-agro`, region `ap-southeast-1`.
2. **SQL Editor → New query** → `supabase/migrations/0001_init.sql` পেস্ট করে **Run**।
3. আবার **New query** → `supabase/migrations/0002_otp.sql` পেস্ট করে **Run**
   (OTP ইনডেক্স + `product-images` স্টোরেজ বাকেট তৈরি করে)।
4. **Project Settings → API** থেকে কপি করুন:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ শুধু সার্ভারে, কখনো ক্লায়েন্টে নয়

অথবা CLI দিয়ে:

```bash
npm run db:migrate
npm run db:seed
npm run db:admin
```

> **নোট:** `db:migrate` REST endpoint ব্যবহার করে। যদি আপনার প্রজেক্টে সেটি বন্ধ থাকে, উপরের ধাপ ৩ অনুযায়ী SQL Editor-এ ফাইল দুটি ম্যানুয়ালি রান করুন — ফলাফল একই।

### ডিফল্ট অ্যাডমিন

```
URL:      /admin/login
ইমেইল:   admin@bishwasagro.com
পাসওয়ার্ড: Admin@12345
```

⚠️ **প্রথম লগইনের পর পাসওয়ার্ড বদলে নিন** (`ADMIN_PASSWORD` বদলে `npm run db:admin` আবার চালান)।

### ডেমো কুপন

| কোড | ছাড় | শর্ত |
|------|------|------|
| `BISWAS10` | ১০% (সর্বোচ্চ ৳২০০) | ৳৫০০+ |
| `FRESH100` | ৳১০০ | ৳৯০০+ |
| `NEW200` | ৳২০০ | ৳১৫০০+ |

### ডেলিভারি চার্জ

- ঢাকার ভেতরে — **৳৬০**
- ঢাকার বাইরে — **৳১২০**
- **৳১২০০+** অর্ডারে ফ্রি, কম্বো বক্সে ফ্রি

---

## ৫. Vercel ডিপ্লয়

### ক) GitHub → Vercel

```bash
git add -A
git commit -m "feat: complete Biswas Agro storefront + admin"
git push origin main
```

তারপর [vercel.com/new](https://vercel.com/new) → রিপো `AGRO` ইমপোর্ট → Framework preset **Next.js** (অটো ডিটেক্ট)।

### খ) CLI দিয়ে

```bash
npm i -g vercel
vercel login
vercel link            # নতুন প্রজেক্ট: biswas-agro
vercel env add NEXT_PUBLIC_SUPABASE_URL
# … প্রতিটি ভেরিয়েবল যোগ করুন (Production + Preview + Development)
vercel --prod
```

### Environment Variables (Vercel → Settings → Environment Variables)

| Key | মান |
|-----|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | `https://bishwasagro.com` |
| `NEXT_PUBLIC_WHATSAPP` | `8801XXXXXXXXX` |
| `NEXT_PUBLIC_PHONE` | `+8801XXXXXXXXX` |
| `PAYMENTS_SANDBOX` | `true` (লাইভ গেটওয়ে হলে `false`) |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ও `JWT_SECRET` কখনো `NEXT_PUBLIC_` প্রিফিক্স দেবেন না।

---

## ৬. ডোমেইন + SSL

1. Vercel → Project → **Settings → Domains** → `bishwasagro.com` যোগ করুন।
2. `www.bishwasagro.com`-ও যোগ করুন (redirect → apex)।
3. DNS (registrar-এ):

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `216.198.79.1` |
| `A` | `@` | `64.29.17.1` |
| `CNAME` | `www` | `76459bf9cdc9b57f.vercel-dns-017.com` |

> পুরোনো রেকর্ড থাকলে `A @ → 76.76.21.21` এবং `CNAME www → cname.vercel-dns.com`-ও কাজ করে।
> Vercel → Project → Settings → Domains পেজে সবসময় সর্বশেষ প্রয়োজনীয় রেকর্ড দেখায় — সেটাই authoritative।

4. SSL সার্টিফিকেট Vercel অটো ইস্যু করে (Let's Encrypt) — সাধারণত ১–৫ মিনিট।
5. `NEXT_PUBLIC_SITE_URL` `https://bishwasagro.com` কিনা যাচাই করে **Redeploy** করুন (canonical/OG URL এর জন্য)।

DNS প্রোপাগেশনের পর যাচাই:

```bash
dig +short bishwasagro.com
curl -I https://bishwasagro.com
```

---

## ৭. পেমেন্ট ও SMS (লাইভ করার আগে)

`lib/payments.ts`-এ প্রতিটি গেটওয়ের adapter আছে। স্যান্ডবক্সে `PAYMENTS_SANDBOX=true` থাকলে
`/payment/simulate` ফ্লো ব্যবহার হয়, যাতে পুরো checkout → order → tracking চেইন টেস্ট করা যায়।

লাইভ করতে:

1. **bKash** — Merchant/Developer অ্যাকাউন্ট → `BKASH_*` কী বসান → `PAYMENTS_SANDBOX=false`
2. **Nagad** — merchant ID + private key → `NAGAD_*`
3. **SSLCommerz** — store ID/password → `SSLCOMMERZ_*`, `SSLCOMMERZ_SANDBOX=false`
4. **SMS/OTP** — `SMS_PROVIDER=sslwireless|bulksmsbd` এবং API key সেট করুন। সেট না থাকলে OTP ডেভ মোডে API রেসপন্সে ফেরত আসে (`data.devCode`)।

---

## ৮. প্রজেক্ট স্ট্রাকচার

```
app/
  (storefront)          # হোম, প্রোডাক্ট, ক্যাটাগরি, কম্বো, কার্ট, চেকআউট…
  account/              # ড্যাশবোর্ড, অর্ডার, সাবস্ক্রিপশন, ঠিকানা, উইশলিস্ট
  admin/                # অ্যাডমিন (আলাদা লেআউট + auth guard)
  api/
    admin/              # service-role CRUD (auth guarded)
    auth/               # register, login, logout, me, otp/*
    orders/             # create + track
    payments/           # initiate + simulate
    …
components/             # UI, home/, shop/, admin/
lib/                    # data access, auth, orders, payments, validation, seed
  (storefront)/live/    # লাইভ খামার, ডেইরি, প্ল্যান, ট্রায়াল
  (storefront)/market/  # মার্কেটপ্লেস + সেলার স্টোর
  (storefront)/seller/  # সেলার আবেদন, ড্যাশবোর্ড, ক্যামেরা রিকোয়েস্ট
  api/stream/           # টোকেন ইস্যু + HLS/WHEP প্রক্সি
  api/premium/          # state, trial, subscribe, activate, codes
  api/sellers/          # apply, products, camera-request
  api/farms/dairy/      # আজকের দুধ বোর্ড
components/live/        # LiveStream, FarmCameras, DairyBoard, PlanCheckout
components/maps/        # FarmMap (Leaflet 2D), FarmMap3D (MapLibre terrain)
components/seller/      # ApplyForm, ProductManager, CameraRequestForm
supabase/migrations/    # 0001_init.sql, 0002_otp.sql, 0003_premium_multivendor.sql
scripts/                # migrate, seed, create-admin, seed-premium-sql
data/seed.mjs           # ৪৭ বাংলা পণ্য + ক্যাটাগরি + কম্বো + কুপন
docker-compose.mediamtx.yml  # MediaMTX + go2rtc + Caddy স্ট্রিম স্ট্যাক
mediamtx.yml / go2rtc.yaml / Caddyfile
capacitor.config.ts     # Android শেল
```

### ডেটা লেয়ার

`lib/data.ts` হলো পেজগুলোর **একমাত্র** ডেটা এন্ট্রি পয়েন্ট। Supabase কনফিগার না থাকলে বা
কোয়েরি ব্যর্থ হলে এটি স্বয়ংক্রিয়ভাবে `lib/seed-data.ts`-এ ফলব্যাক করে — তাই সাইট কখনো
ব্ল্যাংক রেন্ডার হয় না, এবং অ্যাডমিন ড্যাশবোর্ডেও সতর্কবার্তা দেখায়।

---

## ৯. লাইভ খামার ক্যামেরা (প্রিমিয়াম CCTV)

### কীভাবে কাজ করে

```
ব্রাউজার ──POST /api/stream/token──▶ Next.js
                                     │ ১. rate limit
                                     │ ২. resolvePremiumState()  (সাব → ট্রায়াল → লক)
                                     │ ৩. per-camera viewer cap
                                     │ ৪. stream_sessions row + ৫ মিনিটের JWT
                                     ▼
                             { url: "/api/stream/hls/<key>/index.m3u8?t=<jwt>" }
ব্রাউজার ──GET /api/stream/hls/…──▶ Next.js ──▶ MediaMTX / go2rtc
                                     │ টোকেন যাচাই + সেশন রিভোক চেক
                                     │ URL-এর stream_key ক্যামেরার সাথে মিলছে?
                                     │ প্লেলিস্টের প্রতিটি লাইন rewrite (t= যোগ)
                                     ▼
                                  RTSP ক্যামেরা (প্রাইভেট নেটওয়ার্ক)
```

**RTSP/IP ক্যামেরার ঠিকানা কখনো ব্রাউজারে যায় না** — `cameras.stream_key` লুকানো কলাম,
শুধু server-side পড়া হয়।

### স্ট্রিমিং সার্ভার চালু করা

```bash
# নিজের VPS বা খামারের রাস্পবেরি পাই-তে
cp mediamtx.yml.example mediamtx.yml   # আসল ফাইলটি ইতিমধ্যে আছে — পাসওয়ার্ড বদলান
docker compose -f docker-compose.mediamtx.yml up -d

# Vercel-এ এনভায়রনমেন্ট ভেরিয়েবল
STREAM_PROXY_TARGET=http://<vps-ip>:8080
GO2RTC_WHEP_URL=http://<vps-ip>:1984/api/webrtc
STREAM_PROXY_SECRET=<random-32-chars>
```

`STREAM_PROXY_TARGET` খালি থাকলে ফিচারটি নীরবে বন্ধ থাকে: UI-তে "স্ট্রিমিং সার্ভার কনফিগার
করা হয়নি" দেখায়, কোনো ক্র্যাশ হয় না। `/admin/cameras`-এ একটি সতর্কবার্তাও দেখাবে।

### এনটাইটেলমেন্ট (কে দেখতে পারবে)

| অবস্থা | ফলাফল |
|-------|--------|
| সক্রিয় প্রিমিয়াম | সব ক্যামেরা (বেসিক টিয়ার: প্রতি খামারের প্রথম ক্যামেরা) |
| গ্রেস পিরিয়ড (৩ দিন) | অ্যাক্সেস চালু, রিনিউ ব্যানার |
| ফ্রি ট্রায়াল (১০ মিনিট) | সব ক্যামেরা, `trial_grants` টেবিলে ট্র্যাক (একবার/ডিভাইস) |
| কিছু নেই | 402 → "ফ্রি ট্রায়াল শুরু করুন" |

ট্রায়াল ব্যবহারকারীর fingerprint = `sha256(IP + UA + accept-language + screen/timezone)`।
ব্রাউজারের localStorage-এ কিছুই থাকে না, তাই "স্টোরেজ ক্লিয়ার" করে ট্রায়াল রিসেট করা যায় না।

### প্ল্যান ও দাম (লাইভ)

| প্ল্যান | দাম | ডিভাইস | মেয়াদ |
|--------|-----|--------|-------|
| বেসিক — মাসিক | ৳১৪৯ | ১ | ৩০ দিন |
| ফুল অ্যাক্সেস — মাসিক | ৳২৯৯ | ২ | ৩০ দিন |
| ফুল — ষান্মাসিক | ৳১,৫৯৯ | ২ | ১৮২ দিন |
| ফুল — বাৎসরিক | ৳২,৮৯৯ | ৩ | ৩৬৫ দিন |

---

## ১০. মাল্টি-ভেন্ডর মার্কেটপ্লেস

- **আবেদন** → `/seller/apply` → `sellers` টেবিলে `pending`
- **অ্যাডমিন অনুমোদন** → `/admin/sellers` (স্টেটাস বদলালেই পাবলিক স্টোর চালু)
- **সেলার ড্যাশবোর্ড** → `/seller` — পণ্য CRUD, বিক্রি/কমিশন, পেআউট ইতিহাস
- **পণ্য অনুমোদন কিউ** — সেলারের নতুন পণ্য বা দাম পরিবর্তন `approval_status = 'pending'`;
  অনুমোদনের আগে গ্রাহক দেখতে পান না
- **পাবলিক স্টোর** → `/market`, `/market/[slug]`
- **কমিশন** — `sellers.commission_percent` (ডিফল্ট ১০%), প্রতি অর্ডারে `sub_orders`-এ ভাগ হয়

## ১১. PWA, পুশ নোটিফিকেশন ও Android অ্যাপ

```bash
# VAPID কী (একবার)
node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});console.log(publicKey.export({type:'spki',format:'der'}).toString('base64url'));console.log(privateKey.export({type:'pkcs8',format:'der'}).toString('base64url'))"
```

- `/manifest.webmanifest` (Next.js `app/manifest.ts`) — installable PWA
- `/sw.js` — **API ও স্ট্রিম কখনো ক্যাশ করে না**; নেভিগেশন network-first, ছবি cache-first
- পুশ: RFC 8291/8292 VAPID, কোনো এক্সটার্নাল লাইব্রেরি ছাড়াই (`lib/push.ts`)

Android শেল:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```

`capacitor.config.ts`-এ `server.url` ডিপ্লয় করা সাইটে পয়েন্ট করা আছে — Server Components ও
API রুট কাজ করবে। এমুলেটরে লোকাল টেস্টের জন্য:

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync android
```

## ১২. সিকিউরিটি

- পাসওয়ার্ড **bcrypt** (cost 12)
- সেশন **JWT (jose)**, `httpOnly` + `sameSite=lax` + `secure` কুকি
- সব ইনপুট **Zod** দিয়ে ভ্যালিডেট, `sanitizeText` দিয়ে স্যানিটাইজ
- **Rate limiting** — লগইন, OTP, ট্র্যাকিং, কন্টাক্ট, রিভিউ
- Supabase **RLS** — পাবলিক রিড শুধু `is_approved` রিভিউ ও অ্যাক্টিভ কনটেন্টে; সব রাইট service role দিয়ে
- অ্যাডমিন রুট দুই স্তরে সুরক্ষিত: server-side layout guard + প্রতিটি API-তে `requireAdmin()`
- নিরাপত্তা হেডার: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
- `/admin` ও `/account` `robots`-এ `noindex`

---

## ১৩. ডিপ্লয়-পরবর্তী চেকলিস্ট

- [ ] `/admin/login` → `admin@bishwasagro.com` দিয়ে লগইন
- [ ] অ্যাডমিন পাসওয়ার্ড বদলানো হয়েছে
- [ ] `npm run db:seed` চালানো হয়েছে — `/products` এ ৪৭ পণ্য দেখা যাচ্ছে
- [ ] একটি টেস্ট অর্ডার (COD) → `/track` এ ট্র্যাকিং কাজ করছে
- [ ] কুপন `BISWAS10` চেকআউটে কাজ করছে
- [ ] অ্যাডমিন `/admin/products` থেকে ছবি আপলোড হচ্ছে (`product-images` বাকেট)
- [ ] `https://bishwasagro.com` এ SSL লক দেখাচ্ছে
- [ ] WhatsApp ফ্লোটিং বাটন সঠিক নম্বরে যাচ্ছে
- [ ] `PAYMENTS_SANDBOX=false` + লাইভ কী (যখন প্রস্তুত)
- [ ] `/live/farms` এ ৫টি খামার ও ক্যামেরা কাউন্ট দেখা যাচ্ছে
- [ ] `/live/trial` → ১০ মিনিটের ট্রায়াল শুরু হচ্ছে
- [ ] `/market` এ ৩টি যাচাইকৃত সেলার স্টোর দেখা যাচ্ছে
- [ ] `/seller/apply` → আবেদন জমা → `/admin/sellers` এ দেখা যাচ্ছে
- [ ] `/admin/orders` → একটি অর্ডারে "শিপিং লেবেল + QR" → প্রিন্ট প্রিভিউ ঠিক আছে
- [ ] মোবাইলে "Add to Home Screen" — আইকন ও নাম ঠিক আছে
- [ ] (স্ট্রিমিং) `docker compose -f docker-compose.mediamtx.yml up -d` + `STREAM_PROXY_TARGET` সেট

---

## License

Proprietary — © 2026 বিশ্বাস এগ্রো / Biswas Agro. All rights reserved.
