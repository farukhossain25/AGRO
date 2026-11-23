# Part A অডিট + Part B/C কাজের রিপোর্ট — ২৩ নভেম্বর ২০২৬

> এই ডকুমেন্টে যা আছে: (১) checkout কেন ব্যর্থ হচ্ছিল তার হুবহু কারণ, (২) schema ↔ কোডের
> অমিলগুলোর তালিকা ও কী ঠিক করা হয়েছে, (৩) প্রতিটি অ্যাডমিন সেকশনের PASS/FAIL (আগে → পরে),
> (৪) লাইভ টেস্টের ফল, (৫) যেগুলো আপনার নিজের হাতে করতে হবে।

---

## ১. Checkout বাগের আসল কারণ

ব্রাউজারে দেখানো হচ্ছিল "কার্ট ও পণ্য নেই" / "অর্ডার সম্পন্ন হয়নি"। সেখানে দুটি আলাদা সমস্যা
একসাথে ছিল:

| # | সমস্যা | প্রমাণ | ফল |
|---|--------|--------|-----|
| **B1** | `orders.status`-এর CHECK constraint-এ শুধু `pending, confirmed, packing, shipping, delivered, cancelled` ছিল, কিন্তু কোড `status = 'received'` লেখে (`lib/types.ts` → `OrderStatus = "received" \| ...`) | Supabase-এ টেস্ট insert → **`23514 check_violation`** | **প্রতিটি অর্ডার insert ব্যর্থ** — অর্ডার কখনো তৈরি হয়নি |
| **B2** | একই অমিল `sub_orders` ("received"), `notifications.type` ("status", "product", "camera"), `profiles.role` ("staff", "manager", "premium")-এও ছিল | constraint ডাম্প | সাব-অর্ডার, নোটিফিকেশন আর রোল পরিবর্তনও নীরবে ব্যর্থ হচ্ছিল |
| **B3** | `priceCart()` ব্যর্থ হলে `null` ফিরিয়ে দিত, রুট সেটাকে "কার্ট ও পণ্য নেই" বানিয়ে দেখাত; পুরোনো/stale কার্ট আইডি থাকলে পণ্য খুঁজে না পেয়ে চুপচাপ ফাঁকা হয়ে যেত | কোড রিভিউ | ব্যবহারকারী আসল কারণ জানত না |
| **B4** | `handleError()` শুধু 401/403 আলাদা করত, বাকি সব **জেনেরিক 500** → আসল Postgres বার্তা লগেই যেত না | কোড রিভিউ | "silent failure" — কোনো সূত্র পাওয়া যেত না |
| **B5** | `payment_methods` টেবিলে **০টি রো** | DB কাউন্ট | বিকাশ/নগদ অপশনই দেখা যেত না |

### সমাধান

* `0017_status_vocabulary.sql` — চারটি CHECK constraint-এ দুটো শব্দভাণ্ডারই (`received` + `pending`
  ইত্যাদি) অনুমোদিত করা হয়েছে। **এটিই checkout ঠিক করার মূল ধাপ।**
* `lib/errors.ts` (নতুন) — 42501/42703/PGRST204/23502/23505/23503/23514 + storage bucket/size/mime
  এর জন্য নির্দিষ্ট বাংলা বার্তা। `lib/api.ts` এখন আসল error + details `console.error` করে।
* `priceCart()` নতুন করে লেখা — id → slug → combo-id → combo-slug ফলব্যাক, আর `null` নয়,
  বরং `{ lines, subtotal, unavailable[], adjusted[] }` রিটার্ন করে।
* `POST /api/orders` → **409 `CART_UNAVAILABLE`** + কোন কোন পণ্য কেন সমস্যা (নাম সহ)।
* `components/checkout/checkout-flow.tsx` — লাল ব্যানারে নাম দেখিয়ে "সরিয়ে ফেলুন" বাটন।
* `POST /api/cart/validate` (নতুন) + `lib/cart.tsx`-এ `replaceAll()` → `/cart` খোলার সময় একবার
  সার্ভারে যাচাই করে পুরোনো id/price নিজেই ঠিক করে নেয়।
* `0018` — `payment_methods`-এ বিকাশ/নগদ/ক্যাশ অন ডেলিভারি সিড করা হয়েছে।

---

## ২. Schema ↔ কোড অমিল (Part A-এর টেবিল)

| বিষয় | আগে | অবস্থা |
|------|-----|--------|
| `orders.status` শব্দভাণ্ডার | কোড `received`, DB-তে নেই | ✅ 0017 |
| `sub_orders.status` | কোড `received`, DB-তে নেই | ✅ 0017 |
| `notifications.type` | কোড `status/product/camera`, DB-তে নেই | ✅ 0017 |
| `profiles.role` | কোড `staff/manager/premium`, DB-তে নেই | ✅ 0017 |
| `products.approval_status` | `NULL` → সেলার ভিউয়ের `= 'approved'` ফিল্টারে আমাদের ৪৭টি পণ্যই লুকিয়ে যেত | ✅ 0017 (default + backfill) |
| `orders.sub_no` (সাব-অর্ডার নম্বর) | টেবিলে ছিল না, কোড লিখত | ✅ 0016 |
| `payments.payment_status`, `sub_orders.payment_status` | ছিল না | ✅ 0016 |
| `audit_logs.admin_name` | NOT NULL কিন্তু Audit লগ সবসময় ব্যর্থ | ✅ 0016 (default `''`) + `lib/audit.ts` এখন নাম পাঠায় |
| `notifications.type/title/message` (legacy NOT NULL) | নতুন কোডের insert ব্যর্থ | ✅ 0016 (defaults) + `lib/notify.ts` দুই ডায়ালেক্টেই লেখে |
| `orders.user_id` FK → `profiles(id)` (auth.users নয়) | গেস্ট অর্ডারে `user_id` দিলে FK ভাঙত | ✅ কোডে null রাখা হয়, 0017-এ FK অপরিবর্তিত রেখে ডকুমেন্টেড |
| `cart_items` টেবিল | ছিল না | ✅ 0016 (RLS: নিজের রো) |
| storage buckets `product-images`, `review-photos`, `complaint-photos`, `payment-proofs` | ছিল না | ✅ 0016 + 0018-এ পলিসি |
| `anon` রোলের write অনুমতি (`products`, `categories`, ৩০+ টেবিল) | সবার জন্য খোলা | ✅ 0018 (`revoke insert/update/delete … from anon`) |
| RLS বন্ধ থাকা টেবিল (notifications, order_items, payments, sub_orders, sellers, settings, wishlists, banners, hero_slides, homepage_sections, payment_methods …) | ৩০+ টেবিল RLS OFF | ✅ 0018 (RLS ON + পাবলিক রিড / অ্যাডমিন ALL / নিজের রো) |

---

## ৩. অ্যাডমিন সেকশন — PASS/FAIL (আগে → পরে)

পদ্ধতি: প্রতিটি সেকশনের টেবিল/কলাম/পলিসি live DB-তে যাচাই + API রুটের কোড রিভিউ +
আসল insert/update/delete টেস্ট (service role দিয়ে, তারপর টেস্ট ডেটা মুছে ফেলা হয়েছে)।

| সেকশন | আগে | এখন | ভিত্তি |
|--------|-----|-----|--------|
| পণ্য (products) | ❌ সেভ হলে 500 / approval_status ফিল্টারে হারিয়ে যেত | ✅ | কলাম অ্যালাইন + RLS + আপলোড বাকেট + `23505`/`23514` বাংলা বার্তা |
| ক্যাটাগরি (categories) | ⚠️ লেখা যেত, কিন্তু anon-ও লিখতে পারত | ✅ | anon write বন্ধ, admin policy |
| অর্ডার (orders) | ❌ **ইনসার্টই ব্যর্থ (B1)** | ✅ | 0017 + লাইভ insert টেস্ট: orders/order_items/sub_orders/payments/parcels/notifications/audit_logs — ৬/৬ রো ঠিকভাবে বসেছে |
| পেমেন্ট ভেরিফিকেশন (payments) | ⚠️ RLS OFF, admin read নির্ভর করত service key-এর উপর | ✅ | RLS ON + admin ALL + owner read |
| পেমেন্ট মেথড | ❌ ০টি রো → checkout-এ অপশন নেই | ✅ | ৩টি মেথড সিড (বিকাশ/নগদ/COD) |
| খামার (farms) | ✅ | ✅ | পাবলিক রিড active-only |
| ক্যামেরা (cameras) | ⚠️ RLS OFF | ✅ | RLS ON, admin ALL |
| সেলার (sellers) | ⚠️ RLS OFF | ✅ | RLS ON + পাবলিক রিড + admin ALL |
| ইউজার/রোল | ❌ `staff/manager/premium` সেট করলে CHECK ভাঙত | ✅ | 0017 |
| হিরো স্লাইড | ⚠️ RLS OFF | ✅ | RLS ON + `_public_read` |
| হোমপেজ সেকশন | ⚠️ RLS OFF | ✅ | RLS ON + `_public_read` |
| সাইট সেটিংস | ⚠️ RLS OFF | ✅ | RLS ON, admin ALL |
| সোশ্যাল লিংক | ⚠️ RLS OFF | ✅ | RLS ON + পাবলিক রিড |
| টিম | ✅ | ✅ | `team_directory` পলিসি আগেই ছিল |
| ব্লগ | ✅ | ✅ | published-only পাবলিক রিড |
| কুপন | ⚠️ RLS OFF, পাবলিক রিড `true` | ✅ | RLS ON + পাবলিক রিড + admin ALL |
| ডেলিভারি চার্জ | ⚠️ RLS OFF | ✅ | RLS ON + পাবলিক রিড + admin ALL |
| সাবস্ক্রিপশন/প্ল্যান | ⚠️ RLS OFF | ✅ | RLS ON |
| রিভিউ | ✅ | ✅ | moderation পলিসি আগেই ছিল |
| অভিযোগ (complaints) | ✅ | ✅ | পলিসি আগেই ছিল |
| নোটিফিকেশন | ❌ legacy NOT NULL কলামে insert ব্যর্থ + RLS OFF | ✅ | 0016 defaults + দুই ডায়ালেক্ট + RLS |
| অডিট লগ | ❌ `admin_name` NOT NULL → প্রতিটি অডিট ব্যর্থ | ✅ | 0016 default + `lib/audit.ts` |
| ইমেজ আপলোড | ⚠️ বাকেট ছিল না | ✅ | `product-images` + টাইপ/সাইজ ভ্যালিডেশন + র্যান্ডম ফাইলনেম |
| **সিস্টেম চেক (নতুন)** | ❌ ছিল না | ✅ | `/foisal/system-check` — লাইভ DB read/write, বাকেট, আপলোড round-trip, env নাম |

---

## ৪. যেগুলো নতুন করে বানানো/ঠিক করা হয়েছে (Part B ও D)

**কার্ট (B):** একটাই স্টোর (`lib/cart.tsx`, localStorage + React context) — হেডার ব্যাজ, `/cart`,
`/checkout` সবাই একই স্টোর পড়ে, SSR mismatch নেই (`ready` ফ্ল্যাগ)। নতুন `CartSync`
(`components/cart/cart-sync.tsx`) লগইন করা গ্রাহকের কার্ট `cart_items`-এ মিরর করে — লগইনের সময়
দুটো কার্ট merge হয় (বড় quantity জেতে), পরে প্রতিটি পরিবর্তনে DB আপডেট।

**লগইন (D):** `/login` সম্পূর্ণ নতুন — ডেস্কটপে বাঁ দিকে ব্র্যান্ড প্যানেল (খামারের ছবি, ট্যাগলাইন
"বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে", ৩টি ট্রাস্ট পয়েন্ট: খামার থেকে সরাসরি / লাইভ ক্যামেরায়
যাচাই / নিরাপদ পেমেন্ট, ধীর animated gradient), ডান দিকে ফর্ম কার্ড; মোবাইলে এক কলাম, ইনপুট ১৬px,
বাটন ৪৮–৫০px, safe-area padding। ফর্মে: floating label, আইকন, পাসওয়ার্ড show/hide, সাইনআপে
strength meter, "Continue with Google" সবার আগে + "অথবা" বিভাজক, remember-me, শর্তাবলী চেকবক্স,
loading spinner, নির্দিষ্ট বাংলা error + পরের ধাপের বাটন, resend verification। নতুন `/foisal/login`
একই কোয়ালিটি, "Secure admin" ব্যাজ, Google বন্ধ। `/reset-password`-ও একই ব্র্যান্ড শেল-এ।

**CSP (E):** third-party image host (unsplash/pravatar) বাদ, Supabase host + Google avatar রাখা,
`manifest-src 'self'`, Permissions-Policy-তে শুধু ব্রাউজার-স্বীকৃত ফিচার (`camera=(self)`,
`microphone=()`, `geolocation=(self)`, `fullscreen=(self)`)।

---

## ৫. লাইভ টেস্টের ফল

| টেস্ট | ফল |
|-------|-----|
| Vercel production deploy (6afa243) | ✅ READY |
| হোমপেজ — পণ্য/কম্বো/ক্যাটাগরি/খামার/ক্যামেরা সব রেন্ডার (RLS চালু করার পরেও) | ✅ |
| `/login` নতুন ডিজাইন, Google আগে, remember-me | ✅ |
| `/foisal/login` — অ্যাডমিন লগইন, Google ছাড়া | ✅ |
| `/cart` রেন্ডার | ✅ |
| গেস্ট `/checkout` → `/login?next=/checkout` | ✅ (লগইন বাধ্যতামূলক — নিচে দেখুন) |
| DB write path: order + order_item + notification + audit + parcel + payment একসাথে | ✅ ৬/৬ |
| টেস্ট ডেটা পরিষ্কার + `palong-shak` স্টক ৭৭৭ → **১২০** ফেরত | ✅ |
| অর্ডার/পেমেন্টে অবশিষ্ট টেস্ট রো | ০ |
| `tsc --noEmit` | ✅ ০ error |
| `next build` | ✅ সফল |

**যা আমি নিজে করতে পারিনি:** ব্রাউজারে অ্যাডমিন হিসেবে লগইন করে ক্লিক-থ্রু (পাসওয়ার্ড আমার কাছে নেই), Google OAuth-এর আসল রাউন্ড-ট্রিপ, আর ইমেইল ইনবক্স দেখা। এগুলোর জন্য কী করতে হবে নিচে।

---

## ৬. আপনার নিজের হাতে যা করতে হবে

1. **বিকাশ/নগদের আসল নম্বর বসান** — এখন ডেমো নম্বর `01700000000` সিড করা আছে।
   `/foisal/payment-methods` → বিকাশ/নগদ → `account_number` বদলে সেভ করুন। (এটি না করলে গ্রাহক
   ভুল নম্বরে টাকা পাঠাবে।)
2. **অ্যাডমিন হিসেবে একবার লগইন করে দেখুন** — `/foisal/login` → তারপর বাঁ মেনুতে
   **"সিস্টেম চেক"** → সব সবুজ হওয়া উচিত। কোনো লাল থাকলে স্ক্রিনশটের লেখাটাই আসল কারণ।
3. **Google OAuth** — Google Cloud Console → OAuth client-এ Authorized redirect URI-তে
   `https://izemauiuyqcdawijoloh.supabase.co/auth/v1/callback` যোগ করুন; Supabase →
   Authentication → Providers → Google-এ Client ID/Secret বসান (আমি সিক্রেট দেখতে/লিখতে পারি না)।
4. **ইমেইল টেমপ্লেট** (বাংলা ব্র্যান্ডেড) — Supabase → Authentication → Email Templates-এ কপি
   করে বসাতে হবে; API দিয়ে এডিট করার সুযোগ নেই।
5. **গেস্ট চেকআউট** — এখন লগইন বাধ্যতামূলক (ব্রিফে দুটোর যেকোনো একটি অনুমোদিত ছিল;
   `orders.user_id → profiles(id)` FK থাকায় লগইন-রিকোয়ার্ড পথটাই বেছে নেওয়া হয়েছে)।
   চাইলে পরের ধাপে guest checkout যোগ করা যায়।
6. **ইমেইল যাচাই** — Supabase-এর বিল্ট-ইন SMTP ঘণ্টায় মাত্র ২টি মেইল পাঠায়; প্রোডাকশনে
   Resend/SendGrid যোগ করলে "rate limit exceeded" বার্তা আর আসবে না।
