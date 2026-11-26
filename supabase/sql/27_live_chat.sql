-- ============================================================================
-- 27_live_chat.sql
-- ============================================================================
-- WHAT IT DOES
--   Turns "customer has a question" into a real one-to-one chat with the
--   store, instead of a phone number the visitor has to dial at 9 am.
--
--     1. support_chats      one row per conversation
--     2. support_messages   the transcript (customer + staff, append-only)
--     3. chat_claim()       "আমি উত্তর দিচ্ছি" — atomic, exactly one staff
--     4. chat_close()       close a chat (customer / staff / auto-sweep)
--     5. chat_sweep()       closes chats nobody answered in time
--     6. realtime           both tables added to the publication, so the
--                           customer sees a reply without refreshing
--
--   THE RULES THE OWNER ASKED FOR
--     • a new chat is visible to EVERY staff/admin — nobody has to be
--       "assigned" it before they can see it arrive
--     • exactly ONE staff member may type into it: whoever claims it first
--     • everyone else still SEES the chat and its transcript, read-only, and
--       sees who claimed it ("ফয়সাল উত্তর দিচ্ছেন")
--     • if no staff replies within N minutes the chat closes itself — the
--       customer stops waiting, the queue stops growing
--
-- WHEN TO RUN
--   After 26_footer_payments.sql. Safe to re-run.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- AFTER RUNNING
--   Open the panel → যোগাযোগ → লাইভ চ্যাট. A customer chat appears there the
--   moment it is opened (realtime, no refresh).
-- ============================================================================

-- ---------------------------------------------------------------- 1. chats --
create table if not exists public.support_chats (
  id               uuid primary key default gen_random_uuid(),
  /** Signed-in customer. Null for a visitor who is browsing without an account. */
  user_id          uuid references public.profiles (id) on delete set null,
  /** Browser-scoped key for a guest, so their own chat survives a reload. */
  guest_key        text,
  /** Snapshot of who is asking — the transcript must stay readable even if the
   *  customer later changes their name or deletes the account. */
  customer_name    text,
  customer_phone   text,
  customer_email   text,
  /** Where the chat was opened from: /checkout, /products/:slug, / … */
  page_path        text,
  /** The first thing they typed, shown as the preview in the admin list. */
  subject          text,
  status           text not null default 'open'
                     check (status in ('open', 'claimed', 'closed')),
  /** Exactly one staff member. Enforced by chat_claim() below. */
  claimed_by       uuid references public.profiles (id) on delete set null,
  claimed_at       timestamptz,
  closed_by        uuid references public.profiles (id) on delete set null,
  closed_at        timestamptz,
  /** 'customer' | 'staff' | 'timeout' | 'sweep' — why the chat ended. */
  closed_reason    text,
  /** Last message by each side. The auto-close sweep reads last_customer_at. */
  last_customer_at timestamptz not null default now(),
  last_staff_at    timestamptz,
  /** Minutes the store is allowed to stay silent before the chat auto-closes.
   *  Set on the row (not only in code) so the owner can watch a live chat and
   *  know exactly when it will time out. */
  reply_window_min integer not null default 15 check (reply_window_min between 5 and 180),
  message_count    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  /** A visitor has at most one live chat: never two half-open tabs. */
  constraint support_chats_identity check (user_id is not null or guest_key is not null)
);

comment on table public.support_chats is
  'One live-chat conversation. status=open → nobody answering yet; claimed → '
  'one staff member owns it; closed → read-only transcript.';

-- One open chat per customer / per guest browser. `status <> 'closed'` is what
-- makes re-opening the widget rejoin the same conversation instead of spamming
-- the panel with duplicates.
create unique index if not exists support_chats_one_live_user
  on public.support_chats (user_id)
  where status <> 'closed' and user_id is not null;

create unique index if not exists support_chats_one_live_guest
  on public.support_chats (guest_key)
  where status <> 'closed' and guest_key is not null;

create index if not exists support_chats_queue_idx
  on public.support_chats (status, last_customer_at desc);

create index if not exists support_chats_claimed_idx
  on public.support_chats (claimed_by, status);

-- ------------------------------------------------------------- 2. messages --
create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.support_chats (id) on delete cascade,
  author_role text not null default 'customer' check (author_role in ('customer', 'staff')),
  author_id   uuid references public.profiles (id) on delete set null,
  /** Display name frozen at send time — "ফয়সাল" stays "ফয়সাল" in the history. */
  author_name text,
  body        text not null check (length(btrim(body)) between 1 and 4000),
  /** System lines ("ফয়সাল যোগ দিয়েছেন") are rendered as centred notes, not bubbles. */
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists support_messages_chat_idx
  on public.support_messages (chat_id, created_at);

comment on table public.support_messages is
  'Append-only transcript of a live chat. is_system rows are the "X joined" notes.';

-- ------------------------------------------------ 3. bookkeeping triggers --
create or replace function public.support_touch_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_role = 'customer' then
    update public.support_chats
       set last_customer_at = new.created_at,
           message_count    = message_count + 1,
           updated_at       = now(),
           /* A customer replying to a chat that already timed out re-opens the
              thread rather than writing into a closed transcript nobody reads. */
           status           = case when status = 'closed' and closed_reason in ('timeout', 'sweep')
                                   then 'open' else status end,
           closed_at        = case when status = 'closed' and closed_reason in ('timeout', 'sweep')
                                   then null else closed_at end,
           closed_by        = case when status = 'closed' and closed_reason in ('timeout', 'sweep')
                                   then null else closed_by end,
           closed_reason    = case when status = 'closed' and closed_reason in ('timeout', 'sweep')
                                   then null else closed_reason end,
           claimed_by       = case when status = 'closed' and closed_reason in ('timeout', 'sweep')
                                   then null else claimed_by end,
           claimed_at       = case when status = 'closed' and closed_reason in ('timeout', 'sweep')
                                   then null else claimed_at end
     where id = new.chat_id;
  elsif new.author_role = 'staff' and not new.is_system then
    update public.support_chats
       set last_staff_at = new.created_at,
           message_count = message_count + 1,
           updated_at    = now()
     where id = new.chat_id;
  end if;
  return new;
end;
$$;

drop trigger if exists support_messages_touch on public.support_messages;
create trigger support_messages_touch
  after insert on public.support_messages
  for each row execute function public.support_touch_chat();

-- -------------------------------------------------------------- 4. claim ----
-- The important one. A single UPDATE … WHERE claimed_by IS NULL is atomic in
-- Postgres: two staff clicking at the same instant means one gets the row and
-- the other gets zero rows back. No locks, no "who was first" race in JS.
create or replace function public.chat_claim(p_chat uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_name   text;
  v_chat   public.support_chats;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select p.role,
         coalesce(nullif(btrim(p.full_name), ''), split_part(coalesce(p.email, ''), '@', 1))
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
        select coalesce(nullif(btrim(p.full_name), ''), split_part(coalesce(p.email, ''), '@', 1))
          from public.profiles p where p.id = v_chat.claimed_by
      )
    );
  end if;

  -- A visible note in the transcript: the customer must SEE that a human has
  -- picked the chat up, not just watch a spinner stop.
  insert into public.support_messages (chat_id, author_role, author_id, author_name, body, is_system)
  values (p_chat, 'staff', v_uid, v_name,
          coalesce(v_name, 'বিশ্বাস এগ্রো টিম') || ' আপনার চ্যাটটি নিয়েছেন — এখনই উত্তর দিচ্ছেন।',
          true);

  return jsonb_build_object('ok', true, 'claimed_by', v_uid, 'claimed_by_name', v_name);
end;
$$;

comment on function public.chat_claim(uuid) is
  'Claim a live chat for the calling staff member. Returns ok=false + reason '
  '(taken/closed/forbidden/unauthenticated) when someone else got there first.';

-- -------------------------------------------------------------- 5. close ----
create or replace function public.chat_close(p_chat uuid, p_reason text default 'staff')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
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
     and an admin/manager may end any chat (someone leaving at 6 pm must not
     leave a customer waiting on a claim that will never answer). */
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

-- --------------------------------------------------------------- 6. sweep ---
-- Called by the customer widget on a timer and by the panel when it loads.
-- Closing is a data change with no side effects, so running it from more than
-- one place is harmless — the UPDATE is idempotent.
create or replace function public.chat_sweep()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with timed_out as (
    update public.support_chats c
       set status        = 'closed',
           closed_at     = now(),
           closed_reason = 'timeout',
           updated_at    = now()
     where c.status in ('open', 'claimed')
       and c.last_customer_at < now() - make_interval(mins => c.reply_window_min)
       and coalesce(c.last_staff_at, c.created_at) < now() - make_interval(mins => c.reply_window_min)
    returning c.id
  ),
  notes as (
    insert into public.support_messages (chat_id, author_role, body, is_system)
    select id, 'staff',
           'নির্ধারিত সময়ের মধ্যে উত্তর দেওয়া হয়নি — চ্যাটটি স্বয়ংক্রিয়ভাবে বন্ধ হয়েছে। আপনি চাইলে আবার লিখতে পারেন।',
           true
      from timed_out
    returning chat_id
  )
  select jsonb_build_object('closed', (select count(*) from timed_out));
$$;

comment on function public.chat_sweep() is
  'Auto-close chats where neither side has spoken for reply_window_min minutes. '
  'Idempotent — safe to call from the widget and the panel.';

-- ----------------------------------------------------------- 7. realtime ----
-- Realtime delivery is what makes this feel like a chat instead of a form. The
-- publication may already list these tables on a re-run; the guard keeps the
-- script safe to run twice.
do $$
begin
  /* `supabase_realtime` is created by Supabase, not by these SQL files, so on a
     plain Postgres (the db:check harness, a scratch database) it is absent and
     `alter publication` would abort the whole script. Skip quietly when it does
     not exist; create it if it exists but is missing a table. */
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.support_chats;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.support_messages;
    exception when duplicate_object then null;
    end;
  else
    raise notice 'supabase_realtime publication not found — skipping (create it in the Supabase dashboard, Realtime → Publications, and add support_chats + support_messages).';
  end if;
end $$;

-- Realtime sends the full row on UPDATE so the panel can show "claimed by"
-- without a follow-up read.
alter table public.support_chats replica identity full;
alter table public.support_messages replica identity full;

-- ----------------------------------------------------------------- 8. RLS ---
-- The API routes use the service role and do their own permission checks, so
-- RLS here exists for the browser Realtime socket and for anyone who ever calls
-- PostgREST directly. Default deny; three narrow policies.
alter table public.support_chats    enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_chats owner or staff" on public.support_chats;
create policy "support_chats owner or staff" on public.support_chats
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('staff', 'manager', 'admin')
    )
  );

drop policy if exists "support_messages owner or staff" on public.support_messages;
create policy "support_messages owner or staff" on public.support_messages
  for select using (
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

-- Guests are not authenticated, so the widget for a guest reads through the API
-- route (service role, guest_key check) rather than PostgREST.

-- --------------------------------------------------------------- 9. grants --
grant select on public.support_chats    to authenticated;
grant select on public.support_messages to authenticated;
grant execute on function public.chat_claim(uuid)        to authenticated, service_role;
grant execute on function public.chat_close(uuid, text)  to authenticated, service_role;
grant execute on function public.chat_sweep()            to authenticated, service_role;

-- ============================================================================
-- DONE. Next: open the panel → যোগাযোগ → লাইভ চ্যাট.
-- ============================================================================
