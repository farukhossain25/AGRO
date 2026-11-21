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

স্টোরেজ বাকেট `product-images` (public, 4 MB limit) তৈরি করা আছে।
আপনার শুধু দরকার `.env.local` (বা Vercel env) বসানো — বাকি সব প্রস্তুত।

`supabase/seed.sql` ফাইলে পুরো সিডটা এক ফাইলে আছে — Supabase → SQL Editor-এ পেস্ট করে
যেকোনো সময় পুনরায় চালানো যায় (idempotent)। নতুন করে জেনারেট করতে: `npm run db:seed:sql`।

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
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

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
supabase/migrations/    # 0001_init.sql, 0002_otp.sql
scripts/                # migrate, seed, create-admin
data/seed.mjs           # ৪৭ বাংলা পণ্য + ক্যাটাগরি + কম্বো + কুপন
```

### ডেটা লেয়ার

`lib/data.ts` হলো পেজগুলোর **একমাত্র** ডেটা এন্ট্রি পয়েন্ট। Supabase কনফিগার না থাকলে বা
কোয়েরি ব্যর্থ হলে এটি স্বয়ংক্রিয়ভাবে `lib/seed-data.ts`-এ ফলব্যাক করে — তাই সাইট কখনো
ব্ল্যাংক রেন্ডার হয় না, এবং অ্যাডমিন ড্যাশবোর্ডেও সতর্কবার্তা দেখায়।

---

## ৯. সিকিউরিটি

- পাসওয়ার্ড **bcrypt** (cost 12)
- সেশন **JWT (jose)**, `httpOnly` + `sameSite=lax` + `secure` কুকি
- সব ইনপুট **Zod** দিয়ে ভ্যালিডেট, `sanitizeText` দিয়ে স্যানিটাইজ
- **Rate limiting** — লগইন, OTP, ট্র্যাকিং, কন্টাক্ট, রিভিউ
- Supabase **RLS** — পাবলিক রিড শুধু `is_approved` রিভিউ ও অ্যাক্টিভ কনটেন্টে; সব রাইট service role দিয়ে
- অ্যাডমিন রুট দুই স্তরে সুরক্ষিত: server-side layout guard + প্রতিটি API-তে `requireAdmin()`
- নিরাপত্তা হেডার: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
- `/admin` ও `/account` `robots`-এ `noindex`

---

## ১০. ডিপ্লয়-পরবর্তী চেকলিস্ট

- [ ] `/admin/login` → `admin@bishwasagro.com` দিয়ে লগইন
- [ ] অ্যাডমিন পাসওয়ার্ড বদলানো হয়েছে
- [ ] `npm run db:seed` চালানো হয়েছে — `/products` এ ৪৭ পণ্য দেখা যাচ্ছে
- [ ] একটি টেস্ট অর্ডার (COD) → `/track` এ ট্র্যাকিং কাজ করছে
- [ ] কুপন `BISWAS10` চেকআউটে কাজ করছে
- [ ] অ্যাডমিন `/admin/products` থেকে ছবি আপলোড হচ্ছে (`product-images` বাকেট)
- [ ] `https://bishwasagro.com` এ SSL লক দেখাচ্ছে
- [ ] WhatsApp ফ্লোটিং বাটন সঠিক নম্বরে যাচ্ছে
- [ ] `PAYMENTS_SANDBOX=false` + লাইভ কী (যখন প্রস্তুত)

---

## License

Proprietary — © 2026 বিশ্বাস এগ্রো / Biswas Agro. All rights reserved.
