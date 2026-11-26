# rev 16 — চালানোর নির্দেশিকা (SQL + config + deploy)

সব কিছু কোডে হয়ে গেছে। নিচের ধাপগুলো **আপনার** হাতে — প্রোডাকশন ডেটাবেসে বা
Vercel-এ আমি কিছু চালাইনি (§10)।

---

## ১. কোন SQL চালাতে হবে

**দুটো ফাইল, এই ক্রমে:**

```
supabase/sql/29_security_hardening.sql      ← সিকিউরিটি হার্ডেনিং
supabase/sql/30_team_permission_console.sql ← প্যানেল অ্যাক্সেস কনসোল
```

> **30 কেন আলাদা:** ২৯ সিকিউরিটি, ৩০ ফিচার (অ্যাডমিন প্যানেল থেকে সেট করা
> রোল-অ্যাক্সেস)। আলাদা রাখলে একটা চালিয়ে অন্যটা পরে চালানো যায়, আর কোনোটা
> সমস্যা করলে বোঝা যায় কোনটা। দুটোই স্বাধীনভাবে rollback করা যায়।

Supabase Dashboard → **SQL Editor** → পুরো ফাইল পেস্ট → **Run**।

- মাইগ্রেশন **২৭/২৮-কে হাত দেওয়া হয়নি**; ২৯ শুধু যোগ করে/বদলায় যেটা দরকার।
- **দুইবার চালালেও নিরাপদ** (সব স্টেটমেন্ট guarded)। `npm run db:check`-এ দুবার চালিয়ে যাচাই করা: ১৭৮টি চেক, ০ ব্যর্থ।
- অর্ডার, ব্যালেন্স, পেমেন্ট বা ক্যামেরা — **কোনো ডেটা মোছে না**।

### চালানোর আগে: ডুপ্লিকেট দেখে নিন

29 দুটো unique index বসায়। পুরোনো ডেটায় ডুপ্লিকেট থাকলে **ফাইলটা নিজেই থেমে যাবে**
এবং কী করতে হবে বলে দেবে — চুপচাপ ডিলিট করবে না।

```sql
-- একটি (order_id, kind) জোড়ায় একাধিক লেজার সারি?
select order_id, kind, count(*)
  from public.wallet_transactions
 where order_id is not null and kind in ('order','refund')
 group by 1,2 having count(*) > 1;

-- একই TrxID একাধিক অর্ডারে/সাবস্ক্রিপশনে?
select public.payment_ref_key(payment_ref) as ref, count(*)
  from public.orders
 where payment_ref is not null
 group by 1 having count(*) > 1;
```

প্রথমটা খালি এলে `WALLET_LEDGER_DUPLICATES` আসবে না। দ্বিতীয়টার ডুপ্লিকেট
29 নিজেই `legacy-duplicate:` প্রিফিক্স দিয়ে সরিয়ে দেয় — **কিছু মোছা হয় না**,
শুধু নতুন index-এর বাইরে চলে যায়, আর পুরোনো URL/রেফারেন্স লেখা অবস্থায় থাকে।

### চালানোর পর যাচাই

```sql
-- সবগুলো প্রত্যাশিত মান দেবে (মন্তব্যে লেখা আছে)
select has_function_privilege('authenticated',
  'public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid)','execute');   -- false
select has_function_privilege('anon',
  'public.place_order(uuid,jsonb,jsonb,text,text,numeric)','execute');      -- false
select public from storage.buckets where id = 'complaint-photos';           -- false
select public.payment_ref_key('bkash123 | 01700000000');                    -- BKASH123
```

তারপর **`13_verify_setup.sql`** চালান — ৫টি নতুন `SECURITY` সারি যোগ হয়েছে,
সবগুলো `PASS` দেখাবে।

### ৩০ চালানোর পর

`/+ADMIN+/access` (ডিফল্ট `/foisal/access`) খুলুন — স্টাফ ও ম্যানেজারের জন্য
চেকবক্স দেখবেন। শুরুতে সবকিছু কোডের ডিফল্টেই থাকবে, অর্থাৎ **কিছু না বদলালে
আচরণ হুবহু আগের মতোই**।

```sql
-- ডিফল্ট তালিকা (lib/permissions.ts-এর সাথে মিলতে হবে)
select * from public.role_permission_defaults() order by 1,2;

-- অ্যাডমিন কিছু বদলেছে কি?
select * from public.role_permissions order by role, permission;
```

`npm run db:permissions` এই দুটো তালিকা মিলিয়ে দেখে — না মিললে deploy আটকে যাবে।

---

## ২. কোড deploy

কোনো **নতুন environment variable লাগবে না**। আগেরগুলোই যথেষ্ট:

| Variable | দরকার? | কাজ |
|---|---|---|
| `SUPABASE_SECRET_KEY` | আগে থেকেই আছে | সার্ভারের সব RPC (wallet, payment_claim, stream_reserve_slot, signed URL) — এটাই 29-এর প্রধান শর্ত |
| `STREAM_TOKEN_SECRET` | আগে থেকেই আছে | ৫ মিনিটের JWT |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | আগে থেকেই আছে | ক্লায়েন্ট |

**ক্রম গুরুত্বপূর্ণ নয়, কিন্তু নিরাপদ ক্রম হলো:**

1. **SQL আগে** — 29 চালান। পুরোনো কোডও 29-এর সাথে চলবে (`wallet_apply`-এর
   সিগনেচার হুবহু একই, `place_order`-ও তাই — শুধু ভেতরে গার্ড যোগ হয়েছে)।
2. **তারপর Vercel deploy** — PR #76 merge → Production।

উল্টো করলে (আগে কোড, পরে SQL) নতুন কোড `stream_reserve_slot` /
`payment_claim` খুঁজে পাবে না এবং টোকেন রুট fail-closed হয়ে **503** দেবে।
স্ট্রিম বন্ধ থাকবে যতক্ষণ SQL না চালান — তাই **SQL আগে**।

### Vercel-এ কিছু বদলাতে হবে?

না। নতুন কোনো domain, redirect বা header নেই। signed URL একই
`*.supabase.co` host-এ যায়, যা আগে থেকেই `images.remotePatterns` ও CSP-তে আছে।

---

## ৩. Rollback

কিছু ভাঙলে, এই ক্রমে (প্রতিটা স্বাধীন):

```sql
-- ১. complaint-photos আবার পাবলিক (ছবি দেখা বন্ধ হলে)
update storage.buckets set public = true where id = 'complaint-photos';
drop policy if exists "complaint photos read by owner or staff" on storage.objects;

-- ২. ক্লায়েন্ট আবার RPC ডাকতে পারে (শুধু যদি নতুন কোড rollback করেন)
grant execute on function public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid) to authenticated;
grant execute on function public.place_order(uuid,jsonb,jsonb,text,text,numeric) to anon, authenticated;
grant execute on function public.apply_referral(uuid,text) to authenticated;

-- ৩. লেজার index (কোনো ডেটা যায় না)
drop index if exists public.wallet_transactions_one_per_order_kind;
```

`payment_refs`, `payment_claim`, `stream_reserve_slot` — এগুলো থাকলে কোনো
ক্ষতি নেই; পুরোনো কোড এদের ডাকে না। দরকার হলে:

```sql
-- drop table if exists public.payment_refs;
-- drop function if exists public.payment_claim(text,text,uuid,uuid);
```

**কোনো rollback-এই ডেটা মোছে না।**

---

## ৪. যা এখনো করা হয়নি (আপনার সিদ্ধান্ত)

| # | কী | কেন |
|---|---|---|
| F1 | 29-এর আগে তোলা অভিযোগের ছবি এখনো পাবলিক বাকেটে (`review-photos`) | ওগুলো ছিল **ভুল বাকেটে** আপলোড হওয়া ছবি — ফর্মে bucket নামটাই ভুল ছিল। SQL দিয়ে সারি বদলালে path এমন জায়গায় দেখাবে যেখানে ফাইল নেই। আসল সমাধান Storage API দিয়ে ফাইল সরানো (download → `complaint-photos`-এ upload → row update → old delete)। চাইলে একটা one-off maintenance route লিখে দিতে পারি। |
| F2 | `zod` < 4.6.6, `next`-এর ভেতরের `postcss` | দুটোরই ফিক্স breaking major (zod 4, Next 16)। আজ অ্যানোনিমাস রিকোয়েস্ট দিয়ে exploit করার পথ নেই। আপগ্রেড আলাদা করে প্ল্যান করুন। |
| F3 | rate limit শুধু IP-ভিত্তিক | DB cap-ই আসল নিয়ন্ত্রণ, আর সেটা এখন atomic। |

---

## ৫. সংক্ষেপে

> **চালাতে হবে: `29_security_hardening.sql` তারপর `30_team_permission_console.sql`।**
> তারপর `13_verify_setup.sql` দিয়ে যাচাই, তারপর PR merge → deploy।
> নতুন env variable লাগবে না। কিছু ভাঙলে §3-এর rollback।
