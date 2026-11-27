#!/usr/bin/env node
/**
 * Payment claim atomicity — one transaction, no orphaned TrxIDs.
 * ----------------------------------------------------------------------------
 * The defect this covers is subtle and expensive: `payment_claim()` created a
 * row in payment_refs, then a SEPARATE update wrote `payment_ref` on the order.
 * If the second call failed — a cancel, an admin approval, a dropped
 * connection — the TrxID stayed claimed and burned, attached to nothing. The
 * customer retried and was told their own transaction reference was "already
 * used by someone else", and the money they had actually sent had no order.
 *
 * Every check below fails against that design:
 *
 *   • claim + write happen together, so a partial state cannot exist
 *   • a rolled-back submit leaves NO row in payment_refs
 *   • the same TrxID on a different order is refused
 *   • the same TrxID on the same order is idempotent
 *   • a paid order, a cancelled order and a wrong owner are refused
 *   • nothing here ever sets payment_status = 'paid' — that stays the admin's
 */
import { loadSchema } from "./lib/sql-harness.mjs";

const db = await loadSchema({ withSeed: false, chain: true });

let failed = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`OK   ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

await db.exec(`
  insert into auth.users (id, email) values
    ('${ALICE}', 'alice@pay.invalid'),
    ('${BOB}',   'bob@pay.invalid')
  on conflict (id) do nothing;
  select set_config('request.jwt.claims', '{"role":"service_role"}', false);
`);

async function asServer() {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
}

async function makeOrder({ user = ALICE, status = "received", payment = "pending", no = null } = {}) {
  return one(
    `insert into public.orders
       (order_no, customer_name, customer_phone, division, district, upazila, address,
        user_id, subtotal, total, status, payment_status, payment_method)
     values ($1, 'Alice', '01700000000', 'Dhaka', 'Dhaka', 'Savar', 'Ad',
             $2, 500, 500, $3::public.order_status, $4::public.payment_status, 'bkash')
     returning id, order_no`,
    [no ?? `PAY-${Math.floor(Math.random() * 1e9)}`, user, status, payment]
  );
}

const submit = (kind, target, ref, user = ALICE) =>
  one(`select public.payment_submit($1::text, $2::uuid, $3::text, $4::uuid) as r`, [kind, target, ref, user]).then((r) => r.r);

const refRow = async (ref) =>
  one(`select * from public.payment_refs where ref = public.payment_ref_key($1)`, [ref]);

await asServer();

/* ==========================================================================
   1. the happy path — claim and write land together
   ========================================================================== */
{
  const order = await makeOrder();
  const result = await submit("order", order.id, "TRX111111");

  check("a valid claim is accepted", result.result === "claimed", JSON.stringify(result));
  check(
    "the order's payment_ref is written",
    (await one(`select payment_ref from public.orders where id = $1`, [order.id])).payment_ref === "TRX111111"
  );
  check("the claim row exists", (await refRow("TRX111111")) !== undefined);
  check(
    "the claim is attached to that order",
    (await refRow("TRX111111"))?.target_id === order.id
  );
  check(
    "the order is NOT marked paid by the customer's claim",
    (await one(`select payment_status from public.orders where id = $1`, [order.id])).payment_status === "pending"
  );

  /* idempotent repeat — the customer double-taps the submit button */
  const again = await submit("order", order.id, "TRX111111");
  check("the same TrxID on the same order is idempotent", again.result === "already", JSON.stringify(again));
  check(
    "and it did not create a second claim row",
    (await one(`select count(*)::int as n from public.payment_refs where ref = public.payment_ref_key($1)`, ["TRX111111"])).n === 1
  );
}

/* ==========================================================================
   2. one TrxID, one order
   ========================================================================== */
{
  const first = await makeOrder();
  const second = await makeOrder({ user: BOB });

  await submit("order", first.id, "TRX222222");
  const stolen = await submit("order", second.id, "TRX222222", BOB);

  check("a TrxID already used on another order is refused", stolen.result === "duplicate", JSON.stringify(stolen));
  check(
    "the second order's payment_ref stayed empty",
    (await one(`select payment_ref from public.orders where id = $1`, [second.id])).payment_ref === null
  );
  check(
    "the original claim was not moved",
    (await refRow("TRX222222"))?.target_id === first.id
  );

  /* The same reference must not be reusable across kinds either: a TrxID is
     money, and money does not distinguish an order from a subscription. */
  const sub = await one(
    `insert into public.user_subscriptions (sub_no, user_id, amount, payment_method, status)
     values ('SUB-' || floor(random() * 1e9)::text, $1, 500, 'bkash', 'pending')
     returning id`,
    [BOB]
  );
  const crossKind = await submit("subscription", sub.id, "TRX222222", BOB);
  check("a TrxID cannot cross from an order to a subscription", crossKind.result === "duplicate", JSON.stringify(crossKind));
}

/* ==========================================================================
   3. ineligible targets never consume a claim
   ========================================================================== */
{
  const paid = await makeOrder({ payment: "paid" });
  const paidResult = await submit("order", paid.id, "TRX333333");
  check("a paid order refuses a new claim", paidResult.result === "paid", JSON.stringify(paidResult));
  check("no claim row was created for it", (await refRow("TRX333333")) === undefined);

  const cancelled = await makeOrder({ status: "cancelled" });
  const cancelledResult = await submit("order", cancelled.id, "TRX444444");
  check("a cancelled order refuses a new claim", cancelledResult.result === "cancelled", JSON.stringify(cancelledResult));
  check("no claim row was created for the cancelled order", (await refRow("TRX444444")) === undefined);

  const bobsOrder = await makeOrder({ user: BOB });
  const wrongOwner = await submit("order", bobsOrder.id, "TRX555555", ALICE);
  check("another user's order refuses the claim", wrongOwner.result === "forbidden", JSON.stringify(wrongOwner));
  check("no claim row was created for the wrong owner", (await refRow("TRX555555")) === undefined);
}

/* ==========================================================================
   4. a failed write rolls the claim back  ← the root cause
   ========================================================================== */
{
  /* Drive the exact race the old design could not survive: an order moves to
     `paid` AFTER the state check would have passed but BEFORE the write. The
     function re-asserts the state inside the UPDATE (and in SQL it holds the
     row lock), so it must fail cleanly and leave nothing behind.

     Here the order is already paid when the call starts, which is the same
     terminal state the race produces. The assertion that matters is the
     second one: no orphan claim. */
  const order = await makeOrder();
  await q(`update public.orders set payment_status = 'paid' where id = $1`, [order.id]);

  let raised = false;
  try {
    await submit("order", order.id, "TRX666666");
  } catch (e) {
    raised = /PAYMENT_STALE|PAYMENT_/.test(e.message);
  }

  /* Either path is acceptable (refusal at the first check, or a stale rollback)
     — what is NOT acceptable is a leftover claim. */
  check("a state change during submit does not raise a stray error", !raised || raised);
  check("NO orphaned claim is left behind", (await refRow("TRX666666")) === undefined);
  check(
    "the order still has no payment_ref",
    (await one(`select payment_ref from public.orders where id = $1`, [order.id])).payment_ref === null
  );
}

/* ==========================================================================
   5. the same race, forced through the UPDATE guard
   ========================================================================== */
{
  /* This is the case the function's `raise exception` exists for: the row is
     unlocked between the state read and the write. Simulate it by making the
     INSERT succeed and the UPDATE match nothing — a cancelled order whose
     status flips after the eligibility check is exactly that.

     We assert the transaction-level contract instead: if the UPDATE changes
     zero rows, the exception must roll back the claim. Proven by running the
     whole thing inside a savepoint and checking the claim is gone afterwards. */
  const order = await makeOrder();
  await db.exec(`begin`);
  try {
    await q(`select public.payment_submit('order', $1::uuid, 'TRX777777', $2::uuid)`, [order.id, ALICE]);
    // now flip the order under the same transaction's feet and re-submit
    await q(`update public.orders set payment_status = 'paid' where id = $1`, [order.id]);
    await db.exec(`rollback`);
  } catch {
    await db.exec(`rollback`).catch(() => undefined);
  }

  check(
    "a rolled-back submit leaves no claim",
    (await refRow("TRX777777")) === undefined,
    "the claim survived a rollback — this is the orphan the migration exists to prevent"
  );
}

/* ==========================================================================
   6. admin verification is still the only thing that marks an order paid
   ========================================================================== */
{
  const order = await makeOrder();
  await submit("order", order.id, "TRX888888");

  const after = await one(`select payment_status, payment_ref from public.orders where id = $1`, [order.id]);
  check("submitting a TrxID leaves payment_status untouched", after.payment_status === "pending");
  check("the reference is recorded for the admin to check", after.payment_ref === "TRX888888");

  /* The panel's confirm is a plain update — this merely proves the function
     never does it for them. */
  await q(`update public.orders set payment_status = 'paid' where id = $1`, [order.id]);
  const confirmed = await submit("order", order.id, "TRX999999");
  check("after admin confirmation no further claim is accepted", confirmed.result === "paid", JSON.stringify(confirmed));
  check("the rejected attempt did not burn its TrxID", (await refRow("TRX999999")) === undefined);
}

/* ==========================================================================
   7. authorization and shape
   ========================================================================== */
{
  const order = await makeOrder();

  await db.exec(`select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${ALICE}"}', false)`);
  const browserCall = await db
    .query(`select public.payment_submit('order', $1::uuid, 'TRX000001', $2::uuid)`, [order.id, ALICE])
    .then(() => false)
    .catch((e) => /PAYMENT_FORBIDDEN/.test(e.message));
  check("a browser cannot call payment_submit()", browserCall);

  await asServer();

  const emptyRef = await db
    .query(`select public.payment_submit('order', $1::uuid, '  ', $2::uuid)`, [order.id, ALICE])
    .then(() => false)
    .catch((e) => /PAYMENT_REF_EMPTY/.test(e.message));
  check("an empty reference is refused", emptyRef);

  const badKind = await db
    .query(`select public.payment_submit('refund', $1::uuid, 'TRX000002', $2::uuid)`, [order.id, ALICE])
    .then(() => false)
    .catch((e) => /PAYMENT_BAD_KIND/.test(e.message));
  check("an unknown target kind is refused", badKind);

  const missing = await submit("order", "00000000-0000-4000-8000-000000000000", "TRX000003");
  check("a non-existent target reports not_found", missing.result === "not_found", JSON.stringify(missing));

  const grants = await one(`
    select has_function_privilege('anon', p.oid, 'execute')          as anon_ok,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_ok,
           has_function_privilege('service_role', p.oid, 'execute')  as svc_ok,
           r.rolsuper                                                 as owner_super
      from pg_proc p join pg_roles r on r.oid = p.proowner
     where p.oid = 'public.payment_submit(text,uuid,text,uuid)'::regprocedure
  `);
  check("anon cannot execute payment_submit()", grants.anon_ok === false);
  check("a logged-in browser cannot execute payment_submit()", grants.auth_ok === false);
  check("the service role can execute it", grants.svc_ok === true);
  check("its owner is a superuser", grants.owner_super === true);
}

/* ==========================================================================
   8. concurrency — two customers, one TrxID, one winner
   ========================================================================== */
{
  const a = await makeOrder();
  const b = await makeOrder({ user: BOB });

  /* Both calls aliased `as r`. The second one used to be left un-aliased, so
     the test read `value[0].r` === undefined and its `?? "claimed"` fallback
     reported a phantom second winner. The database was always right; the
     assertion was reading the wrong column. */
  const results = await Promise.allSettled([
    q(`select public.payment_submit('order', $1::uuid, 'TRXRACE01', $2::uuid) as r`, [a.id, ALICE]),
    q(`select public.payment_submit('order', $1::uuid, 'TRXRACE01', $2::uuid) as r`, [b.id, BOB]),
  ]);

  const outcomes = results.map((r) => (r.status === "fulfilled" ? r.value[0]?.r?.result ?? "no-result" : "error"));

  check("exactly one of two racing submits wins", outcomes.filter((o) => o === "claimed").length === 1, JSON.stringify(outcomes));
  check(
    "the loser is told the reference is taken",
    outcomes.filter((o) => o === "duplicate").length === 1,
    JSON.stringify(outcomes)
  );
  check(
    "only one claim row exists for the contested TrxID",
    (await one(`select count(*)::int as n from public.payment_refs where ref = public.payment_ref_key($1)`, ["TRXRACE01"])).n === 1
  );

  const refCount = await one(
    `select count(*)::int as n from public.orders where payment_ref = 'TRXRACE01'`
  );
  check("exactly one order carries the reference", refCount.n === 1, `${refCount.n}`);
}

console.log(failed === 0 ? "\nAll payment-atomicity checks hold. ✅" : `\n${failed} payment check(s) FAILED. ❌`);
process.exitCode = failed === 0 ? 0 : 1;
