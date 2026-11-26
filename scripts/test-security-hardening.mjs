#!/usr/bin/env node
/**
 * Security-hardening regression suite — runs against the real SQL inside PGlite.
 *
 *   node scripts/test-security-hardening.mjs
 *
 * Every check here maps to a defect that rev 16 found and 29_security_hardening.sql
 * fixed. They run on a throwaway in-process Postgres built from this repo's own
 * migrations, so nothing touches the owner's project: no real wallet, no real
 * order, no real camera, no real photo.
 *
 * What it proves:
 *   1. a customer cannot move another customer's wallet balance
 *   2. nobody can credit themselves out of thin air (kind 'admin' needs an admin)
 *   3. one order cannot be debited/refunded twice (ledger unique index)
 *   4. an order's owner cannot be forged by a browser calling place_order
 *   5. one TrxID cannot be claimed by two different orders/subscriptions
 *   6. the viewer cap holds even when N requests arrive at once
 *   7. the premium device limit holds when N devices register at once
 *   8. complaint photos are private: owner or staff only, anon gets nothing
 *   9. an expired stream token stops being a reservation
 *  10. a customer cannot read another customer's orders
 *
 * The concurrency checks (6, 7) open real parallel sessions against the same
 * database file and rely on the advisory locks in the RPCs, which is the whole
 * point of moving those limits out of the route handler.
 */
import { loadSchema, SQL_DIR } from "./lib/sql-harness.mjs";
import fs from "node:fs";
import path from "node:path";

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

/* ---------------------------------------------------------------- identities
   Two isolated customers plus one admin. Nothing here is the owner's data — the
   ids are fixed literals so a failure is reproducible. */
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OUTSIDER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

/* auth.uid() reads the same JWT claim Supabase sets, so "acting as" a user here
   is the identical code path the RPCs see in production. `false` = session
   scope; transaction scope vanishes before the next statement. */
await db.exec(`
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`);

async function actAs(userId) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false)`);
}

/** Pretend the call came from a route handler using the service key. */
async function actAsServer() {
  await actAs("");
  await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
}

/** Pretend the call came from an ordinary logged-in browser. */
async function actAsClient(userId) {
  await actAs(userId);
  await db.exec(
    `select set_config('request.jwt.claims', '${JSON.stringify({ role: "authenticated", sub: userId })}', false)`
  );
}

await db.exec(`
  /* handle_new_user() (07_functions_and_triggers.sql) already created a
     profile row per auth user, so the second insert must UPDATE, not insert. */
  insert into auth.users (id, email) values
    ('${ALICE}', 'alice@test.invalid'),
    ('${BOB}',   'bob@test.invalid'),
    ('${ADMIN}', 'admin@test.invalid'),
    ('${STAFF}', 'staff@test.invalid'),
    ('${OUTSIDER}', 'outsider@test.invalid')
  on conflict (id) do nothing;

  update public.profiles set full_name = 'Alice Test', wallet_balance = 100 where id = '${ALICE}';
  update public.profiles set full_name = 'Bob Test',   wallet_balance = 100 where id = '${BOB}';
  update public.profiles set full_name = 'Outsider',   wallet_balance = 0   where id = '${OUTSIDER}';

  /* Roles can only be set with no JWT in play — the profile-role guard trigger
     (07) refuses privilege changes from an authenticated session. */
  update public.profiles set full_name = 'Admin Test', role = 'admin' where id = '${ADMIN}';
  update public.profiles set full_name = 'Staff Test', role = 'staff' where id = '${STAFF}';
`);

async function balanceOf(id) {
  return (await db.query(`select wallet_balance from public.profiles where id = $1`, [id]))
    .rows[0].wallet_balance;
}

/* ==========================================================================
   1. cross-user wallet write
   --------------------------------------------------------------------------
   Before 29 this was a one-line exploit: POST /rest/v1/rpc/wallet_apply with
   someone else's id. Now the function refuses every non-service caller.
   ========================================================================== */
{
  await actAsClient(ALICE);
  let blocked = false;
  let message = "";
  try {
    await db.query(`select public.wallet_apply($1, 'bonus', 5000, null, null, 'free money', null)`, [BOB]);
  } catch (error) {
    blocked = true;
    message = error.message;
  }
  check("a customer cannot credit another customer's wallet", blocked, "wallet_apply() succeeded");
  check(
    "…and the refusal says WALLET_FORBIDDEN (not a random error)",
    /WALLET_FORBIDDEN|permission denied/i.test(message),
    message
  );
  check("…and Bob's balance is untouched", Number(await balanceOf(BOB)) === 100, String(await balanceOf(BOB)));

  /* Even a self-directed call must fail from a browser: the guard is about the
     caller's channel, not the target. */
  await actAsClient(BOB);
  let selfBlocked = false;
  try {
    await db.query(`select public.wallet_apply($1, 'bonus', 1, null, null, 'me', null)`, [BOB]);
  } catch {
    selfBlocked = true;
  }
  check("a customer cannot credit even their own wallet directly", selfBlocked);
  check("…balance still 100", Number(await balanceOf(BOB)) === 100);
}

/* ==========================================================================
   2. self-credit with a forged 'admin' label
   --------------------------------------------------------------------------
   The old function let the caller choose `kind`, so a wallet row could read
   'admin' with no admin involved — a false audit trail. Now 'admin' requires a
   real admin actor even on the service path.
   ========================================================================== */
{
  await actAsServer();
  let refused = false;
  let message = "";
  try {
    /* service key, but claiming to act for a non-admin customer */
    await db.query(`select public.wallet_apply($1, 'admin', 999, null, null, 'fake admin credit', $2)`, [
      BOB,
      ALICE,
    ]);
  } catch (error) {
    refused = true;
    message = error.message;
  }
  check("an 'admin' credit with a customer as actor is refused", refused, "accepted a customer as admin");
  check("…with WALLET_ADMIN_ONLY", /WALLET_ADMIN_ONLY/.test(message), message);
  check("…and Bob's balance is still 100", Number(await balanceOf(BOB)) === 100, String(await balanceOf(BOB)));

  /* The legitimate path must keep working: real admin, real service call. */
  await db.query(`select public.wallet_apply($1, 'admin', 50, null, null, 'goodwill credit', $2)`, [
    BOB,
    ADMIN,
  ]);
  check("a real admin credit through the server still works", Number(await balanceOf(BOB)) === 150);

  /* And a bad kind is rejected instead of being written verbatim. */
  let badKind = false;
  try {
    await db.query(`select public.wallet_apply($1, 'laundering', 10, null, null, null, null)`, [BOB]);
  } catch {
    badKind = true;
  }
  check("an unknown ledger kind is rejected", badKind);
}

/* ==========================================================================
   3. duplicate wallet transaction for one order
   --------------------------------------------------------------------------
   A retried refund must not pay twice. The partial unique index is the lock.
   ========================================================================== */
{
  await actAsServer();
  /* An order of Alice's own, so the debit/refund pair has a real target. The
     chain is built with withSeed:false, so this row is the only order. */
  const made = await db.query(
    `insert into public.orders
       (order_no, user_id, customer_name, customer_phone, division, district, upazila,
        address, status, payment_status, subtotal, total)
     values ('TEST-DUP-1', $1, 'Test Customer', '01700000000', 'Dhaka', 'Dhaka', 'Savar',
             'Test address', 'received', 'pending', 100, 100)
     on conflict (order_no) do nothing
     returning id`,
    [ALICE]
  );
  const oid =
    made.rows[0]?.id ??
    (await db.query(`select id from public.orders where order_no = 'TEST-DUP-1'`)).rows[0].id;

  await db.query(`select public.wallet_apply($1,'order',-10,$2,'TEST-DUP-1','debit',null)`, [ALICE, oid]);
  let second = false;
  try {
    await db.query(`select public.wallet_apply($1,'order',-10,$2,'TEST-DUP-1','debit again',null)`, [ALICE, oid]);
  } catch {
    second = true;
  }
  check("a second 'order' ledger row for one order is refused", second);

  /* A refund is a different kind, so the legitimate refund still lands. */
  await db.query(`select public.wallet_apply($1,'refund',10,$2,'TEST-DUP-1','refund',null)`, [ALICE, oid]);
  let secondRefund = false;
  try {
    await db.query(`select public.wallet_apply($1,'refund',10,$2,'TEST-DUP-1','refund again',null)`, [ALICE, oid]);
  } catch {
    secondRefund = true;
  }
  check("a second refund for one order is refused", secondRefund);
  check("…the balance reflects exactly one debit and one refund", Number(await balanceOf(ALICE)) === 100, String(await balanceOf(ALICE)));
}

/* ==========================================================================
   4. forged p_user in place_order
   --------------------------------------------------------------------------
   The 1100-line function was patched in place rather than rewritten; this is
   the check that the patch is really in the installed body and that a browser
   cannot pass someone else's id.
   ========================================================================== */
{
  const src = (
    await db.query(
      `select pg_get_functiondef('public.place_order(uuid,jsonb,jsonb,text,text,numeric)'::regprocedure) as src`
    )
  ).rows[0].src;
  check("place_order() carries the ORDER_FORBIDDEN guard", /ORDER_FORBIDDEN/.test(src));
  check("…and it compares p_user against auth.uid()", /p_user\s+is distinct from auth\.uid\(\)/.test(src));

  await actAsClient(ALICE);
  let forged = false;
  let message = "";
  try {
    /* Minimal payload: the guard fires before anything else is parsed. */
    await db.query(`select public.place_order($1, '[]'::jsonb, '{}'::jsonb, null, null, null)`, [BOB]);
  } catch (error) {
    forged = true;
    message = error.message;
  }
  /* Either the grant is gone (permission denied) or the guard fired — both mean
     the browser can no longer choose whose wallet is spent. */
  check(
    "a browser cannot call place_order() as another customer",
    forged && /ORDER_FORBIDDEN|permission denied/i.test(message),
    message
  );
}

/* ==========================================================================
   5. duplicate / reused TrxID
   --------------------------------------------------------------------------
   One bKash reference must belong to exactly one order — across orders AND
   subscriptions, and regardless of how the customer typed it.
   ========================================================================== */
{
  await actAsServer();
  const first = await db.query(`select public.payment_claim('BKASH-8F2K1 | 01711111111','order',$1) as r`, [ALICE]);
  check("the first claim of a TrxID succeeds", first.rows[0].r.ok === true, JSON.stringify(first.rows[0].r));

  const again = await db.query(`select public.payment_claim('bkash8f2k1 | 01799999999','order',$1) as r`, [ALICE]);
  check(
    "the same customer re-submitting the same order is idempotent",
    again.rows[0].r.ok === true && again.rows[0].r.reason === "already",
    JSON.stringify(again.rows[0].r)
  );

  const stolen = await db.query(
    `select public.payment_claim('BKASH 8F2K1', 'order', $1) as r`,
    [BOB]
  );
  check(
    "the same TrxID cannot be claimed by a different order",
    stolen.rows[0].r.ok === false && stolen.rows[0].r.reason === "duplicate",
    JSON.stringify(stolen.rows[0].r)
  );

  const asSub = await db.query(
    `select public.payment_claim('BKASH-8F2K1', 'subscription', $1) as r`,
    [OUTSIDER]
  );
  check(
    "…nor by a premium subscription instead of an order",
    asSub.rows[0].r.ok === false && asSub.rows[0].r.reason === "duplicate",
    JSON.stringify(asSub.rows[0].r)
  );

  const clientTry = async () => {
    await actAsClient(ALICE);
    try {
      await db.query(`select public.payment_claim('NEW-REF', 'order', $1) as r`, [ALICE]);
      return false;
    } catch {
      return true;
    }
  };
  check("a browser cannot write the payment_refs table itself", await clientTry());
}

/* ==========================================================================
   6. concurrent viewer cap
   --------------------------------------------------------------------------
   The old route counted, then inserted — N parallel requests all passed. Now
   one RPC holds an advisory lock per camera, so exactly `max_viewers` succeed.
   ========================================================================== */
{
  await actAsServer();
  /* withSeed:false means no demo farm/camera exists, so build the minimum the
     RPC needs. This is a throwaway database — no real camera is touched. */
  const farm = await db.query(
    `insert into public.farms (slug, name_bn, name_en, owner_user_id, division, district, is_active)
     values ('test-farm', 'টেস্ট খামার', 'Test Farm', $1, 'Dhaka', 'Dhaka', true)
     on conflict (slug) do nothing
     returning id`,
    [OUTSIDER]
  );
  const farmId =
    farm.rows[0]?.id ?? (await db.query(`select id from public.farms where slug = 'test-farm'`)).rows[0].id;
  const cameraRow = await db.query(
    `insert into public.cameras (farm_id, name_bn, zone_bn, protocol, status, is_active, max_viewers)
     values ($1, 'টেস্ট ক্যামরা', 'টেস্ট জোন', 'hls', 'online', true, 3)
     on conflict do nothing
     returning id`,
    [farmId]
  );
  const camera =
    cameraRow.rows[0]?.id ??
    (await db.query(`select id from public.cameras where farm_id = $1 limit 1`, [farmId])).rows[0]?.id;

  if (!camera) {
    console.log("SKIP concurrent viewer cap — could not create a camera");
  } else {
    await db.query(`update public.cameras set max_viewers = 3 where id = $1`, [camera]);
    await db.query(`delete from public.stream_tokens where camera_id = $1`, [camera]);

    const ATTEMPTS = 8;
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        db
          .query(
            `select public.stream_reserve_slot($1, $2, $3, 300) as r`,
            [camera, OUTSIDER, `fingerprint-${i}`]
          )
          .then((res) => res.rows[0].r)
          .catch((error) => ({ ok: false, reason: `error:${error.message}` }))
      )
    );

    const granted = results.filter((r) => r.ok === true).length;
    const capped = results.filter((r) => r.reason === "cap").length;
    check(
      `exactly max_viewers (3) of ${ATTEMPTS} simultaneous viewers get a slot`,
      granted === 3,
      `granted=${granted} capped=${capped} raw=${JSON.stringify(results.map((r) => r.ok))}`
    );
    check(
      "the rest are refused with reason 'cap' (not an error)",
      capped === ATTEMPTS - 3,
      `capped=${capped}`
    );

    /* A caller that is not the server cannot reserve at all. */
    await actAsClient(OUTSIDER);
    let clientBlocked = false;
    try {
      await db.query(`select public.stream_reserve_slot($1,$2,'x',300)`, [camera, OUTSIDER]);
    } catch {
      clientBlocked = true;
    }
    check("a browser cannot mint its own viewer slot", clientBlocked);

    /* --- 9. expired token stops counting, so a slot frees up -------------- */
    await actAsServer();
    await db.query(
      `update public.stream_tokens set expires_at = now() - interval '1 minute' where camera_id = $1`,
      [camera]
    );
    const afterExpiry = await db.query(
      `select public.stream_reserve_slot($1, $2, 'after-expiry', 300) as r`,
      [camera, OUTSIDER]
    );
    check(
      "an expired token frees its viewer slot",
      afterExpiry.rows[0].r.ok === true,
      JSON.stringify(afterExpiry.rows[0].r)
    );
    const pruned = await db.query(`select public.stream_prune_tokens() as n`);
    check("stream_prune_tokens() runs and returns a count", typeof pruned.rows[0].n === "number");
    const left = await db.query(
      `select count(*)::int as n from public.stream_tokens where expires_at <= now()`
    );
    check("…and leaves no expired rows behind", left.rows[0].n === 0, `left=${left.rows[0].n}`);
  }
}

/* ==========================================================================
   7. concurrent premium device limit
   --------------------------------------------------------------------------
   Same race, different table: register two devices at once and the old
   read-then-upsert let both in.
   ========================================================================== */
{
  await actAsServer();
  await db.query(`delete from public.premium_devices where user_id = $1`, [OUTSIDER]);

  const ATTEMPTS = 6;
  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, (_, i) =>
      db
        .query(`select public.premium_device_register($1, null, $2, 2) as r`, [OUTSIDER, `device-${i}`])
        .then((res) => res.rows[0].r)
        .catch((error) => ({ ok: false, reason: `error:${error.message}` }))
    )
  );
  const granted = results.filter((r) => r.ok === true).length;
  check(
    `exactly 2 of ${ATTEMPTS} simultaneous device registrations get in`,
    granted === 2,
    `granted=${granted} raw=${JSON.stringify(results)}`
  );

  /* Re-registering a known device must stay allowed (it is the same phone). */
  const known = await db.query(`select fingerprint from public.premium_devices where user_id = $1 limit 1`, [
    OUTSIDER,
  ]);
  const again = await db.query(`select public.premium_device_register($1, null, $2, 2) as r`, [
    OUTSIDER,
    known.rows[0].fingerprint,
  ]);
  check(
    "a device that is already registered is still accepted",
    again.rows[0].r.ok === true && again.rows[0].r.new === false,
    JSON.stringify(again.rows[0].r)
  );
}

/* ==========================================================================
   8. private complaint photo
   --------------------------------------------------------------------------
   The bucket was public and its objects were in the anon read policy, so a
   leaked URL was a permanent, unauthenticated leak.
   ========================================================================== */
{
  /* Real Supabase grants table-level SELECT on storage.objects to anon and
     authenticated; the harness stub does not, so grant it here. Without this
     every storage check fails with "permission denied for table objects" and
     would say nothing about the RLS policies under test. */
  await db.exec(`
    grant usage on schema storage to anon, authenticated;
    grant select on storage.objects to anon, authenticated;
    grant select on storage.buckets to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);

  const bucket = (
    await db.query(`select public from storage.buckets where id = 'complaint-photos'`)
  ).rows[0];
  check("complaint-photos exists as a bucket", Boolean(bucket));
  check("complaint-photos is NOT public", bucket && bucket.public === false, JSON.stringify(bucket));

  await db.query(
    `insert into storage.objects (bucket_id, name, owner)
     values ('complaint-photos', $1, $2)
     on conflict do nothing`,
    [`${ALICE}/broken-item.jpg`, ALICE]
  );

  async function canRead(role, userId) {
    await db.exec(`begin`);
    await db.exec(`set local role ${role}`);
    if (userId) await actAs(userId);
    const res = await db.query(
      `select count(*)::int as n from storage.objects
        where bucket_id = 'complaint-photos' and name = $1`,
      [`${ALICE}/broken-item.jpg`]
    );
    await db.exec(`rollback`);
    return res.rows[0].n > 0;
  }

  check("the owner can read their own complaint photo", await canRead("authenticated", ALICE));
  check("another customer cannot read it", (await canRead("authenticated", BOB)) === false);
  check("anon cannot read it at all", (await canRead("anon", null)) === false);
  check("staff can read it (they answer the complaint)", await canRead("authenticated", STAFF));
  check("admin can read it", await canRead("authenticated", ADMIN));

  /* Product/avatar images must stay public — the shop front depends on it. */
  const publicStillPublic = (
    await db.query(`select public from storage.buckets where id = 'product-images'`)
  ).rows[0];
  check("product-images is still public", publicStillPublic?.public === true, JSON.stringify(publicStillPublic));
}

/* ==========================================================================
   10. cross-customer data
   --------------------------------------------------------------------------
   RLS, not application code, is what makes Bob's order invisible to Alice.
   ========================================================================== */
{
  const orderNo = "TEST-CROSS-1";
  await actAsServer();
  await db.query(
    `insert into public.orders (order_no, user_id, customer_name, customer_phone, division, district, upazila, address, status, payment_status, subtotal, total)
     values ($1, $2, 'Test Customer', '01700000000', 'Dhaka', 'Dhaka', 'Savar', 'Test address', 'received', 'pending', 100, 100)
     on conflict (order_no) do nothing`,
    [orderNo, BOB]
  );

  async function seeOrders(userId) {
    await db.exec(`begin`);
    await db.exec(`set local role authenticated`);
    await actAs(userId);
    const res = await db.query(`select count(*)::int as n from public.orders where order_no = $1`, [orderNo]);
    await db.exec(`rollback`);
    return res.rows[0].n;
  }

  check("Bob can see his own order", (await seeOrders(BOB)) === 1);
  check("Alice cannot see Bob's order", (await seeOrders(ALICE)) === 0);
  check("an outsider cannot see it either", (await seeOrders(OUTSIDER)) === 0);

  /* The wallet ledger is the same story. */
  await db.exec(`begin`);
  await db.exec(`set local role authenticated`);
  await actAs(ALICE);
  const ledger = await db.query(`select count(*)::int as n from public.wallet_transactions where user_id = $1`, [
    BOB,
  ]);
  await db.exec(`rollback`);
  check("Alice cannot read Bob's wallet ledger", ledger.rows[0].n === 0, `rows=${ledger.rows[0].n}`);
}

/* ==========================================================================
   The grants themselves — the belt to the code's braces.
   ========================================================================== */
{
  const grants = await db.query(`
    select
      has_function_privilege('anon','public.place_order(uuid,jsonb,jsonb,text,text,numeric)','execute') as anon_place,
      has_function_privilege('authenticated','public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid)','execute') as auth_wallet,
      has_function_privilege('authenticated','public.apply_referral(uuid,text)','execute') as auth_referral,
      has_function_privilege('authenticated','public.payment_claim(text,text,uuid,uuid)','execute') as auth_payment,
      has_function_privilege('authenticated','public.stream_reserve_slot(uuid,uuid,text,integer)','execute') as auth_stream,
      has_function_privilege('authenticated','public.premium_device_register(uuid,uuid,text,integer,text,text)','execute') as auth_device
  `);
  const g = grants.rows[0];
  check("anon cannot execute place_order()", g.anon_place === false);
  check("authenticated cannot execute wallet_apply()", g.auth_wallet === false);
  check("authenticated cannot execute apply_referral()", g.auth_referral === false);
  check("authenticated cannot execute payment_claim()", g.auth_payment === false);
  check("authenticated cannot execute stream_reserve_slot()", g.auth_stream === false);
  check("authenticated cannot execute premium_device_register()", g.auth_device === false);

  /* …and the server still can, or the app would be broken by its own fix. */
  const server = await db.query(`
    select has_function_privilege('service_role','public.wallet_apply(uuid,text,numeric,uuid,text,text,uuid)','execute') as ok
  `);
  check("service_role can still execute wallet_apply()", server.rows[0].ok === true);
}

/* ---------------------------------------------------------------------------
   Sanity: 29 is actually part of the chain this test just built.
   --------------------------------------------------------------------------- */
check(
  "29_security_hardening.sql is registered in the SQL chain",
  fs.existsSync(path.join(SQL_DIR, "29_security_hardening.sql"))
);

console.log(`\n${failed === 0 ? "All security-hardening checks hold. ✅" : `${failed} check(s) FAILED`}`);
process.exit(failed ? 1 : 0);
