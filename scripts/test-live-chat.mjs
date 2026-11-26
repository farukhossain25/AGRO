#!/usr/bin/env node
/**
 * Live-chat rule test — runs against the real SQL inside PGlite.
 *
 *   node scripts/test-live-chat.mjs
 *
 * What it proves (these are the owner's rules, so they get a test rather than a
 * comment):
 *   1. a customer message touches last_customer_at and counts
 *   2. exactly ONE staff member can claim a chat; the second gets "taken"
 *   3. the claim writes a visible system line into the transcript
 *   4. a silent chat older than its reply window is closed by chat_sweep()
 *   5. a customer writing into a timed-out chat re-opens it
 *   6. closing is idempotent and a closed chat cannot be claimed
 */
import { loadSchema } from "./lib/sql-harness.mjs";

const db = await loadSchema({ withSeed: false, chain: true });

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`OK   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* auth.uid() is what the RPCs read to know who is calling. The harness stubs
   the auth schema, so the test sets it the same way Supabase does. */
async function actAs(id) {
  /* `false` = session scope. With `true` (transaction scope) the value vanished
     before the next statement, and every claim looked unauthenticated. */
  await db.exec(`select set_config('request.jwt.claim.sub', '${id}', false)`);
}

await db.exec(`
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`);

const staff1 = "11111111-1111-4111-8111-111111111111";
const staff2 = "22222222-2222-4222-8222-222222222222";
const customer = "33333333-3333-4333-8333-333333333333";

/* profiles.id references auth.users, so the auth rows come first — exactly the
   order a real signup takes. */
await db.exec(`
  insert into auth.users (id, email) values
    ('${staff1}', 'foysal@biswasagro.com'),
    ('${staff2}', 'rafiq@biswasagro.com'),
    ('${customer}', 'sumaiya@example.com')
  on conflict (id) do nothing;
`);

/* auth.users insert fires handle_new_user(), which already creates the profile
   as a plain customer. So this must be an UPSERT: `on conflict do nothing`
   silently left all three test users as customers, and every claim then
   correctly returned "forbidden" — the functions were right, the test was not. */
await db.exec(`
  insert into public.profiles (id, full_name, email, role) values
    ('${staff1}', 'ফয়সাল', 'foysal@biswasagro.com', 'staff'),
    ('${staff2}', 'রফিক', 'rafiq@biswasagro.com', 'manager'),
    ('${customer}', 'সুমাইয়া', 'sumaiya@example.com', 'customer')
  on conflict (id) do update
    set full_name = excluded.full_name,
        email     = excluded.email,
        role      = excluded.role;
`);

// ── 1. a customer message ────────────────────────────────────────────────
const chat = (
  await db.query(`
    insert into public.support_chats (user_id, customer_name, subject, reply_window_min)
    values ('${customer}', 'সুমাইয়া', 'টমেটোর দাম কত?', 15)
    returning id
  `)
).rows[0].id;

await db.exec(`
  insert into public.support_messages (chat_id, author_role, author_id, body)
  values ('${chat}', 'customer', '${customer}', 'টমেটোর দাম কত?');
`);

const afterOne = (
  await db.query(`select message_count, last_staff_at from public.support_chats where id = '${chat}'`)
).rows[0];
check("customer message increments message_count", afterOne.message_count === 1, JSON.stringify(afterOne));
check("no staff timestamp before any reply", afterOne.last_staff_at === null);

// ── 2. two staff, one claim ──────────────────────────────────────────────
await actAs(staff1);
const claim1 = (await db.query(`select public.chat_claim('${chat}') as r`)).rows[0].r;
check("first claim succeeds", claim1.ok === true, JSON.stringify(claim1));
check("claim returns the claimer's name", claim1.claimed_by_name === "ফয়সাল", JSON.stringify(claim1));

await actAs(staff2);
const claim2 = (await db.query(`select public.chat_claim('${chat}') as r`)).rows[0].r;
check("second claim is refused", claim2.ok === false, JSON.stringify(claim2));
check("refusal says who owns it", claim2.reason === "taken" && claim2.claimed_by_name === "ফয়সাল", JSON.stringify(claim2));

const owner = (
  await db.query(`select claimed_by, status from public.support_chats where id = '${chat}'`)
).rows[0];
check("only one owner is stored", owner.claimed_by === staff1 && owner.status === "claimed", JSON.stringify(owner));

// ── 3. the claim leaves a visible note ───────────────────────────────────
const note = (
  await db.query(`
    select body from public.support_messages
     where chat_id = '${chat}' and is_system = true
     order by created_at desc limit 1
  `)
).rows[0];
check("claim writes a system note", /নিয়েছেন/.test(note?.body ?? ""), note?.body);

// ── 4. the silent chat times out ─────────────────────────────────────────
await db.exec(`
  update public.support_chats
     set last_customer_at = now() - interval '20 minutes',
         created_at       = now() - interval '21 minutes',
         last_staff_at    = null
   where id = '${chat}';
`);
const swept = (await db.query(`select public.chat_sweep() as r`)).rows[0].r;
check("sweep closes the timed-out chat", Number(swept.closed) >= 1, JSON.stringify(swept));

const closed = (
  await db.query(`select status, closed_reason from public.support_chats where id = '${chat}'`)
).rows[0];
check("closed with reason timeout", closed.status === "closed" && closed.closed_reason === "timeout", JSON.stringify(closed));

// ── 6. a closed chat cannot be claimed ───────────────────────────────────
await actAs(staff1);
const claimClosed = (await db.query(`select public.chat_claim('${chat}') as r`)).rows[0].r;
check("closed chat cannot be claimed", claimClosed.ok === false && claimClosed.reason === "closed", JSON.stringify(claimClosed));

// ── 5. the customer writing again re-opens it ────────────────────────────
await db.exec(`
  insert into public.support_messages (chat_id, author_role, author_id, body)
  values ('${chat}', 'customer', '${customer}', 'আবার জিজ্ঞেস করছি — দাম কত?');
`);
const reopened = (
  await db.query(`select status, claimed_by, closed_reason from public.support_chats where id = '${chat}'`)
).rows[0];
check(
  "customer reply re-opens a timed-out chat",
  reopened.status === "open" && reopened.claimed_by === null && reopened.closed_reason === null,
  JSON.stringify(reopened)
);

// ── 7. staff reply stamps last_staff_at ──────────────────────────────────
await db.exec(`
  insert into public.support_messages (chat_id, author_role, author_id, body)
  values ('${chat}', 'staff', '${staff1}', 'এখন ৬০ টাকা কেজি।');
`);
const answered = (
  await db.query(`select last_staff_at from public.support_chats where id = '${chat}'`)
).rows[0];
check("staff reply records when the store answered", answered.last_staff_at !== null);

// ── 8. close is idempotent ───────────────────────────────────────────────
await actAs(staff1);
await db.query(`select public.chat_close('${chat}', 'staff')`);
const again = (await db.query(`select public.chat_close('${chat}', 'staff') as r`)).rows[0].r;
check("closing twice is harmless", again.ok === true && again.already === true, JSON.stringify(again));

// ── 9. a non-staff caller cannot claim ───────────────────────────────────
/* A second chat for the SAME customer is refused by support_chats_one_live_user
   — that is the "one live chat per person" rule. Use a different customer. */
const other = "44444444-4444-4444-8444-444444444444";
await db.exec(`
  insert into auth.users (id, email) values ('${other}', 'rakib@example.com') on conflict (id) do nothing;
  insert into public.profiles (id, full_name, email, role)
  values ('${other}', 'রাকিব', 'rakib@example.com', 'customer')
  on conflict (id) do update set full_name = excluded.full_name;
`);
const chatNotStaff = (
  await db.query(`
    insert into public.support_chats (user_id, customer_name, subject)
    values ('${other}', 'রাকিব', 'ডেলিভারি কখন?') returning id
  `)
).rows[0].id;
await actAs(customer);
const notStaff = (await db.query(`select public.chat_claim('${chatNotStaff}') as r`)).rows[0].r;
check("a customer cannot claim a chat", notStaff.ok === false && notStaff.reason === "forbidden", JSON.stringify(notStaff));

// ── 10. one live chat per customer ──────────────────────────────────────
/* A fresh customer with one live chat, then a second attempt — using
   `${customer}` here was wrong: their earlier chat was re-opened by test 5, so
   a second row was a legitimate insert, not a duplicate. */
const twice = "66666666-6666-4666-8666-666666666666";
await db.exec(`
  insert into auth.users (id, email) values ('${twice}', 'twice@example.com') on conflict (id) do nothing;
`);
await db.exec(`
  insert into public.support_chats (user_id, subject) values ('${twice}', 'প্রথম');
`);
let duplicateBlocked = false;
try {
  await db.query(`
    insert into public.support_chats (user_id, customer_name, subject)
    values ('${twice}', 'একই কাস্টমার', 'দ্বিতীয়') returning id
  `);
} catch {
  duplicateBlocked = true;
}
check("a customer cannot open two live chats", duplicateBlocked);

// ── 11. the number printed on the site is the number that dials ─────────
/* This is the bug that made the contact bubble look broken: a stored
   `+8801712345678` printed as `১৭১২-৩৪৫৬৭৮`, one digit short of the trunk 0.
   The helper is imported rather than re-implemented so the test cannot drift
   from the code. */
const { prettyPhoneBn } = await import("../lib/store-info-model.ts");
const cases = [
  ["+8801712345678", "০১৭১২-৩৪৫৬৭৮"],
  ["8801712345678", "০১৭১২-৩৪৫৬৭৮"],
  ["01712345678", "০১৭১২-৩৪৫৬৭৮"],
  ["০১৭০০-০০০০০০", "০১৭০০-০০০০০০"],
];
for (const [input, expected] of cases) {
  const got = prettyPhoneBn(input);
  check(`phone ${input} prints as ${expected}`, got === expected, got);
}

// ── 12. the actor comes from a parameter, not from auth.uid() ────────────
/* The API calls chat_claim() with the SERVICE key. A service-key request carries
   no JWT, so auth.uid() is NULL and the function answered "unauthenticated"
   every single time — the "গ্রহণ করুন" button could never work. 28 adds
   p_actor; these two checks are the contract the route relies on: a call with
   an actor works, a call without one still refuses. */
const chatActor = (
  await db.query(`
    insert into public.support_chats (user_id, customer_name, subject, reply_window_min)
    values ('${customer}', 'সুমাইয়া', 'দ্বিতীয় চ্যাট?', 15)
    returning id
  `)
).rows[0].id;

await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
const noActor = (await db.query(`select public.chat_claim('${chatActor}') as r`)).rows[0].r;
check("claim without actor is refused", noActor.ok === false && noActor.reason === "unauthenticated", JSON.stringify(noActor));

const withActor = (await db.query(`select public.chat_claim('${chatActor}', '${staff1}') as r`)).rows[0].r;
check("claim with an actor succeeds", withActor.ok === true, JSON.stringify(withActor));

/* No chat row needed: chat_claim() checks the actor's role BEFORE it touches
   the row, so a customer id is refused as "forbidden" either way. Using a
   literal id also avoids the one-live-chat-per-customer unique index. */
const customerActor = (
  await db.query(`select public.chat_claim(gen_random_uuid(), '${customer}') as r`)
).rows[0].r;
check(
  "a customer id as actor is still forbidden",
  customerActor.ok === false && customerActor.reason === "forbidden",
  JSON.stringify(customerActor)
);

console.log(`\n${failed === 0 ? "All live-chat rules hold. ✅" : `${failed} check(s) FAILED`}`);
process.exit(failed ? 1 : 0);
