-- ============================================================================
-- 28_security_hardening.sql — চারটি থোক-থোক দরজা বন্ধ করা
-- ----------------------------------------------------------------------------
-- 27_live_chat.sql-এর পরে চালান। অন্যান্য ফাইলের মতোই ইডেমপোটেন্ট — দুবার
-- চালালেও কিছু ভাঙে না।
--
-- WHAT THIS FILE DOES (এবং আর কিছু নয়)
--   1. চ্যাট: সবার চ্যাট/ফোন/ইমেইল ক্লায়েন্ট থেকে পড়া বন্ধ। লগইন করা গ্রাহক
--      এখন শুধু **নিজের** চ্যাটের মেসেজ রিয়েলটাইমে পায় — সেটুকুই অ্যাপের দরকার।
--      বাকি সব রুটিং /api দিয়ে, service key-তে।
--   2. ট্রায়াল: ক্লায়েন্ট আর trials টেবিলে হাত দিতে পারবে না (INSERT সহ)।
--      আগে anon key দিয়ে নিজের সারি বানিয়ে expires_at = 2099 বসানো যেত।
--   3. ভিউ: v_team_members-এ `to authenticated` গ্রান্ট থাকায় যে কেউ লগইন করে
--      স্টাফদের ইমেইল/ফোন পড়তে পারত। এখন শুধু service_role।
--   4. অডিট: audit_log অ্যাপেন্ড-অনলি।
--
-- WHAT IT DELIBERATELY DOES *NOT* DO
--   * সেলার পণ্যের অটো-অ্যাপ্রুভাল (auto_approve_products), products-এর RLS বা
--     পাবলিক পঠন — ছোঁয়া হয়নি।
--   * নতুন টেবিল নেই, তাই 00_RESET_ALL_DANGEROUS.sql আপডেট লাগবে না।
--
-- AFTER RUNNING: "Success. No rows returned".
-- ============================================================================

-- ============================================================ 1. live chat ==
--
-- 27_live_chat.sql শেষে দিয়েছিল:
--     grant select on public.support_chats, public.support_messages to authenticated;
-- আর RLS পলিসি ছিল ("open or claimed" সবাই পড়তে পারে)। ফল: যেকোনো লগইন করা
-- গ্রাহক ব্রাউজারের publishable key দিয়ে `GET /rest/v1/support_chats` ডেকে
-- **সব গ্রাহকের নাম, ফোন, ইমেইল** পড়তে পারত।
--
-- অ্যাপের আসল পথ: /api/foisal/chats (স্টাফ) আর /api/support/chats (গ্রাহক) —
-- দুটোই service key + নিজের অনুমতি-যাচাই। একমাত্র ব্যতিক্রম: চ্যাট প্যানেলের
-- রিয়েলটাইম, যেটা ব্রাউজার থেকে support_messages সাবস্ক্রাইব করে এবং নিজের
-- চ্যাটের মেসেজ পায়। তাই ওই একটাই জিনিস রাখা হলো।

revoke all on public.support_chats    from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;

grant select on public.support_messages to authenticated;   -- RLS নিচে own-row
grant all    on public.support_chats    to service_role;
grant all    on public.support_messages to service_role;

alter table public.support_chats    enable row level security;
alter table public.support_messages enable row level security;

-- পুরোনো too-open পলিসি: "open or claimed" — মুছে দিলাম।
drop policy if exists "staff read all chats"    on public.support_chats;
drop policy if exists "staff read all messages" on public.support_messages;
drop policy if exists "chat participants"       on public.support_chats;
drop policy if exists "message participants"    on public.support_messages;

/* একমাত্র রাখা পলিসি — চ্যাট প্যানেলের রিয়েলটাইমের জন্য।
   গ্রাহক শুধু সেই মেসেজ পায় যেগুলো তার নিজের চ্যাটের (অথবা সে স্টাফ হলে সব)।
   স্টাফরা GET /rest/v1/support_messages দিয়ে সব পড়তে পারবে — কিন্তু সেটা
   দরকার নেই, স্টাফের প্যানেলও /api দিয়েই পড়ে; তবু পলিসিটা স্টাফকে রাখে,
   কারণ ভবিষ্যতে কোনো স্টাফ-স্ক্রিন সোজা সাবস্ক্রাইব করলে ভাঙবে না। */
drop policy if exists "messages own chat read" on public.support_messages;
create policy "messages own chat read" on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_chats c
       where c.id = support_messages.chat_id
         and (
           c.user_id = auth.uid()
           or exists (
             select 1 from public.profiles p
              where p.id = auth.uid() and p.role in ('staff', 'manager', 'admin')
           )
         )
    )
  );

-- chat_claim() SECURITY DEFINER আর auth.uid() পড়ে; service key দিয়ে ডাকলে
-- auth.uid() = NULL, তাই ফাংশনটা সবসময় 'unauthenticated' ফিরিয়ে দিত।
-- সমাধান: API এখন auth.uid() সেট করে ডাকে (SET LOCAL request.jwt.claims), আর
-- ক্লায়েন্টের সরাসরি EXECUTE নিষিদ্ধ — নইলে যে কেউ RPC দিয়ে চ্যাট দাবি করতে
-- পারত, অথবা (৩ নম্বরের আগে) নিজের রোল বদলের চেষ্টা করতে পারত।
--
-- ⚠️ Postgres ফাংশনে ডিফল্টেই PUBLIC-কে EXECUTE দেয়, তাই শুধু
-- `revoke … from authenticated` **যথেষ্ট নয়** — PUBLIC থেকেও বাতিল করতে হয়।
revoke execute on function public.chat_claim(uuid)       from public, anon, authenticated;
revoke execute on function public.chat_close(uuid, text) from public, anon, authenticated;
revoke execute on function public.chat_sweep()           from public, anon, authenticated;

grant execute on function public.chat_claim(uuid)       to service_role;
grant execute on function public.chat_close(uuid, text) to service_role;
grant execute on function public.chat_sweep()           to service_role;

-- ==================================================== 2. one chat per head ==
--
-- পুরোনো unique index: `where status <> 'closed' and user_id is not null`।
-- মানে চ্যাট বন্ধ হওয়ার পরে আবার খুললে নতুন সারি — ঠিকই আছে। কিন্তু
-- draft/claimed অবস্থায় দুটো খোলা চ্যাট থাকতে পারত না, সেটাই রাখা হলো।
--
-- (এখানে নতুন কিছু নেই — ইচ্ছাকৃতভাবে, যাতে 27-এর আচরণ অপরিবর্তিত থাকে।)

-- ================================================================ 3. trials ==
--
-- 05_premium_reviews_tables.sql-এ trials-এর RLS পলিসি + 08-এর blanket grant-এ
-- SELECT/INSERT/UPDATE/DELETE — অর্থাৎ ব্রাউজার থেকে পুরো টেবিল খোলা। যে কেউ
-- নিজের সারি বানিয়ে expires_at বসাতে পারত, অথবা অন্যেরটা মুছে দিয়ে "আবার
-- ট্রায়াল" নিতে পারত। ট্রায়াল ১০০% সার্ভার-মালিকানা।

revoke all on public.trials from anon, authenticated;
grant all  on public.trials to service_role;

alter table public.trials enable row level security;
drop policy if exists "trials_own_read"  on public.trials;
drop policy if exists "trials insert own" on public.trials;
drop policy if exists "own trial"         on public.trials;

-- হিন্ট বাদ দেওয়ার পরে ডিভাইস আর অ্যাকাউন্ট আলাদা করে রাখা দরকার, যাতে
-- "এক অ্যাকাউন্টে এক ট্রায়াল" আর "এক ডিভাইসে এক ট্রায়াল" দুটোই করা যায়।
alter table public.trials add column if not exists device_hash text;

comment on column public.trials.device_hash is
  'Server-side hash of (IP + User-Agent + Accept-Language). No client-supplied component.';
comment on column public.trials.fingerprint is
  'Legacy identifier kept for old rows; new rows use device_hash.';

create index if not exists trials_user_idx   on public.trials (user_id);
create index if not exists trials_device_idx on public.trials (device_hash);

-- ================================================================ 4. views ==
--
-- 10_indexes_and_views.sql-এর ভিউগুলো `security_invoker = false` — ভেতরের
-- টেবিলের RLS বাইপাস হয়, "কে পড়তে পারবে" ঠিক হয় শুধুই GRANT-এ। আর ১০-এর
-- শেষে ছিল:
--     grant select on public.v_team_members, … to authenticated, service_role;
-- অর্থাৎ **যেকোনো লগইন করা গ্রাহক** স্টাফ/ম্যানেজার/অ্যাডমিনের নাম, ইমেইল আর
-- ফোন পড়তে পারত। অথচ অ্যাপের একমাত্র ব্যবহারকারী পেজ (app/foisal/(protected)/team)
-- service key দিয়ে পড়ে।
--
-- ▶ যদি পরে কোনো ক্লায়েন্ট কম্পোনেন্ট এন্ট্রি থেকে এই ভিউটা পড়তে চায়, তবে
--   `revoke` লাইনটা মুছে ওই ভিউয়ের `grant select … to authenticated` ফিরিয়ে
--   দিন — তবে authenticatd মানে "যে কেউ লগইন করেছে", শুধু স্টাফ নয়।

revoke all on public.v_team_members from anon, authenticated;
grant select on public.v_team_members to service_role;

-- ইন্টারনাল রিপোর্টিং ভিউ — কোনো ক্লায়েন্ট call site নেই (সব lib/db.ts)।
revoke all on public.v_premium_revenue          from anon, authenticated;
revoke all on public.v_seller_leaderboard       from anon, authenticated;
revoke all on public.v_product_rating_breakdown from anon, authenticated;
revoke all on public.v_supplier_quality         from anon, authenticated;
revoke all on public.v_product_supplier         from anon, authenticated;
revoke all on public.v_farm_stats               from anon, authenticated;

grant select on public.v_premium_revenue, public.v_seller_leaderboard,
                public.v_product_rating_breakdown, public.v_supplier_quality,
                public.v_product_supplier, public.v_farm_stats
  to service_role;

-- public_sellers / public_cameras ইচ্ছাকৃতভাবে anon-পাঠযোগ্য (শুধু দেখানোর
-- কলাম) — হাত দেওয়া হয়নি।

-- ================================================================ 5. audit ==
-- অ্যাপেন্ড-অনলি। সব লেখা সার্ভারের, তাই ক্লায়েন্টের INSERT-ও বাতিল।
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

-- ============================================================== 6. verify ====
--   select has_table_privilege('authenticated','public.trials','insert');        -- false
--   select has_function_privilege('authenticated','public.chat_claim(uuid)','execute'); -- false
--   select has_table_privilege('authenticated','public.v_team_members','select');-- false
--   select has_table_privilege('authenticated','public.support_chats','select'); -- false
--
-- DONE.
