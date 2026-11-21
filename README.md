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

## ১৪. ধাপে ধাপে সেটআপ গাইড (কোড না জানলেও পারবেন)

এই অংশটি একদম শুরু থেকে লাইভ করা পর্যন্ত। প্রতিটি ধাপে **কী ক্লিক করবেন** সেটাই লেখা আছে।
এর বাইরে কিছু করার দরকার নেই।

> **গুরুত্বপূর্ণ আর্কিটেকচার নোট**
> - এই সাইট Next.js ১৫ — **Vercel**-এ হোস্ট হয় (Netlify নয়)। তাই `netlify.toml` নেই।
> - `.env` ফাইলে ভ্যারিয়েবলের নাম `NEXT_PUBLIC_*`, `VITE_*` নয়।
> - লগইন **Supabase Auth** (Google + ইমেইল/পাসওয়ার্ড) দিয়ে হয়। পুরোনো পাসওয়ার্ড-অ্যাকাউন্টগুলোও
>   কাজ করে, তাই আগের কোনো ইউজার হারাবে না।
> - Admin প্যানেলের ঠিকানা `bishwasagro.com/admin/login`, লগইন **শুধু ইমেইল + পাসওয়ার্ড**
>   (সেখানে Google বাটন নেই — ইচ্ছাকৃতভাবে)।

### ধাপ ১ — কম্পিউটারে প্রজেক্ট চালু করা

**যা লাগবে:** [Node.js 20+](https://nodejs.org) ও [Git](https://git-scm.com)

```bash
# ১. কোড নামান
git clone https://github.com/farukhossain25/AGRO.git
cd AGRO

# ২. প্যাকেজ ইনস্টল (২-৩ মিনিট লাগে)
npm install

# ৩. এনভায়রনমেন্ট ফাইল তৈরি করুন
cp .env.example .env.local
```

এখন `.env.local` ফাইলটি Notepad/VS Code দিয়ে খুলে নিচের ৪টি মান বসান
(Supabase থেকে পাবেন — ধাপ ২ দেখুন):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=any-long-random-text-at-least-32-characters
```

```bash
# ৪. চালু করুন
npm run dev
```

ব্রাউজারে যান → **http://localhost:3000**। সাইট দেখা যাবে।
👇 বন্ধ করতে টার্মিনালে `Ctrl + C`।

> সাইট দেখা যাচ্ছে কিন্তু পণ্য নেই? → `npm run db:seed`

### ধাপ ২ — Supabase সেটআপ

**ক)** [supabase.com](https://supabase.com) → Sign in → **New project**
- Name: `biswas-agro` · Region: **Southeast Asia (Singapore)** · Database Password: একটা শক্তিশালী পাসওয়ার্ড (নিরাপদে লিখে রাখুন)

**খ)** প্রজেক্ট তৈরি হওয়ার পর বাঁ দিকের মেনু থেকে **SQL Editor** → **New query** →
প্রজেক্টের `supabase/migrations/` ফোল্ডারের ফাইলগুলো **ক্রম অনুযায়ী** পেস্ট করে **Run** করুন:

| ক্রম | ফাইল | কী করে |
|---|---|---|
| ১ | `0001_init.sql` | মূল ১৯টি টেবিল (পণ্য, অর্ডার, ঠিকানা) |
| ২ | `0002_otp.sql` | ফোন OTP |
| ৩ | `0003_premium_multivendor.sql` | খামার, ক্যামেরা, প্রিমিয়াম, সেলার |
| ৪ | `0004_profiles_auth_rls.sql` | **profiles, wishlist, RLS, স্টোরেজ বাকেট, অ্যাডমিন 2FA** |

তারপর `supabase/seed.sql` এবং `supabase/seed-premium.sql` রান করলে ডেমো ডেটা বসবে।

**গ)** **Storage** → **New bucket** — ৩টি বাকেট (সবগুলো **Public**):

| নাম | Public | Size limit | Allowed types |
|---|---|---|---|
| `avatars` | ✅ | 2 MB | `image/jpeg, image/png, image/webp` |
| `product-images` | ✅ | 5 MB | `image/jpeg, image/png, image/webp, image/avif` |
| `farm-images` | ✅ | 8 MB | `image/jpeg, image/png, image/webp` |

> `0004` ফাইলটি নিজেই এই ৩টি বাকেট তৈরি করে ও পলিসি বসায়। উপরের টেবিলটি যাচাই করার জন্য।

**ঘ)** **Project Settings → API** থেকে ৩টি মান কপি করুন:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / `publishable` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(পাবলিক — ব্রাউজারে যাবে)*
- `service_role` / `secret` key → `SUPABASE_SERVICE_ROLE_KEY` *(⚠️ কখনো ব্রাউজারে দেবেন না)*

### ধাপ ৩ — Google লগইন চালু করা

**ক) Google Cloud Console**
1. [console.cloud.google.com](https://console.cloud.google.com) → উপরে প্রজেক্ট সিলেক্ট → **New Project** → নাম `Biswas Agro`
2. বাঁ মেনু → **APIs & Services → OAuth consent screen**
   - User Type: **External** → **Create**
   - App name: `Biswas Agro` · User support email: আপনার জিমেইল · Developer email: আপনার জিমেইল
   - **Save and Continue** (Scopes-এ কিছু বদলাবেন না) → **Save and Continue** → **Back to Dashboard**
   - **Publish App** চাপুন (না চাপলে শুধু টেস্ট ইউজার লগইন করতে পারবে)

**খ) OAuth Client ID তৈরি**
1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `Biswas Agro Web`
4. **Authorized JavaScript origins** — দুটি যোগ করুন:
   ```
   http://localhost:3000
   https://bishwasagro.com
   ```
5. **Authorized redirect URIs** — এখানে Supabase-এর callback URL বসবে (নিজের প্রজেক্ট রেফ বসান):
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   > উদাহরণ: `https://lyihdzgmtjkkhybpkqot.supabase.co/auth/v1/callback`
   > ⚠️ **এখানে সাইটের ডোমেইন দেবেন না** — এটা Supabase-এর ঠিকানা। ভুল হলেই `redirect_uri_mismatch`।
6. **Create** → **Client ID** ও **Client Secret** কপি করুন

**গ) Supabase-এ বসানো**
1. Supabase → **Authentication → Providers → Google** → **Enable**
2. উপরের Client ID ও Client Secret পেস্ট → **Save**

**ঘ) URL Configuration**
Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://bishwasagro.com`
- **Redirect URLs** (প্রতিটি আলাদা লাইনে যোগ করুন):
  ```
  http://localhost:3000/auth/callback
  https://bishwasagro.com/auth/callback
  https://www.bishwasagro.com/auth/callback
  https://*-bishwas-agro.vercel.app/auth/callback
  biswasagro://auth-callback
  ```

শেষের লাইনটি **Android অ্যাপের** জন্য — Google লগইন শেষ হলে অ্যাপে ফিরে আসবে।

### ধাপ ৪ — Vercel-এ ডিপ্লয়

**ক)** [vercel.com](https://vercel.com) → **Add New → Project** → **Import Git Repository** →
`farukhossain25/AGRO` সিলেক্ট করুন

**খ)** সেটিংস (সাধারণত নিজে থেকেই ঠিক থাকে):
- Framework Preset: **Next.js**
- Build Command: `npm run build`
- Output Directory: *(খালি রাখুন)*
- Install Command: `npm install`

**গ) Environment Variables** — **Settings → Environment Variables** → নিচের ৭টি যোগ করুন
(Production + Preview + Development তিনটিতেই টিক দিন):

| Name | Value | গোপন? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | না |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | না |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | ✅ **Sensitive** |
| `JWT_SECRET` | `openssl rand -base64 48` এর আউটপুট | ✅ **Sensitive** |
| `NEXT_PUBLIC_SITE_URL` | `https://bishwasagro.com` | না |
| `ADMIN_EMAIL` | আপনার জিমেইল | না |
| `ADMIN_PASSWORD` | শক্ত পাসওয়ার্ড (১২+ অক্ষর) | ✅ **Sensitive** |
| `SEED_SECRET` | `openssl rand -hex 24` এর আউটপুট | ✅ **Sensitive** |

`openssl rand` কমান্ড দুটি টার্মিনালে চালিয়ে আউটপুট কপি করুন।

**ঘ)** **Deploy** চাপুন → ২-৩ মিনিট → ✅ **Congratulations**

### ধাপ ৫ — অ্যাডমিন অ্যাকাউন্ট তৈরি (একবারই)

```bash
curl -X POST https://bishwasagro.com/api/setup/seed-admin \
  -H "Authorization: Bearer <আপনার SEED_SECRET>"
```

সফল হলে এমন উত্তর আসবে:

```json
{ "ok": true, "data": { "created": true, "email": "you@gmail.com",
  "next": "Now sign in at /admin/login and then remove SEED_SECRET from Vercel." } }
```

**এবার `/admin/login`** → ইমেইল + পাসওয়ার্ড দিয়ে লগইন করুন।

**✅ অত্যন্ত জরুরি — ফাংশনটি বন্ধ করুন:**
Vercel → Settings → Environment Variables → **`SEED_SECRET`** ও **`ADMIN_PASSWORD`** → **Delete**
→ তারপর **Deployments → ⋯ → Redeploy**।

> এরপর ওই URL কেউ ডাকলে `503 SEED_SECRET সেট করা নেই` — অক্ষম হয়ে যাবে।
> একইভাবে দ্বিতীয়বার ডাকলে `409 অ্যাডমিন ইতিমধ্যে তৈরি হয়েছে`।

### ধাপ ৬ — খামার, ক্যামেরা ও পণ্য যোগ করা

**ক) খামার** — `/admin/farms` → **+ নতুন**
- নাম (বাংলা), স্লাগ (ইংরেজি ছোট হাতের, যেমন `savar-greens`), ধরন (শাকসবজি/দুধ/পোল্ট্রি/মাছ/ফল)
- জেলা, উপজেলা, ঠিকানা, অক্ষাংশ/দ্রাঘিমাংশ (`23.8384`, `90.2667`)
- **সংরক্ষণ**

**খ) ক্যামেরা** — `/admin/cameras` → **+ নতুন**
- **খামার** ড্রপডাউন থেকে ধাপ (ক)-এর খামারটি বেছে নিন ← *এই লিংকটাই সবচেয়ে জরুরি*
- নাম (যেমন `জমি ক্যামেরা ১`), জোন, `stream_key` (MediaMTX-এ দেওয়া নাম, যেমন `savar-1`)
- Status: `online` · Protocol: `hls`

**গ) পণ্যের সাথে খামার জোড়া** — `/admin/products` → পণ্য সম্পাদনা
- **Farm** ড্রপডাউনে খামার, **Seller**-এ সেলার (ঐচ্ছিক)
- **সংরক্ষণ**

এরপর ওই পণ্যের পেজে (`/products/<slug>`) নিচে **সরবরাহকারীর তথ্য** কার্ড ও **লাইভ ফুটেজ** ব্লক দেখা যাবে।

### ধাপ ৭ — কীভাবে পরীক্ষা করবেন

| # | কী করবেন | কী দেখা উচিত |
|---|---|---|
| ১ | লগআউট অবস্থায় `/admin` খুলুন | `/admin/login` এ পাঠাবে |
| ২ | **সাধারণ গ্রাহক** দিয়ে লগইন করে `/admin` খুলুন | **403 "প্রবেশাধিকার নেই"** পেজ (লগইন পেজে ফেরত নয়) |
| ৩ | লগইন না করে একটি পণ্যের পেজ | লাইভ ব্লকে **"লাইভ দেখতে লগইন করুন"** |
| ৪ | লগইন করে (প্রিমিয়াম ছাড়া) পণ্যের পেজ | ব্লার ছবি + 🔒 + **"প্রিমিয়াম কিনে লাইভ দেখুন"** |
| ৫ | `/live/trial` → ১০ মিনিটের ট্রায়াল শুরু → পণ্যের পেজ | ✅ আসল লাইভ ভিডিও + ক্যামেরা সুইচার |
| ৬ | `/admin/farms` এ ক্যামেরাহীন খামারের পণ্য | **"এই খামারে এখনো ক্যামেরা নেই"** |
| ৭ | `/admin/cameras` এ status `offline` করুন → পেজ রিফ্রেশ | **"ক্যামেরা অফলাইন"** + সর্বশেষ সময় |
| ৮ | `/account/profile` → ছবি আপলোড, naam, থিম বদল | হেডারে অ্যাভাটার ও থিম সাথে সাথে বদলায় |
| ৯ | `/login` → **Google দিয়ে চালিয়ে যান** | Google অ্যাকাউন্ট বেছে নেওয়ার স্ক্রিন |
| ১০ | `/admin/login` → পাসওয়ার্ড ভুল দিন ৬ বার | "অনেকবার ভুল চেষ্টা — ১৫ মিনিট পর" |

> **RLS প্রমাণ (ডেভেলপার হলে):** দুটি আলাদা ব্রাউজারে দুইজন গ্রাহক লগইন করুন। একজন
> `/api/wishlist` ডাকলে শুধু নিজের আইটেম পাবে — অন্যেরটা কখনো আসবে না, কারণ
> `profiles` ও `wishlists`-এ RLS `auth.uid()` দিয়ে সীমাবদ্ধ।

### ধাপ ৮ — সমস্যা হলে (Troubleshooting)

| সমস্যা | কারণ ও সমাধান |
|---|---|
| **`redirect_uri_mismatch`** | Google Console-এ redirect URI-তে **সাইটের ডোমেইন** দেওয়া হয়েছে। সেখানে হবে `https://<project-ref>.supabase.co/auth/v1/callback` — হুবহু, শেষে স্ল্যাশ ছাড়া। |
| **Google লগইনের পর `localhost`-এ ফিরছে** | Supabase → URL Configuration → **Site URL** এখনো `localhost:3000` আছে। সেটি `https://bishwasagro.com` করুন এবং Redirect URLs-এ Vercel ডোমেইন যোগ করুন। |
| **`Invalid login credentials`** | পাসওয়ার্ড ভুল, অথবা অ্যাকাউন্টটি এখনো `auth.users`-এ নেই (পুরোনো bcrypt অ্যাকাউন্ট)। সমাধান: `/login` → **পাসওয়ার্ড ভুলে গেছি** দিয়ে নতুন পাসওয়ার্ড সেট করুন — তখনই অ্যাকাউন্টটি Supabase Auth-এ যুক্ত হবে। |
| **`Email not confirmed`** | Supabase → Authentication → Providers → Email → **Confirm email** বন্ধ করুন (ডেমোর জন্য), অথবা ইনবক্সের লিঙ্কে ক্লিক করুন। স্প্যাম ফোল্ডারও দেখুন। |
| **`new row violates row-level security policy`** | কোনো টেবিলে পলিসি নেই বা `auth.uid()` মিলছে না। `0004` ফাইলটি সম্পূর্ণ রান করেছেন কি না দেখুন: SQL Editor → `select tablename, policyname from pg_policies where schemaname='public';` |
| **`permission denied for table cameras`** | ঠিক আছে — `stream_key` ইচ্ছাকৃতভাবে ব্রাউজার থেকে বন্ধ। ক্যামেরার নিরাপদ কলামগুলো সার্ভার API দিয়ে পড়ুন। |
| **CORS / `blocked by CORS policy`** | API কল করুন **নিজের ডোমেইন থেকেই** (`/api/...`), সরাসরি `supabase.co`-তে নয়। `NEXT_PUBLIC_SITE_URL` ঠিক আছে কি না দেখুন। |
| **অ্যাডমিন লগইনে `503 কনফিগার করা হয়নি`** | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` সেট নেই, অথবা ধাপ ৫-এর seed এখনো চালাননি। |
| **`503 Supabase unreachable`** | Vercel-এ `SUPABASE_SERVICE_ROLE_KEY` ভুল/মুছে গেছে। ঠিক করে **Redeploy** করুন। |
| **ছবি আপলোড হচ্ছে না** | `avatars` বাকেট নেই বা public নয়। Storage → Buckets দেখুন; ২ MB-এর ছোট JPG দিন। |
| **লাইভ ভিডিও কালো** | `STREAM_PROXY_TARGET` সেট নেই বা MediaMTX চলছে না। `docker compose -f docker-compose.mediamtx.yml up -d` চালান। |

### ধাপ ৯ — নিরাপত্তা চেকলিস্ট (লাইভের আগে)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` কোথাও `NEXT_PUBLIC_` দিয়ে শুরু হয়নি
- [ ] `SEED_SECRET` ও `ADMIN_PASSWORD` Vercel থেকে **মুছে ফেলা হয়েছে**
- [ ] `/admin` এ সাধারণ গ্রাহক **403** পাচ্ছে (ধাপ ৭ এর ২ নম্বর)
- [ ] অ্যাডমিন প্যানেল → **নিরাপত্তা** → **2FA সেটআপ** করা হয়েছে (QR স্ক্যান + ৬ ডিজিট কোড)
- [ ] রিকভারি কোডগুলো প্রিন্ট করে নিরাপদে রাখা হয়েছে
- [ ] Supabase → Authentication → **Leaked password protection** চালু
- [ ] Supabase → Authentication → Sessions → **Time-box user sessions** চালু
- [ ] Google Cloud Console-এ OAuth consent screen **Published**
- [ ] `select tablename from pg_tables where schemaname='public' and not rowsecurity;` → **খালি** আসছে

---

## ১৫. মাল্টি-সেলার রিভিউ, রেটিং ও অভিযোগ (নতুন)

কম্বো অর্ডার কখনো **একটি রিভিউ** দিয়ে রেট হয় না — প্রতিটি সেলার ও প্রতিটি পণ্য আলাদা
রেটিং পায়। ডেটাবেসে এটি `order_reviews` টেবিল, যেখানে `(order_id, product_id)` ইউনিক।

### কে কী করতে পারে

| কাজ | গ্রাহক | সেলার | অ্যাডমিন |
|---|---|---|---|
| রিভিউ লেখা (ডেলিভারির পর) | ✅ ৭ দিনের মধ্যে | ❌ | ❌ |
| রিভিউ সম্পাদনা | ✅ ৭ দিন পর্যন্ত | ❌ | ❌ |
| রিভিউ মুছে ফেলা | ❌ | ❌ | ❌ (শুধু লুকানো/ফিরিয়ে আনা) |
| পাবলিক উত্তর | ❌ | ✅ একবার | ✅ |
| অভিযোগ খোলা | ✅ | ❌ | ❌ |
| অভিযোগের স্ট্যাটাস | দেখে | পর্যালোচনা/সমাধান | সব (বাতিল সহ) |
| কোয়ালিটি স্কোর দেখা | ❌ | নিজের | সব |

### স্ক্রিনের ঠিকানা

| পেজ | কী আছে |
|---|---|
| `/account/orders` | ডেলিভারি হওয়া অর্ডারে **⭐ রিভিউ দিন** + প্রতি পণ্যে **⚠ সমস্যা জানান** |
| `/account/orders/[id]/review` | সেলার-ভিত্তিক গ্রুপে প্রতিটি পণ্যের আলাদা তারা, ট্যাগ, ৩টি ছবি |
| `/account/complaints` · `/[id]` | টিকিট তালিকা ও কথোপকথন (খোলা → পর্যালোচনায় → সমাধান) |
| `/seller/reviews` | সেলারের রিভিউ (একবার উত্তর) ও অভিযোগের ইনবক্স |
| `/admin/reviews` | ভেরিফাইড রিভিউ লুকানো/ফিরিয়ে আনা + পুরোনো মতামত অনুমোদন |
| `/admin/complaints` | সব টিকিট, স্ট্যাটাস ও সেলার ফিল্টার |
| `/admin/suppliers/quality` | সেলার কোয়ালিটি স্কোর, সতর্কবার্তা, স্থগিতাদেশ |

### স্কোর কীভাবে হিসাব হয় (`v_supplier_quality`)

```
quality_score = (গড় রেটিং / ৫) × ৫০
              + (১০০ − অভিযোগের হার%) × ০.৩০
              + সময়মতো ডেলিভারি% × ০.২০
```

- গড় রেটিং ৫০%, অভিযোগের হার ৩০%, সময়মতো ডেলিভারি ২০%
- ৬০-এর নিচে গেলে অ্যাডমিন প্যানেলে **নজর দিন** ব্যাজ, ৪০-এর নিচে স্থগিতাদেশের সুপারিশ
- সতর্কবার্তা/স্থগিতাদেশ `seller_warnings` ও `audit_logs`-এ সংরক্ষিত থাকে

### মাইগ্রেশন চালানো

`supabase/migrations/0005_reviews_complaints.sql` (৫১৮ লাইন) — ০০০৪-এর **পরে** চালান।
লাইভ ডেটাবেসে ইতিমধ্যে প্রয়োগ করা হয়েছে (৪টি ধাপে): `order_reviews`, `complaints` +
`complaint_messages`, রোলআপ ফাংশন ও দুটি ভিউ, RLS + স্টোরেজ বাকেট।

```sql
-- যাচাই
select count(*) from review_tags;              -- ৮
select count(*) from v_supplier_quality;       -- সেলার সংখ্যা
select tablename, policyname from pg_policies where tablename in
  ('order_reviews','complaints','complaint_messages','seller_warnings');
```

### ছবি আপলোড

`POST /api/upload` (মাল্টিপার্ট `file` + `bucket`) — `review-photos` বা `complaint-photos`,
প্রতি ব্যবহারকারী নিজের ফোল্ডারেই লেখেন। MIME + magic-byte যাচাই, ৪ MB সীমা।

> **গুরুত্বপূর্ণ:** পুরোনো `reviews` টেবিলটি (হোমপেজের মতামত) আলাদাই আছে। সেটি
> ভেরিফাইড নয়, তাই পণ্যের গড় রেটিংয়ে যোগ হয় না — শুধু প্রদর্শনের জন্য।

### ধাপ ১৫ — রিভিউ ও অভিযোগ টেস্ট

1. একটি অর্ডার দিন → অ্যাডমিন `/admin/orders` থেকে **delivered** করুন
2. গ্রাহক অ্যাকাউন্টে নোটিফিকেশন আসবে → `/account/orders/[id]/review`
3. ১ তারা দিন + নেতিবাচক ট্যাগ (বাসি) → সেলার ও অ্যাডমিন নোটিফিকেশন পাবেন
4. আবার একই পণ্যে রিভিউ দিন → নতুন সারি হয় না, আগেরটি সম্পাদনা হয়
5. `/account/orders` → **সমস্যা জানান** → টিকিট তৈরি → `/admin/complaints`-এ দেখা যাবে
6. সেলার `/seller/reviews` থেকে উত্তর দিন — একবারই পারবেন, দ্বিতীয়বার 409
7. অ্যাডমিন `/admin/reviews`-এ লুকান → পণ্য পাতায় অদৃশ্য, স্কোর আবার হিসাব হয়

---

## ১৬. সব ডিভাইসে নিখুঁত (Android, iPhone, ট্যাব, ডেস্কটপ)

### ব্রেকপয়েন্ট

| প্রস্থ | কাদের জন্য | কী বদলায় |
|---|---|---|
| ৩৬০px | ছোট Android, iPhone SE | প্যাডিং কমানো, কার্ড রেডিয়াস ছোট, শিরোনাম ২২px |
| ৩৬০–৬৩৯ | সব ফোন | এক কলাম, নিচে-স্ক্রলযোগ্য নেভিগেশন |
| ৭৬৮–১০২৩ | ট্যাব | দুই কলাম শুরু, সাইডবার আসে |
| ≥১০২৪ | ল্যাপটপ | পূর্ণ নেভিগেশন, ৩–৪ কলাম গ্রিড |
| ≥১৫৩৬ | বড় ডেস্কটপ | কন্টেইনার ৮৪rem-এ সীমিত (পড়ার আরাম) |

### iOS Safari-তে যা ঠিক করা আছে

- `100dvh` ব্যবহার — `100vh` নয়, তাই টুলবার ঢুকলে-বেরোলে লাফায় না
- `env(safe-area-inset-*)` — নচ, ডাইনামিক আইল্যান্ড ও হোম ইন্ডিকেটর
- সব ইনপুট **১৬px** (এর নিচে হলে Safari জুম করে) — `sm:` থেকে ছোট করা যায়
- `-webkit-tap-highlight-color: transparent` — ট্যাপে ধূসর ব্লক নেই
- `@media (hover: none)` — টাচ ডিভাইসে স্টিকি হোভার নেই
- `input[type=date/number]` এর সঠিক উচ্চতা ও `appearance`
- `playsInline` ভিডিও — iPhone-এ ফুলস্ক্রিনে লাফায় না

### অ্যাক্সেসিবিলিটি

- সব টাচ টার্গেট **≥44px** (coarse pointer-এ স্বয়ংক্রিয়)
- `:focus-visible` রিং সব ইন্টারঅ্যাকটিভ উপাদানে, কীবোর্ডে পুরো সাইট চালানো যায়
- WCAG AA কনট্রাস্ট (`text-sand-100/55` এর নিচে নামানো হয়নি)
- `prefers-reduced-motion` — অ্যানিমেশন বন্ধ
- লাইভ ভিডিও স্ক্রিনের বাইরে গেলে **স্বয়ংক্রিয় pause** (`IntersectionObserver`)

### PWA ইনস্টল

| প্ল্যাটফর্ম | কীভাবে |
|---|---|
| Android Chrome | "অ্যাপ ইনস্টল করুন" কার্ড (beforeinstallprompt) |
| iPhone Safari | Share → **Add to Home Screen** (নিচের নির্দেশনা কার্ড) |
| ডেস্কটপ Chrome/Edge | ঠিকানা বারে ইনস্টল আইকন |

 আইকন: `/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`
iOS স্প্ল্যাশ: `public/splash/` — পুনরায় বানাতে `node scripts/generate-splash.mjs`

### ধাপ ১৬ — ডিভাইস টেস্ট চেকলিস্ট

ফোনে (Android Chrome + iPhone Safari):
- [ ] হোম, পণ্য, কার্ট, চেকআউট — কোনো অনুভূমিক স্ক্রল নেই
- [ ] ইনপুটে ট্যাপ করলে পেজ **জুম করে না**
- [ ] লগইন ফর্ম টুলবার লুকিয়ে থাকলেও পুরো দেখা যায় (dvh)
- [ ] নিচের বাটনগুলো হোম ইন্ডিকেটরের উপরে আছে
- [ ] লাইভ স্ট্রিম স্ক্রল করে উপরে গেলে থেমে যায়
- [ ] হোম স্ক্রিনে যোগ করার পর স্ট্যান্ডঅ্যালোন মোডে খোলে
- [ ] বিমান মোডে `/offline` পেজ আসে
- [ ] ডার্ক মোডে গ্যালারি/ছবি ঠিক দেখায়

ট্যাব ও ডেস্কটপ:
- [ ] ৭৬৮px ও ১০২৪px-এ কার্ড গ্রিড ভাঙে না
- [ ] কীবোর্ড Tab দিয়ে পুরো ফর্ম পূরণ করা যায়, ফোকাস দেখা যায়
- [ ] Safari (macOS), Firefox, Edge — তিনটিতেই লাইভ ভিডিও চলে

---

## ১৭. এখানেই থামুন — পরের ধাপ

এই ধাপে **A (রিভিউ/অভিযোগ)** এবং **B (ডিভাইস/PWA)** সম্পূর্ণ। পরের বার
**C (পারফরম্যান্স — Lighthouse 90+)** এবং **D (Google SEO)** একসাথে করব।

> ⚠️ **সিদ্ধান্ত দরকার:** আগের নির্দেশ ছিল **Vercel**-এ ডিপ্লয়, কিন্তু নতুন ব্রিফে
> বারবার **Netlify** (`netlify.toml`, Netlify CDN) বলা হয়েছে। আমি আপাতত Vercel
> কনফিগ (`vercel.json` + `next.config.ts` হেডার) ধরে রেখেছি এবং একই হেডার
> `netlify.toml`-এও লিখে রাখব যাতে দুটোই কাজ করে। কোনটি চূড়ান্ত হবে জানালে
> অন্যটি সরিয়ে দেব।

---

## License

Proprietary — © 2026 বিশ্বাস এগ্রো / Biswas Agro. All rights reserved.
