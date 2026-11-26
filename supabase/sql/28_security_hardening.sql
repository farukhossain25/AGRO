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
--   5. প্রোফাইলের অসম্পূর্ণ সারি: পুরোনো অ্যাকাউন্টের প্রোফাইলে ইমেইল/ফোন বসানো
--      হয় (auth.users থেকে, শুধু খালি কলামে) — নইলে /foisal/team-এর
--      "বিদ্যমান ব্যবহারকারী" সার্চে সেই লোককে খুঁজেই পাওয়া যেত না।
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

-- ⚠️ Postgres ফাংশনে ডিফল্টেই PUBLIC-কে EXECUTE দেয়, তাই শুধু
-- `revoke … from authenticated` **যথেষ্ট নয়** — PUBLIC থেকেও বাতিল করতে হয়।
-- ক্লায়েন্টের সরাসরি RPC নিষিদ্ধ; সব এখন /api দিয়ে, যেখানে সেশন ও রোল যাচাই হয়।

-- chat_claim() / chat_close() SECURITY DEFINER আর auth.uid() পড়ে। কিন্তু API
-- service key দিয়ে ডাকে, আর service key-এর সাথে কোনো JWT যায় না — তাই
-- auth.uid() = NULL, ফলে chat_claim() **সবসময় 'unauthenticated'** ফিরিয়ে দিত
-- এবং "গ্রহণ করুন" বোতামটা কখনো কাজ করত না।
--
-- সমাধান: actor আর auth.uid() থেকে নয়, **এক্সপ্লিসিট প্যারামিটার** থেকে আসে —
--   chat_claim(p_chat uuid, p_actor uuid)
--   chat_close(p_chat uuid, p_reason text, p_actor uuid)
-- রুট নিজেই p_actor পাস করে (requirePermission("chats.handle") পাস করার পরে),
-- আর ক্লায়েন্টের EXECUTE নেই — তাই কেউ নিজেই নিজেকে actor বানিয়ে ডাকতে পারে না।
-- p_actor বাদ দিলে (পুরোনো কল) আচরণ আগের মতোই — auth.uid(), অর্থাৎ ব্যর্থ।
--
-- chat_sweep()-এর actor লাগে না: সে শুধু সময় পার হওয়া চ্যাট বন্ধ করে, এবং একমাত্র
-- service_role ডাকতে পারে (কাস্টমার ওয়াজেট DELETE /api/support/chat দিয়ে ডাকে,
-- যেটা নিজেই একটি রুট)।

create or replace function public.chat_claim(p_chat uuid, p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := coalesce(p_actor, auth.uid());
  v_role   text;
  v_name   text;
  v_chat   public.support_chats;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  /* v_name is what the CUSTOMER is told, so it must never be an email handle.
     It used to fall back to split_part(email,'@',1), which is exactly how
     "foysaliqbal09" appeared in the customer's chat panel. A staff member with
     no saved name now appears as "টিম সদস্য"; the owner fixes it by naming the
     account in /foisal/team. */
  select p.role,
         coalesce(nullif(btrim(p.full_name), ''), 'টিম সদস্য'::text)
    into v_role, v_name
    from public.profiles p
   where p.id = v_uid;

  if v_role is null or v_role not in ('staff', 'manager', 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  update public.support_chats c
     set claimed_by = v_uid,
         claimed_at = now(),
         status     = 'claimed',
         updated_at = now()
   where c.id = p_chat
     and c.status <> 'closed'
     and c.claimed_by is null;

  if not found then
    select * into v_chat from public.support_chats where id = p_chat;
    return jsonb_build_object(
      'ok', false,
      'reason', case
                  when v_chat.id is null then 'not_found'
                  when v_chat.status = 'closed' then 'closed'
                  else 'taken'
                end,
      'claimed_by', v_chat.claimed_by,
      'claimed_by_name', (
        select coalesce(nullif(btrim(p.full_name), ''), 'টিম সদস্য'::text)
          from public.profiles p where p.id = v_chat.claimed_by
      )
    );
  end if;

  insert into public.support_messages (chat_id, author_role, author_id, author_name, body, is_system)
  values (p_chat, 'staff', v_uid, v_name,
          coalesce(v_name, 'বিশ্বাস এগ্রো টিম') || ' আপনার চ্যাটটি নিয়েছেন — এখনই উত্তর দিচ্ছেন।',
          true);

  return jsonb_build_object('ok', true, 'claimed_by', v_uid, 'claimed_by_name', v_name);
end;
$$;

create or replace function public.chat_close(p_chat uuid, p_reason text default 'staff', p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := coalesce(p_actor, auth.uid());
  v_role text;
  v_chat public.support_chats;
begin
  select * into v_chat from public.support_chats where id = p_chat;
  if v_chat.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_chat.status = 'closed' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;

  /* A customer may always end their own chat. Staff may end a chat they own,
     and an admin/manager may end any chat. */
  if v_chat.user_id is distinct from v_uid
     and not (
       v_role in ('admin', 'manager')
       or (v_role = 'staff' and v_chat.claimed_by = v_uid)
     ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  update public.support_chats
     set status        = 'closed',
         closed_at     = now(),
         closed_by     = v_uid,
         closed_reason = p_reason,
         updated_at    = now()
   where id = p_chat;

  insert into public.support_messages (chat_id, author_role, author_id, body, is_system)
  values (p_chat, 'staff', v_uid,
          case p_reason
            when 'customer' then 'কাস্টমার চ্যাটটি শেষ করেছেন।'
            when 'timeout'  then 'নির্ধারিত সময়ে উত্তর পাওয়া যায়নি — চ্যাটটি স্বয়ংক্রিয়ভাবে বন্ধ হয়েছে।'
            else 'চ্যাটটি বন্ধ করা হয়েছে।'
          end,
          true);

  return jsonb_build_object('ok', true);
end;
$$;

-- পুরোনো এক-আর্গুমেন্ট সিগনেচার রেখে দিলে PostgREST `p_chat` দিয়ে দুইটা
-- ওভারলোড খুঁজে পায় আর "could not choose the best candidate" দেয়। তাই
-- পুরোনোটা সরিয়ে দিলাম; নতুনটার ডিফল্ট থাকায় `{p_chat}` কল এখনো চলে।
drop function if exists public.chat_claim(uuid);
drop function if exists public.chat_close(uuid, text);

revoke execute on function public.chat_claim(uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.chat_close(uuid, text, uuid)    from public, anon, authenticated;
revoke execute on function public.chat_sweep()                    from public, anon, authenticated;

grant execute on function public.chat_claim(uuid, uuid)       to service_role;
grant execute on function public.chat_close(uuid, text, uuid) to service_role;
grant execute on function public.chat_sweep()                 to service_role;

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

-- ============================================ 6. profile rows that are ghosts ==
--
-- /foisal/team → "বিদ্যমান ব্যবহারকারী" searches public.profiles by
-- name/email/phone. It cannot read auth.users, so a profile row with a NULL
-- email is *invisible* — the owner types the person's address, gets "কেউ পাওয়া
-- যায়নি", and concludes the search is broken.
--
-- That is exactly what happens to accounts created before handle_new_user()
-- existed: the auth.users row has the address, the profile row never got it.
-- (handle_new_user only fills the row on INSERT — there is no backfill.)
--
-- So: copy the authoritative address/phone down from auth.users, but ONLY into
-- a NULL/empty column. A value the customer edited on their own profile is
-- never overwritten.
--
-- auth.users is not reachable from the API at all (no PostgREST exposure), which
-- is why this is a one-time SQL step and not a route.
update public.profiles p
   set email = nullif(btrim(u.email), ''),
       updated_at = now()
  from auth.users u
 where u.id = p.id
   and (p.email is null or btrim(p.email) = '')
   and nullif(btrim(u.email), '') is not null;

update public.profiles p
   set phone = nullif(btrim(u.phone), ''),
       updated_at = now()
  from auth.users u
 where u.id = p.id
   and (p.phone is null or btrim(p.phone) = '')
   and nullif(btrim(u.phone), '') is not null;

-- Same gap, going forward: a profile row created by anything other than the
-- signup trigger (a manual "Add user" in the dashboard, an old import) still
-- needs its address. This is handle_new_user's body, unchanged, plus one more
-- pass after INSERT … ON CONFLICT — the conflict branch only fills a column
-- that is still empty, so an edited address survives.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.profiles (id, full_name, email, phone, avatar_url)
    values (
      new.id,
      nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ''),
      nullif(btrim(new.email), ''),
      nullif(coalesce(new.raw_user_meta_data ->> 'phone', new.phone), ''),
      nullif(new.raw_user_meta_data ->> 'avatar_url', '')
    )
    on conflict (id) do update
      set email     = coalesce(public.profiles.email, excluded.email),
          full_name = coalesce(public.profiles.full_name, excluded.full_name),
          phone     = coalesce(public.profiles.phone, excluded.phone),
          updated_at = now();
  exception
    when others then
      raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ============================================================== 7. verify ====
--   select has_table_privilege('authenticated','public.trials','insert');        -- false
--   select has_function_privilege('authenticated','public.chat_claim(uuid)','execute'); -- false
--   select has_table_privilege('authenticated','public.v_team_members','select');-- false
--   select has_table_privilege('authenticated','public.support_chats','select'); -- false
--
-- DONE.
