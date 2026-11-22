# নিরাপত্তা অডিট — বিশ্বাস এগ্রো

**তারিখ:** ২১ নভেম্বর ২০২৬
**স্কোপ:** `arena/14d1ba81-agro` ব্রাঞ্চের সম্পূর্ণ কোডবেস + লাইভ Supabase প্রজেক্ট (`lyihdzgmtjkkhybpkqot`)
**পদ্ধতি:** ম্যানুয়াল কোড রিভিউ, `scripts/security-scan.mjs`, লাইভ RLS/গ্রান্ট ইন্সপেকশন, অ্যাডভার্সারি থিংকিং (আক্রমণকারীর চোখে)

---

## সারসংক্ষেপ

| 심 심각도 | সংখ্যা | অবস্থা |
|---|---|---|
| 🔴 ক্রিটিক্যাল | ৩ | ✅ ঠিক করা হয়েছে |
| 🟠 উচ্চ | ৪ | ✅ ঠিক করা হয়েছে |
| 🟡 মধ্যম | ৫ | ✅ ঠিক করা হয়েছে |
| 🔵 তথ্যমূলক / সুপারিশ | ৬ | 📋 নিচে তালিকাভুক্ত |

**সবচেয়ে গুরুত্বপূর্ণ:** একটি **প্রিভিলেজ এস্কেলেশন** পাওয়া গেছে যেখানে যেকোনো লগইন করা গ্রাহক একটি REST কল দিয়ে নিজেকে `admin` বানাতে পারতেন — শুধু পাবলিক anon key দিয়ে। এটি এখন বন্ধ।

---

## 🔴 ক্রিটিক্যাল

### C-1 · যেকোনো গ্রাহক নিজেকে অ্যাডমিন বানাতে পারতেন

**যেখানে:** `users_update_own` ও `profiles_update_own` RLS পলিসি (মাইগ্রেশন 0004)

```sql
create policy users_update_own on users
  for update using (id = app_user_id())
  with check (id = app_user_id());
```

**সমস্যা:** পলিসিটি শুধু বলত "এই সারিটি আপনার"। কোন **কলাম** বদলানো যাবে তা নিয়ন্ত্রণ করত না, আর `anon`/`authenticated` রোলে টেবিলের **সব** কলামে UPDATE গ্রান্ট ছিল। ফলে:

```bash
# যেকোনো লগইন করা গ্রাহক, শুধু পাবলিক anon key দিয়ে
curl -X PATCH "https://lyihdzgmtjkkhybpkqot.supabase.co/rest/v1/users?id=eq.<নিজের আইডি>" \
  -H "apikey: <anon>" -H "Authorization: Bearer <নিজের access token>" \
  -d '{"role":"admin"}'
```

**প্রভাব:** সম্পূর্ণ অ্যাকাউন্ট টেকওভার — সব অর্ডার, গ্রাহকের ফোন/ঠিকানা, পেমেন্ট রেফারেন্স, টিম ম্যানেজমেন্ট, কনটেন্ট। একইভাবে `profiles.role` ও `is_active`, `premium_until`, `password_hash`।

**সমাধান (মাইগ্রেশন 0008):** টেবিল-লেভেল UPDATE বাতিল করে কলাম-লেভেল গ্রান্ট দেওয়া হয়েছে:

```sql
revoke update on public.users from anon, authenticated;
grant update (name, email, phone, avatar, locale) on public.users to authenticated;
```

`profiles`-এ শুধু `full_name, phone, avatar_url, bio, language, theme, notifications, onboarded, last_seen_at`। `role`, `is_active`, `premium_until`, `password_hash`, `mfa_enrolled` এখন ক্লায়েন্টের জন্য সম্পূর্ণ অলেখনীয়; সার্ভার (service role) অপরিবর্তিত।

**ভেরিফিকেশন:** `information_schema.column_privileges`-এ এখন `users`-এ শুধু ৫টি, `profiles`-এ ৯টি কলাম লেখনীয়।

---

### C-2 · পেমেন্ট সিমুলেটর অনুমতি ছাড়াই অর্ডার "পরিশোধিত" করত

**যেখানে:** `app/api/payments/simulate/route.ts`

**সমস্যা:** এন্ডপয়েন্টটি শুধু একটি অর্ডার নম্বর নিত এবং সেটিকে `payment_status: "paid"` করে দিত — **কোনো সেশন চেক ছাড়াই**। শুধু একমাত্র রক্ষা ছিল `PAYMENTS_SANDBOX !== "false"`, আর `.env.example`-এ ডিফল্ট মান খালি — অর্থাৎ যে ডিপ্লয়মেন্টে এটি স্পষ্টভাবে `false` করা হয়নি, সেখানে অর্ডার নম্বর জানা বা অনুমান করা যে কেউ বিনামূল্যে পণ্য নিতে পারত।

**সমাধান:** এখন দুটোই লাগে — (১) স্যান্ডবক্স মোড চালু, (২) সেশন থাকতে হবে এবং অর্ডারটি নিজের হতে হবে (অথবা স্টাফ হতে হবে)। প্রতিটি প্রয়াস `audit_logs`-এ লেখা হয়।

---

### C-3 · গেটওয়ে সেশন খুললে অন্যের গ্রাহকের ঠিকানা/ফোন ফাঁস হতো

**যেখানে:** `app/api/payments/initiate/route.ts`

**সমস্যা:** অর্ডার নম্বর দিয়ে গেটওয়ে init করা যেত, আর সেই কলের ভেতরে `customer_name`, `phone`, `address` গেটওয়েতে পাঠানো হতো। অনুমানযোগ্য অর্ডার নম্বর দিয়ে যে কেউ ভুক্তভোগীর ঠিকানা/ফোন যাচাই করে নিতে পারত (এবং সেশন হাইজ্যাকের সুযোগ তৈরি হতো)।

**সমাধান:** `order.user_id` থাকলে সেশন মালিককেই হতে হবে; গেস্ট অর্ডার (user_id = null) আগের মতোই খোলা, যাতে অ্যাকাউন্ট ছাড়া চেকআউট ভাঙে না।

---

## 🟠 উচ্চ

### H-1 · স্টাফ রোল RLS-এ কখনো কাজ করত না

`is_staff()` (মাইগ্রেশন 0007) তুলনা করত `users.id = auth.uid()`। কিন্তু `auth.uid()` হলো **`profiles.id`**, `users.id` নয়। ফলে CMS, FAQ, media, audit_log-এর সব নতুন পলিসি প্রতিটি স্টাফের জন্য নীরবে "না" বলত — এবং শুধু ad-hoc `v_seller_leaderboard`-এর মতো জায়গায় ভুল ফল দিত।

**সমাধান:** `profiles` পড়তে সমন্বয় করা হয়েছে (`is_admin()` যেভাবেই করে)।

### H-2 · রিভিউ লেখক নিজের রিভিউ মডারেট করতে পারতেন

`order_reviews_own_update`-এ `status`, `is_verified_purchase`, `seller_rating`, `hidden_*`, `seller_reply` — এই কলামগুলোও লেখনীয় ছিল। একজন গ্রাহক নিজের লুকানো রিভিউ `published` করে দিতে বা "verified purchase" ফলস্বরূপ সেট করতে পারতেন।

**সমাধান:** UPDATE বাতিল করে শুধু `rating, title_bn, comment, photos, tags, edited_at`-এ গ্রান্ট।

### H-3 · অপ্রকাশিত ড্রাফট ও নিষ্ক্রিয় পণ্য সর্বজনীন পঠনযোগ্য ছিল

`blog_posts_public_read` ও `products_public_read` ছিল `using (true)` — অর্থাৎ অ্যাডমিন ড্রাফট ব্লগ পোস্ট, নিষ্ক্রিয় পণ্য এবং সেলারের `commission_percent` পর্যন্ত anon key দিয়ে পড়া যেত।

**সমাধান:** `using (is_active or is_staff())` — ড্রাফট এখন শুধু স্টাফের জন্য।

### H-4 · অ্যাড্রেসের মালিকানা বদলানো যেত

`addresses_own` (`ALL`, `user_id = app_user_id()`) — `user_id` কলাম লেখনীয় থাকায় একটি অ্যাড্রেস অন্যের নামে সরানো যেত, এবং `is_default` দিয়ে অন্যের ডিফল্ট ঠিকানা হিসাবেও বসানো যেত।

**সমাধান:** UPDATE/INSERT কলাম-লিস্ট নির্দিষ্ট করা হয়েছে (`user_id` বাদ)।

---

## 🟡 মধ্যম

| # | সমস্যা | সমাধান |
|---|---|---|
| M-1 | `audit_logs` / `audit_log`-এ cld UPDATE/DELETE গ্রান্ট ছিল — তত্ত্বগতভাবে ইতিহাস পুনর্লিখন সম্ভব | `revoke update, delete`; টেবিল এখন append-only |
| M-2 | `settings` টেবিল ক্লায়েন্টের জন্য লেখনীয় ছিল (ডেলিভারি চার্জ, ট্রায়াল সময়) | `revoke insert, update, delete` |
| M-3 | `users`, `profiles`-এ TRUNCATE ও DELETE গ্রান্ট | `revoke truncate, delete` |
| M-4 | ১৬টি গুরুত্বপূর্ণ টেবিল (`login_attempts`, `otp_codes`, `admin_mfa`, `premium_access_codes`, `stream_sessions`, `seller_payouts`…) —রলস ০ ছিল কিন্তু টেবিল-গ্রান্ট বাকি ছিল | `revoke all from anon, authenticated` |
| M-5 | ১২টি মিউটেশন এন্ডপয়েন্টে কোনো রেট লিমিট ছিল না | `limitGuard` যোগ (৩০/মিনিট) |

---

## 🔵 তথ্যমূলক / চলমান সুপারিশ

1. **CSP ননস (চালু করা হয়েছে, ভেরিফায়েড)** — `middleware.ts` এখন প্রতি রিকোয়েস্টে ১৬-বাইট ননস তৈরি করে; `script-src`-এ `'unsafe-inline'` নেই। পরীক্ষায় হেডার ও প্রতিটি স্ক্রিপ্ট ট্যাগে ননস মিলেছে। `style-src`-এ `'unsafe-inline'` রাখা হয়েছে (Next/Tailwind ইনলাইন স্টাইল অ্যাট্রিবিউট ব্যবহার করে; ননস সেখানে প্রযোজ্য নয়)।
2. **রেট লিমিটার ইন-মেমোরি** — প্রতি ইনস্ট্যান্সে আলাদা। মাল্টি-রিজিয়নে আপস্ট্রিম Redis (Upstash) দরকার; একই ফাংশন সিগনেচার রাখা হয়েছে যাতে শুধু `Map` বদলালেই হয়।
3. **Google OAuth বন্ধ** — `external_google_enabled: false`, টোকেন সিক্রেট Missing। চালু করার সময় `NEXT_PUBLIC_*` নয়, Vercel-এর sealed env ব্যবহার করবেন।
4. **`audit_log_disable_postgres: true`** — Supabase-এর নিজের pgAudit বন্ধ। আমাদের `audit_logs` আলাদা, তবে DB-লেভেল ফরেনসিক চাইলে এটি চালু করা যায়।
5. **স্টোরেজ বাকেটের পলিসি** — `product-images` ইত্যাদি পাবলিক-রিড; লিখন শুধু service role থেকে। নতুন বাকেট যোগ করলে `0008`-এর revoke প্যাটার্ন ফলো করবেন।
6. **Lighthouse স্কোর** — বাজেট ও বিল্ড সবুজ, কিন্তু এই স্যান্ডবক্সে Chrome নেই বলে আসল Lighthouse রান এখনো নেওয়া হয়নি। আপনার মেশিনে `npm run lighthouse`।

---

## প্রতিরক্ষা-স্তর (যা এখন আছে)

| স্তর | কীভাবে |
|---|---|
| **এজ** | `middleware.ts` — `/admin` গেট + প্রতি-রিকোয়েস্ট CSP ননস |
| **রুট** | ৫৮টি API রুট, প্রতিটিতে সেশন/পারমিশন/টোকেন চেক (`requirePermission`) |
| **পারমিশন** | `lib/permissions.ts` — ৩৭টি স্কোপড পারমিশন, র্যাঙ্ক-তুলনা, নিজের রোল বদলানো নিষিদ্ধ |
| **ভ্যালিডেশন** | প্রতিটি মিউটেটিং রুটে Zod স্কিমা |
| **ডেটাবেস** | RLS ৫৩টি টেবিলে; কলাম-লেভেল গ্রান্ট; append-only অডিট |
| **ফাইল** | MIME allow-list + magic-byte sniff + র‍্যান্ডম ফাইলনেম |
| **গোপন তথ্য** | service role শুধু সার্ভারে; `NEXT_PUBLIC_`-এ কোনো সিক্রেট নেই (স্ক্যানার যাচাই করে) |
| **কুকি** | httpOnly + SameSite=Lax + Secure (prod-এ) |

## CI গেট

```bash
npm run verify     # typecheck + security scan + bundle budget
```

`scripts/security-scan.mjs` ৮টি নিয়মে স্ক্যান করে (আনগার্ডেড মিউটেটিং রুট, ক্লায়েন্টে service role, `NEXT_PUBLIC_` সিক্রেট, CSP-তে `unsafe-inline`, র-ইননারHTML, ফেচ টাইমআউট, কমিটেড `.env`, কুকি ফ্ল্যাগ)। এখন ফলাফল: **০ এরর, ০ ওয়ার্নিং**।

---

## ঠিক করার আগে/পরে

| যাচাই | আগে | পরে |
|---|---|---|
| `users`-এ ক্লায়েন্টের লেখনীয় কলাম | ১৪ (role সহ) | ৫ |
| `profiles`-এ লেখনীয় কলাম | ১৫ (role সহ) | ৯ |
| `order_reviews`-এ লেখনীয় কলাম | ২৯ | ৬ |
| `settings` লেখনীয় | হ্যাঁ | না |
| `audit_logs` পুনর্লিখনযোগ্য | হ্যাঁ | না |
| `is_staff()` সঠিক টেবিল পড়ে | না | হ্যাঁ |
| পেমেন্ট সিমুলেটরে সেশন লাগে | না | হ্যাঁ |
| CSP `script-src 'unsafe-inline'` | হ্যাঁ | না (ননস) |
