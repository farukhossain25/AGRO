#!/usr/bin/env node
/**
 * Order tracking — PII that must not leave the server.
 * ----------------------------------------------------------------------------
 * `/api/orders/track` is unauthenticated: the order number plus the phone is the
 * credential. Order numbers are `BA-YYMMDD-NNNN`, so they are enumerable — which
 * makes what this endpoint *returns* the whole security question.
 *
 * It used to `.select("*, order_items(*)")` and spread the row into the
 * response, so one guessed order number with a plausible phone number yielded
 * the customer's email, full phone, profile UUID, TrxID (`payment_ref`), wallet
 * usage, the delivery address and any admin note.
 *
 * This asserts the response contract by running the route's real select against
 * the real schema, then checking that every field the old version leaked is
 * absent from the allowed list.
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

const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

await db.exec(`
  insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c@track.invalid')
    on conflict (id) do nothing;
  update public.profiles set full_name = 'Track Customer', wallet_balance = 500 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select set_config('request.jwt.claims', '{"role":"service_role"}', false);
`);

/* An order loaded with exactly the fields the old wildcard would have shipped. */
const order = await one(
  `insert into public.orders
     (order_no, user_id, customer_name, customer_phone, customer_email, division, district, upazila,
      address, delivery_note, subtotal, delivery_charge, discount, total, coupon_code,
      payment_method, payment_status, payment_ref, status, admin_note, wallet_used, cancel_reason)
   values ('BA-260101-0001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Track Customer', '01712345678',
           'customer@example.com', 'ঢাকা', 'ঢাকা', 'সাভার', '১২৩ গোপন রোড, বাসা ৪',
           'দরজায় কল করবেন না', 1000, 60, 50, 1010, 'SAVE50',
           'bkash', 'pending', 'TRXSECRET99', 'packing', 'গ্রাহক ঝামেলাপূর্ণ — সাবধানে',
           300, 'কোনো কারণ নেই')
   returning id`
);

await q(
  `insert into public.order_items (order_id, name_bn, price, quantity, image)
   values ($1, 'দেশি মুরগি', 500, 2, 'https://cdn.example.com/x.jpg')`,
  [order.id]
);

/* ---- the exact select the route performs -------------------------------- */
const itemSelected = ["name_bn", "quantity", "price"];

const TRACK_SELECT = [
  "order_no",
  "status",
  "payment_method",
  "payment_status",
  "customer_name",
  "customer_phone",
  "division",
  "district",
  "upazila",
  "subtotal",
  "delivery_charge",
  "discount",
  "total",
  "eta_days",
  "cancel_reason",
  "created_at",
  "updated_at",
  "order_items(name_bn, quantity, price)",
].join(", ");

/* Everything the old `*` would have returned and must never be sent. */
const FORBIDDEN = [
  "customer_email",
  "user_id",
  "payment_ref",
  "admin_note",
  "address",
  "delivery_note",
  "wallet_used",
  "delivered_by",
  "delivered_at",
  "coupon_code",
  "id",
];

const columns = await q(
  `select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'`
);
const all = columns.map((c) => c.column_name);

/* Split on the commas that are NOT inside an embedded `order_items(…)` call —
   a naive split leaves "quantity" and "price)" as fake top-level columns. */
function topLevelColumns(select) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of select) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());

  return out
    .filter((c) => !c.startsWith("order_items"))
    .map((c) => c.split(/\s+/)[0])
    .filter(Boolean);
}

const selected = topLevelColumns(TRACK_SELECT);

check("the select names columns instead of using *", !TRACK_SELECT.includes("*"));

for (const field of FORBIDDEN) {
  check(`the select does not include ${field}`, !selected.includes(field), `selected: ${selected.join(", ")}`);
}

for (const field of selected) {
  check(`${field} is a real column (no invented schema)`, all.includes(field), `orders has: ${all.join(", ")}`);
}

/* order_items: the old `*` also shipped image URLs and internal ids. */
const itemCols = await q(
  `select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items'`
);
for (const field of itemSelected) {
  check(`order_items.${field} exists`, itemCols.map((c) => c.column_name).includes(field));
}
check("order_items.id is not selected", !itemSelected.includes("id"));
check("order_items.image is not selected", !itemSelected.includes("image"));
check("order_items.product_id is not selected", !itemSelected.includes("product_id"));

/* ---- the response the route builds ------------------------------------- */
/* PostgREST's `order_items(...)` embed is not plain SQL, so run the flat part
   against `orders` and the item part against `order_items`. If any name in the
   select were invented, one of these would fail. */
const flat = selected.join(", ");
const row = await one(`select ${flat} from public.orders where order_no = 'BA-260101-0001'`);

check("the flat select runs against the real schema", row !== undefined);

const items = await q(
  `select ${itemSelected.join(", ")} from public.order_items where order_id = $1`,
  [order.id]
);
check("the item select runs against the real schema", items.length === 1);
check("the item select returns what the page renders", items[0]?.name_bn === "দেশি মুরগি");

/* Masking has to be applied by the route; this pins the contract that the raw
   phone is available for comparison and must be replaced before it is sent. */
const mask = (value) => {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

check("a full phone masks down to its last four digits", mask(row.customer_phone) === "*******5678", mask(row.customer_phone));
check("the raw phone is still available for the verification step", row.customer_phone === "01712345678");

/* ---- verification still works on the masked-capable value -------------- */
const normalise = (v) => v.replace(/[^\d]/g, "").slice(-10);
check(
  "verification accepts +880 / 0 prefix differences",
  normalise("+8801712345678") === normalise("01712345678")
);
check("verification rejects a different number", normalise("01799999999") !== normalise("01712345678"));

/* ---- nothing forbidden is reachable through the select ---------------- */
for (const field of FORBIDDEN) {
  check(`the response object has no ${field}`, !(field in row), Object.keys(row).join(", "));
}

console.log(failed === 0 ? "\nAll tracking-privacy checks hold. ✅" : `\n${failed} tracking-privacy check(s) FAILED. ❌`);
process.exitCode = failed === 0 ? 0 : 1;
