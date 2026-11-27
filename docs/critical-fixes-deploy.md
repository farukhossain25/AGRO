# ক্রিটিক্যাল ফিক্স — ডিপ্লয় গাইড

তিনটা সমস্যা, তিনটাই আসল ছিল। নিচে কী বদলেছে, কীভাবে চালাবেন, আর কিছু ভাঙলে
কীভাবে ফিরবেন।

---

## ১. সংক্ষেপে

| # | সমস্যা | আগে | এখন |
|---|---|---|---|
| ১ | **CCTV সেগমেন্ট** | শুধু `.m3u8` টোকেন যাচাই করত। `.ts` সেগমেন্ট, LL-HLS পার্ট, WebRTC — টোকেন ছাড়াই চলত। একটা প্লেলিস্ট সেভ করে রাখলে সেই ভিডিও চিরকাল দেখা যেত। | প্রতিটা বাইট পথ (প্লেলিস্ট, সেগমেন্ট, পার্ট, key, signalling) `forward_auth` দিয়ে যাচাই হয়। টোকেন ছাড়া সব 401। |
| ২ | **অর্ডার DELETE** | স্টক আর কুপন ফেরত দিত, **ওয়ালেট দিত না**। `wallet_used` দিয়ে কেনা অর্ডার মুছলে গ্রাহকের টাকা চিরতরে হারিয়ে যেত — লেজারের সারিটাও `order_id = null` হয়ে প্রমাণ মুছে যেত। | একই ট্রানজেকশনে লেজার দেখে ঠিক ততটুকু ফেরত দেয় যতটা সত্যিই কাটা হয়েছিল। টাকা নেওয়া হয়ে থাকলে মোছাই যায় না। |
| ৩ | **অর্ডার বাতিল** | ৬-৭টা আলাদা HTTP রিকোয়েস্ট। মাঝখানে ফেল করলে অর্ডার বাতিল কিন্তু স্টক/ওয়ালেট আটকে যেত। স্টক read-modify-write ছিল → একসাথে দুই বাতিলে স্টক ভুল হতো। | `order_cancel()` — একটাই locked ট্রানজেকশন, idempotent, ডেলিভারি হওয়া অর্ডার বাতিল করে না। |

---

## ১ক. দ্বিতীয় রাউন্ড — পেমেন্ট ও ট্র্যাকিং (৩১)

| # | সমস্যা | আগে | এখন |
|---|---|---|---|
| ৪ | পেমেন্ট claim | TrxID claim আর অর্ডারে `payment_ref` লেখা — দুটো আলাদা রিকোয়েস্ট। মাঝখানে ফেল করলে TrxID "ব্যবহৃত" হয়ে পড়ে থাকত, অথচ কোনো অর্ডারে নেই। গ্রাহক আবার চেষ্টা করলে বলা হতো "এই TrxID আগেই ব্যবহার হয়েছে" — নিজেরই দেওয়া TrxID-তে। | `payment_submit()` — এক ট্রানজেকশনে claim + write। কোনো ধাপ ফেল করলে claim-ও rollback। |
| ৫ | অর্ডার ট্র্যাকিং | `select("*")` — গ্রাহকের ইমেইল, পুরো ফোন, profile UUID, TrxID, ওয়ালেট, সম্পূর্ণ ঠিকানা, অ্যাডমিন নোট সব ফেরত যেত। | নির্দিষ্ট কলাম, ফোন মাস্ক করা, ঠিকানা বাদ। |
| ৬ | স্ক্যানার | `onlyInComment` নামের undeclared ভেরিয়েবল — `/svg/` ম্যাচ হলে আর চলতই না, তাই কোনোদিন ধরা পড়েনি। | কমেন্ট ছাড়িয়ে JSX ব্যবহার আলাদা করে, লাইন নম্বরসহ। |
| ৭ | CCTV টোকেন | প্রক্সি মোড `X-Stream-Token` পাঠাত, কিন্তু অ্যাপ শুধু URL পড়ত়ত → প্রতিটা প্রক্সি সেগমেন্ট 401। | হেডারও পড়ে; খালি হেডার "নেই" হিসেবে ধরা হয়। |
| ৮ | ক্যামেরা key | `key && db.key && key !== db.key` — যেকোনো একটা খালি/null হলে চেকটা **বাদ পড়ত**। | fail-closed: key না মিললে বা কনফিগার না থাকলে সব বন্ধ। |
| ৯ | viewer slot | `stream_key` যাচাই হতো slot নেওয়ার **পরে**; 503 ফিরিয়ে slot ছাড়া হতো না → ক্যাপ ফুরিয়ে যেত। | slot নেওয়ার আগে যাচাই, আর পরের যেকোনো ব্যর্থতায় release। |

## ২. চালানোর আগে — ব্যাকআপ (আবশ্যক)

```sql
-- Supabase Dashboard → SQL Editor → New query
-- Supabase-এর নিজস্ব ডেইলি ব্যাকআপ থাকলেও, এই দুই টেবিলের স্ন্যাপশট রাখুন:
create table if not exists public._backup_orders_2026 as
  select * from public.orders;
create table if not exists public._backup_wallet_tx_2026 as
  select * from public.wallet_transactions;

select count(*) as orders from public._backup_orders_2026;
select count(*) as wallet_rows from public._backup_wallet_tx_2026;
```

সংখ্যা দুটো লিখে রাখুন। ফেরানোর সময় এটাই মিলিয়ে দেখবেন।

**Database → Backups** থেকেও একটা ম্যানুয়াল ব্যাকআপ নামিয়ে রাখুন।
`30_critical_fixes.sql` কোনো সারি মোছে না বা বদলায় না — কিন্তু টাকার টেবিলে
কাজ করার আগে ব্যাকআপ ফেলে রাখা কখনো ভুল নয়।

---

## ৩. মাইগ্রেশন চালানোর ক্রম

```
29_security_hardening.sql            (আগেই চালানো থাকলে বাদ)
30_critical_fixes.sql                ← অর্ডার বাতিল/রিফান্ড (আগের কাজ)
31_security_reliability_fixes.sql    ← পেমেন্ট atomicity (নতুন)
32_team_permission_console.sql       (আগে 30 নামে ছিল — দ্বিতীয়বার নাম বদল)
13_verify_setup.sql                  (যাচাই)
```

> ### ⚠️ নাম দুবার বদলেছে — টেবিল/ফাংশন একই
> আগের `30_team_permission_console.sql` যদি **ইতিমধ্যে চালিয়ে ফেলেছেন**, কিছু
> করতে হবে না — ফাইলটার নাম এখন `32_team_permission_console.sql`, কিন্তু
> ভিতরের টেবিল (`permission_catalog`, `role_permissions`) একই। প্যানেলে কিছু
> ভাঙবে না।
>
> `31_security_reliability_fixes.sql` চালাতে ভুলবেন না — এটা ছাড়া পেমেন্ট জমা
> দেওয়ার সময় TrxID থেকে যাওয়ার সমস্যাটা থাকবে (৩ নম্বর অংশ দেখুন)।

`30_critical_fixes.sql` শেষে এই তিনটা ফাংশন তৈরি/আপডেট হয়:

| ফাংশন | কাজ |
|---|---|
| `order_release_order(order, actor)` | স্টক + কুপন + ওয়ালেট + sub_orders ফেরত — আসল হিসাব |
| `order_cancel(order, reason, actor)` | অবস্থা যাচাই + `order_release_order` + `payment_status = 'refunded'` |
| `order_delete(order, actor)` | একই ফেরত + সারি মুছে ফেলা + অডিট (ট্রানজেকশনের ভিতরে) |

---

## ৪. যাচাইয়ের কুয়েরি

```sql
-- ১. ফাংশন তিনটা আছে, আর শুধু সার্ভার ডাকতে পারে?
select p.proname,
       has_function_privilege('anon',   p.oid, 'execute') as anon_ok,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_ok,
       has_function_privilege('service_role',  p.oid, 'execute') as svc_ok
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('order_release_order','order_cancel','order_delete');
-- আশা: তিনটা সারিতেই anon_ok = false, auth_ok = false, svc_ok = true

-- ২. আগের ডুপ্লিকেট লেজার আছে কি? (থাকলে ৩০ চলত না — তবু দেখে রাখুন)
select order_id, kind, count(*)
  from public.wallet_transactions
 where order_id is not null and kind in ('order','refund')
 group by 1,2 having count(*) > 1;

-- ৩. যে অর্ডারে ওয়ালেট কাটা হয়েছিল, সেটা ঠিক আছে কি?
--    (একটা অর্ডার আইডি বসান)
select kind, amount, balance_after, created_at
  from public.wallet_transactions
 where order_id = '<order-uuid>'
 order by created_at;
```

---

## ৫. CCTV — এজ আপডেট (আবশ্যক)

**কোড ডিপ্লয় করলেই হবে না।** VPS-এর Caddyfile দুটো বদলাতে হবে, নইলে এজ এখনো
টোকেন ছাড়া সেগমেন্ট দেবে (অ্যাপের দিকের গেট শুধু অ্যাপের ভিতরের পথ বাঁচায়)।

```bash
# VPS-এ
cd /path/to/AGRO
git pull
docker compose -f docker-compose.stream-vps.yml --profile public restart caddy caddy-proxy
# (দুটো সার্ভিসই যদি একই compose ফাইলে থাকে)
```

তারপর ব্রাউজারে ক্যামেরা খুলে দেখুন:

1. ভিডিও চলছে ✅
2. DevTools → Network → একটা `.ts` বা `.m4s` রিকোয়েস্ট খুলুন → **URL-এ `?t=` আছে** ✅
3. সেই URL থেকে `?t=...` মুছে নতুন ট্যাবে খুলুন → **401** ✅ (এটাই আসল পরীক্ষা)
4. টোকেন রেখে URL-এর `<key>` বদলে অন্য ক্যামেরার key বসান → **403 `key`** ✅

৪ নম্বরটা না হলে এজ পুরোনো আছে — `Caddyfile` নিশ্চিত করুন।

> **এজ আপডেট করতে না পারলে:** Vercel-এ `STREAM_EDGE_AUTHORIZES_ALL=0` দিন।
> তখন সব ভিডিও অ্যাডমিন-সার্ভার হয়ে যাবে (ব্যান্ডউইথ বেশি লাগবে, কিন্তু
> প্রতিটা সেগমেন্ট যাচাই হবে)। পুরোনো এজ চালু রেখে ডিরেক্ট-মোড চালাবেন না —
> সেটাই ছিল আসল ফাঁক।

---

## ৬. নতুন env variable

| নাম | দরকার | মানে |
|---|---|---|
| `STREAM_EDGE_AUTHORIZES_ALL` | ঐচ্ছিক | `0` দিলে ডিরেক্ট-ভিডিও বন্ধ, সব Vercel প্রক্সি দিয়ে যাবে |

আর কিছু লাগবে না। `STREAM_TOKEN_SECRET`, `STREAM_PUBLIC_BASE`,
`STREAM_PROXY_SECRET` — আগের মতোই থাকুক।

---

## ৭. বাতিল/মোছা — হাতে পরীক্ষা

একটা **টেস্ট অর্ডার** বানান (গ্রাহক অ্যাকাউন্ট, ওয়ালেট দিয়ে কিছু টাকা, একটা
কুপন), তারপর:

1. অ্যাডমিন প্যানেল → অর্ডার → **বাতিল**
2. অ্যাডমিন প্যানেল → গ্রাহকের ওয়ালেট — **টাকা ফিরে এসেছে** ✅
3. একই অর্ডার আবার বাতিল → "ইতিমধ্যে বাতিল" ✅ (দুবার টাকা আসবে না)
4. আরেকটা টেস্ট অর্ডার → **মুছুন** → ওয়ালেটও ফিরেছে ✅
5. একটা **ডেলিভারি হওয়া** অর্ডার মুছতে চেষ্টা করুন → ৪০৯ "ডেলিভারি হয়ে যাওয়া
   অর্ডার মোছা যায় না" ✅

---

## ৮. Vercel ডিপ্লয়

```bash
# PR merge হলে অটো, নাহলে:
vercel --prod
```

ক্রম: **৩ — SQL আগে → ৫ — এজ → ৮ — Vercel**। কোড আগে গেলে পুরোনো ফাংশন না
থাকায় অর্ডার বাতিল/মোছা ৫০০ দেবে (স্টক/ওয়ালেট কিছুই ভাঙবে না, শুধু কাজ হবে না)।

---

## ৯. ফেরানো (rollback)

### কোড
`git revert <merge-commit>` → push → Vercel নিজেই ডিপ্লয় করবে।

### SQL (কোনো ডেটা হারায় না)

```sql
drop function if exists public.order_delete(uuid, uuid);
drop function if exists public.order_cancel(uuid, text, uuid);
drop function if exists public.order_release_order(uuid, uuid);
```

এরপর অ্যাডমিন প্যানেল আবার আগের পথে বাতিল করবে — স্টক আর কুপন ফেরত দেবে,
**কিন্তু ওয়ালেট রিফান্ড দেবে না**। তাই ৩০ না চালানো অবস্থায় ওয়ালেট দিয়ে কেনা
অর্ডার **মুছবেন না**; বাতিল করুন (এখনই যা হয়), টাকা হাতে ফেরত দিন।

### এজ
`git revert` করে ৫ নম্বর ধাপ আবার চালান। (কেন ফেরাবেন, ভালো করে ভাবুন — পুরোনো
Caddyfile মানে টোকেন ছাড়া সেগমেন্ট।)

### ব্যাকআপ থেকে
শুধু তখনই, যখন কিছু সত্যিই ভেঙে গেছে:

```sql
-- সাবধান: এর পর নতুন অর্ডার/লেনদেন হারিয়ে যাবে
delete from public.orders;
insert into public.orders select * from public._backup_orders_2026;
```

---

## ১০. যা এখনো বাকি (সচেতন সিদ্ধান্ত)

- **টাকা ফেরত দেওয়া নিজে থেকে হয় না।** গ্রাহক bKash-এ টাকা দিয়ে অর্ডার
  বাতিল করলে `payment_status` এখন `refunded` হয় — অর্থাৎ *ফেরত দেওয়ার দরকার*
  স্পষ্ট দেখা যায়। কিন্তু bKash থেকে টাকা ফেরত পাঠানোটা এখনো হাতে করতে হবে
  (কোনো গেটওয়ে রিফান্ড API লাগানো নেই)।
- **ডেলিভারি হওয়া অর্ডার বাতিল/মুছা যায় না** — এটা ইচ্ছাকৃত। বিক্রি ফেরাতে
  চাইলে আলাদা "রিটার্ন" প্রক্রিয়া লাগবে; সেটা এখনো নেই।
- **Caddy-র `rate_limit`** একটা থার্ড-পার্টি প্লাগইন, স্টক `caddy:2-alpine`-এ
  নেই। তাই ভলিউম কন্ট্রোল অ্যাপের দিকে (`/api/stream/token` rate limit +
  `stream_reserve_slot` viewer cap)।
- **পুরোনো অভিযোগের ছবি** (২৯-এর আগে আপলোড হওয়া) এখনো পাবলিক — rev-16-এর
  F1।

---

## ১১. কী কী ফাইল বদলেছে

**SQL**
- `supabase/sql/30_critical_fixes.sql` — নতুন (তিনটা ফাংশন)
- `supabase/sql/32_team_permission_console.sql` — নাম বদলেছে (আগে ৩০, তারপর ৩১)
- `supabase/sql/31_security_reliability_fixes.sql` — নতুন: `payment_submit()`

**অ্যাপ**
- `lib/orders.ts` — `applyOrderCancellation` সরানো; `cancelOrder()`,
  `deleteOrder()`, `announceCancellation()`
- `app/api/foisal/orders/route.ts` — PATCH (cancel) আর DELETE দুটোই RPC দিয়ে
- `app/api/stream/auth/route.ts` — সেগমেন্ট/পার্টও যাচাই, প্যারামিটার টালমাটাল
  `?path=` আর `?t=` দুই জায়গা থেকেই পড়ে
- `app/api/stream/[...path]/route.ts` — টোকেন `X-Stream-Token` হেডারে এজে পাঠায়
- `app/api/cam/live/[...path]/route.ts` — ক্লাউড ক্যামেরাতেও সেশন-রো যাচাই
  (revoked সেশন এখন সাথে সাথে বন্ধ)
- `lib/streams.ts` — `directVideoEnabled()` + `STREAM_EDGE_AUTHORIZES_ALL`
- `Caddyfile`, `Caddyfile.proxy` — সব বাইট পথে `forward_auth`

**টেস্ট**
- `scripts/test-order-money.mjs` — নতুন, ৫০ চেক (টাকা/স্টক/কুপন/রেস/অনুমতি)
- `scripts/test-stream-auth.mjs` — নতুন, ৩৮ চেক (টোকেন, টেম্পারিং, মেয়াদ,
  ক্যামেরা-আইসোলেশন, পথ পার্সিং)
- `scripts/check-stream-edge.mjs` — নতুন, Caddyfile দুইটা পার্স করে গেট ছাড়া
  কোনো `reverse_proxy` থাকলে ফেল করে
- `scripts/lib/stream-paths.mjs` — নতুন, রুটের পার্সার টেস্টেবল
