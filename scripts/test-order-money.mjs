#!/usr/bin/env node
/**
 * Order money — cancellation and deletion must be exact, atomic and one-shot.
 * ----------------------------------------------------------------------------
 * These are the paths where a bug costs real taka:
 *
 *   • a cancelled order must give back the stock it reserved, the coupon use it
 *     consumed and the wallet balance it debited — each EXACTLY once
 *   • a second cancel must change nothing (a double refund pays the customer
 *     twice out of the shop's pocket)
 *   • deleting an order must not silently destroy a wallet refund
 *   • a delivered order is a sale; it must not be cancellable or deletable
 *   • an order whose payment arrived but whose goods did not ship must not be
 *     deletable out from under the money
 *
 * Everything runs against the real SQL chain in PGlite, with the same
 * `request.jwt.claims` mechanism Supabase uses, so the service-role rules are
 * exercised exactly as they are in production.
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
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OUTSIDER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

await db.exec(`
  insert into auth.users (id, email) values
    ('${ALICE}',  'alice@test.invalid'),
    ('${ADMIN}',  'admin@test.invalid'),
    ('${STAFF}',  'staff@test.invalid'),
    ('${OUTSIDER}','out@test.invalid')
  on conflict (id) do nothing;

  update public.profiles set wallet_balance = 1000 where id = '${ALICE}';
  /* Role changes need no JWT in play — the profile guard trigger (07) refuses
     privilege edits from an authenticated session. */
  update public.profiles set role = 'admin' where id = '${ADMIN}';
  update public.profiles set role = 'staff' where id = '${STAFF}';
`);

/** Route handlers always call with the service key (lib/db.ts). */
async function asServer() {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
}
async function asClient(userId) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec(
    `select set_config('request.jwt.claims', '${JSON.stringify({ role: "authenticated", sub: userId })}', false)`
  );
}

await asServer();

/* ---- fixtures ------------------------------------------------------------ */
const productId = (
  await one(`insert into public.products (slug, name_bn, price, stock, is_active)
             values ('money-test', 'টাকা পরীক্ষা', 100, 50, true) returning id`)
).id;
const couponId = (
  await one(`insert into public.coupons (code, description_bn, type, value, min_order, used_count)
             values ('MONEY10', 'পরীক্ষা', 'fixed', 50, 0, 0) returning id`)
).id;

const balance = async () => Number((await one(`select wallet_balance from public.profiles where id = $1`, [ALICE])).wallet_balance);
const stock = async () => Number((await one(`select stock from public.products where id = $1`, [productId])).stock);
const couponUses = async () => Number((await one(`select used_count from public.coupons where id = $1`, [couponId])).used_count);

/* An order exactly as place_order() leaves the database: stock taken off the
   shelf, the coupon's used_count bumped with a redemption row, the wallet
   debited through wallet_apply() (so the ledger row exists), one sub_order. */
async function makeOrder({ wallet = 300, coupon = true, quantity = 2, status = "received", paid = false } = {}) {
  const order = await one(
    `insert into public.orders
       (order_no, customer_name, customer_phone, division, district, upazila, address,
        user_id, subtotal, total, wallet_used, coupon_code, status, payment_status)
     values ('M-' || floor(random() * 1e9)::text, 'Alice', '01700000000', 'Dhaka', 'Dhaka', 'Savar', 'Ad',
             $1, 500, 200, $2, $3, $4::public.order_status, $5::public.payment_status)
     returning id, order_no`,
    [ALICE, wallet, coupon ? "MONEY10" : null, status, paid ? "paid" : "pending"]
  );

  await q(
    `insert into public.order_items (order_id, product_id, name_bn, price, quantity)
     values ($1, $2, 'টাকা পরীক্ষা', 100, $3)`,
    [order.id, productId, quantity]
  );

  // what checkout reserved
  await q(`update public.products set stock = stock - $1 where id = $2`, [quantity, productId]);

  if (wallet > 0) {
    await q(`select public.wallet_apply($1, 'order', (-1 * $2::numeric), $3::uuid, $4, 'checkout', null)`, [
      ALICE,
      wallet,
      order.id,
      order.order_no,
    ]);
  }

  if (coupon) {
    await q(`update public.coupons set used_count = used_count + 1 where id = $1`, [couponId]);
    await q(
      `insert into public.coupon_redemptions (coupon_id, user_id, order_id, order_no, amount)
       values ($1, $2, $3, $4, 50)`,
      [couponId, ALICE, order.id, order.order_no]
    );
  }

  await q(`insert into public.sub_orders (order_id, sub_no, subtotal, seller_earning)
           values ($1, 'S-' || floor(random() * 1e9)::text, 200, 180)`, [order.id]);

  return order;
}

/* ==========================================================================
   1. cancel gives everything back, exactly once
   ========================================================================== */
{
  const before = { balance: await balance(), stock: await stock(), uses: await couponUses() };
  const order = await makeOrder();

  check("checkout debits the wallet", (await balance()) === before.balance - 300);
  check("checkout takes the stock", (await stock()) === before.stock - 2);
  check("checkout counts the coupon", (await couponUses()) === before.uses + 1);

  const result = await one(`select public.order_cancel($1, 'customer asked', $2) as r`, [order.id, ADMIN]).then((r) => r.r);

  check("cancel reports success", result.result === "cancelled", JSON.stringify(result));
  check("cancel refunds the wallet", (await balance()) === before.balance, `${await balance()} vs ${before.balance}`);
  check("cancel puts the stock back", (await stock()) === before.stock);
  check("cancel gives the coupon use back", (await couponUses()) === before.uses);
  check("cancel clears the per-account redemption", (await one(`select count(*)::int as n from public.coupon_redemptions where order_id = $1`, [order.id])).n === 0);
  check("cancel voids the seller's sub_order", (await one(`select status from public.sub_orders where order_id = $1`, [order.id])).status === "cancelled");
  check(
    "cancel writes one refund ledger row",
    (await one(`select count(*)::int as n from public.wallet_transactions where order_id = $1 and kind = 'refund'`, [order.id])).n === 1
  );

  /* ---- the second call must do nothing at all --------------------------- */
  const again = await one(`select public.order_cancel($1, 'again', $2) as r`, [order.id, ADMIN]).then((r) => r.r);
  check("a second cancel reports 'already'", again.result === "already", JSON.stringify(again));
  check("a second cancel does not pay twice", (await balance()) === before.balance, `${await balance()}`);
  check("a second cancel does not restock twice", (await stock()) === before.stock);
  check("a second cancel does not refund the coupon twice", (await couponUses()) === before.uses);
  check(
    "a second cancel writes no second ledger row",
    (await one(`select count(*)::int as n from public.wallet_transactions where order_id = $1 and kind = 'refund'`, [order.id])).n === 1
  );
}

/* ==========================================================================
   2. a paid order that is cancelled records the refund state
   ========================================================================== */
{
  const order = await makeOrder({ paid: true });
  const result = await one(`select public.order_cancel($1, 'paid then cancelled', $2) as r`, [order.id, ADMIN]).then((r) => r.r);
  const row = await one(`select status, payment_status from public.orders where id = $1`, [order.id]);

  check("a paid order can be cancelled", result.result === "cancelled", JSON.stringify(result));
  check("a paid order ends as cancelled", row.status === "cancelled");
  check("a paid-then-cancelled order is marked refunded, not left 'paid'", row.payment_status === "refunded", row.payment_status);
}

/* ==========================================================================
   3. a delivered order is a sale — never cancelled, never deleted
   ========================================================================== */
{
  const order = await makeOrder({ status: "delivered" });

  const cancelResult = await one(`select public.order_cancel($1, 'oops', $2) as r`, [order.id, ADMIN]).then((r) => r.r);
  check("a delivered order is not cancelled", cancelResult.result === "delivered", JSON.stringify(cancelResult));
  check("a delivered order keeps its status", (await one(`select status from public.orders where id = $1`, [order.id])).status === "delivered");

  const deleteBlocked = await db
    .query(`select public.order_delete($1, $2)`, [order.id, ADMIN])
    .then(() => false)
    .catch((e) => /ORDER_DELIVERED/.test(e.message));
  check("a delivered order cannot be deleted", deleteBlocked);
  check("a delivered order still exists", (await one(`select count(*)::int as n from public.orders where id = $1`, [order.id])).n === 1);
}

/* ==========================================================================
   4. delete refunds the wallet instead of swallowing it  ← the reported bug
   ========================================================================== */
{
  const before = { balance: await balance(), stock: await stock(), uses: await couponUses() };
  const order = await makeOrder();

  const result = await one(`select public.order_delete($1, $2) as r`, [order.id, ADMIN]).then((r) => r.r);

  check("deleting a live order reports success", result.result === "deleted", JSON.stringify(result));
  check("deleting refunds the wallet it debited", (await balance()) === before.balance, `${await balance()} vs ${before.balance}`);
  check("deleting restores the stock", (await stock()) === before.stock);
  check("deleting restores the coupon use", (await couponUses()) === before.uses);
  check("deleting removes the order row", (await one(`select count(*)::int as n from public.orders where id = $1`, [order.id])).n === 0);
  /* wallet_transactions.order_id is `on delete set null`, so the rows outlive
     the order — deliberately. The taka trail must survive the row, which is the
     whole reason a delete is safe at all. */
  const trail = await q(
    `select kind, amount from public.wallet_transactions
      where user_id = $1 and note_bn = 'checkout' or (user_id = $1 and kind = 'refund' and amount = 300)
      order by created_at desc limit 2`,
    [ALICE]
  );
  check(
    "deleting keeps the debit and the refund in the ledger",
    trail.some((t) => t.kind === "order" && Number(t.amount) === -300) &&
      trail.some((t) => t.kind === "refund" && Number(t.amount) === 300),
    JSON.stringify(trail)
  );
  check(
    "deleting writes one audit row inside the transaction",
    (await one(`select count(*)::int as n from public.audit_log where entity = 'orders' and entity_id = $1 and action = 'delete'`, [order.id])).n === 1
  );
  check(
    "the audit row keeps the deleted order's shape",
    (await one(`select diff -> 'deleted' ->> 'order_no' as no from public.audit_log where entity_id = $1 and entity = 'orders'`, [order.id])).no === order.order_no
  );
}

/* ==========================================================================
   5. an order with money in flight is not deletable
   ========================================================================== */
{
  const order = await makeOrder({ paid: true });
  const blocked = await db
    .query(`select public.order_delete($1, $2)`, [order.id, ADMIN])
    .then(() => false)
    .catch((e) => /ORDER_PAYMENT_UNRESOLVED/.test(e.message));

  check("a paid, undelivered order cannot be deleted", blocked);
  check("that order is still there for the admin to resolve", (await one(`select count(*)::int as n from public.orders where id = $1`, [order.id])).n === 1);
}

/* ==========================================================================
   6. an order that never debited the wallet does not invent money
   ========================================================================== */
{
  const balanceBefore = await balance();
  const order = await makeOrder({ wallet: 0 });

  /* A wallet_used value with no matching debit row is exactly what a hand-edited
     row or a half-finished checkout looks like. The refund must follow the
     ledger, not the column. */
  await q(`update public.orders set wallet_used = 500 where id = $1`, [order.id]);

  const result = await one(`select public.order_cancel($1, 'no debit', $2) as r`, [order.id, ADMIN]).then((r) => r.r);
  check("a cancel with no wallet debit refunds nothing", Number(result.wallet_refunded) === 0, JSON.stringify(result));
  check("the balance is untouched", (await balance()) === balanceBefore);
  check(
    "no refund ledger row is invented",
    (await one(`select count(*)::int as n from public.wallet_transactions where order_id = $1 and kind = 'refund'`, [order.id])).n === 0
  );
}

/* ==========================================================================
   7. authorization — the browser cannot move money
   ========================================================================== */
{
  const order = await makeOrder();

  await asClient(ALICE);
  const customerBlocked = await db.query(`select public.order_cancel($1, 'me', null)`, [order.id]).then(() => false).catch((e) => /ORDER_FORBIDDEN/.test(e.message));
  check("a customer cannot cancel through the RPC", customerBlocked);

  await asServer();
  check("that order is untouched", (await one(`select status from public.orders where id = $1`, [order.id])).status === "received");

  await asClient(ADMIN);
  const adminBrowserBlocked = await db.query(`select public.order_delete($1, $2)`, [order.id, ADMIN]).then(() => false).catch((e) => /ORDER_FORBIDDEN/.test(e.message));
  check("even an admin's browser cannot call order_delete()", adminBrowserBlocked);

  await asServer();
  const outsiderBlocked = await db.query(`select public.order_cancel($1, 'x', $2)`, [order.id, OUTSIDER]).then(() => false).catch((e) => /ORDER_ACTOR_FORBIDDEN/.test(e.message));
  check("a non-staff actor id is refused", outsiderBlocked);

  const staffAllowed = await one(`select public.order_cancel($1, 'staff cancel', $2) as r`, [order.id, STAFF]).then((r) => r.r);
  check("a staff actor id is accepted", staffAllowed.result === "cancelled", JSON.stringify(staffAllowed));
}

/* ==========================================================================
   8. the functions are not reachable from PostgREST
   ========================================================================== */
{
  const grants = await one(`
    select
      bool_or(has_function_privilege('anon', p.oid, 'execute'))          as anon_any,
      bool_or(has_function_privilege('authenticated', p.oid, 'execute')) as auth_any,
      bool_and(has_function_privilege('service_role', p.oid, 'execute')) as svc_all,
      count(*)::int                                                      as n
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('order_release_order', 'order_cancel', 'order_delete')
  `);

  check("all three functions exist", grants.n === 3, String(grants.n));
  check("anon cannot execute any of them", grants.anon_any === false);
  check("a logged-in browser cannot execute any of them", grants.auth_any === false);
  check("the service role can execute all of them", grants.svc_all === true);

  const owners = await q(`
    select p.proname, r.rolsuper
      from pg_proc p join pg_roles r on r.oid = p.proowner
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('order_release_order', 'order_cancel', 'order_delete')
  `);
  check("each function is owned by a superuser", owners.every((o) => o.rolsuper === true), JSON.stringify(owners));

  const paths = await q(`
    select p.proname, p.proconfig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('order_release_order', 'order_cancel', 'order_delete')
  `);
  check(
    "each function pins search_path",
    paths.every((p) => (p.proconfig ?? []).some((c) => c.startsWith("search_path="))),
    JSON.stringify(paths)
  );
}

/* ==========================================================================
   9. concurrency — two cancels racing must produce one refund
   ========================================================================== */
{
  const balanceBefore = await balance();
  const stockBefore = await stock();
  const order = await makeOrder();

  /* Two "requests" in the same connection can only be interleaved by the
     database itself, so this drives the real race: the second transaction
     blocks on the FOR UPDATE lock, then sees status = cancelled and stops. */
  const results = await Promise.allSettled([
    db.query(`select public.order_cancel($1, 'a', $2)`, [order.id, ADMIN]),
    db.query(`select public.order_cancel($1, 'b', $2)`, [order.id, ADMIN]),
  ]);

  const ok = results.filter((r) => r.status === "fulfilled").length;
  check("both concurrent cancels answer without an error", ok === 2, `${ok}/2`);

  const refunds = (await one(`select count(*)::int as n from public.wallet_transactions where order_id = $1 and kind = 'refund'`, [order.id])).n;
  check("two racing cancels produce exactly one refund row", refunds === 1, String(refunds));
  check("two racing cancels credit the wallet once", (await balance()) === balanceBefore, `${await balance()} vs ${balanceBefore}`);
  check("stock comes back once", (await stock()) === stockBefore, `${await stock()} vs ${stockBefore}`);
}

console.log(
  failed === 0
    ? "\nAll order-money checks hold. ✅"
    : `\n${failed} order-money check(s) FAILED. ❌`
);
process.exitCode = failed === 0 ? 0 : 1;
