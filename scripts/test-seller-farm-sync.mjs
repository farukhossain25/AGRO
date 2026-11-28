#!/usr/bin/env node
/**
 * Seller ⇄ farm profile sync (migration 33).
 * ----------------------------------------------------------------------------
 * The reported bug: a seller fills name/address while applying, the admin
 * approves, then the admin edits the seller's details from the panel — and only
 * the live page shows the edit. Every other page (/market/<slug>, /farm, the
 * seller's own dashboard) kept showing what the seller typed, because they read
 * `sellers` while /live/farms reads `farms`.
 *
 * Migration 33 makes `sellers` the source of truth and mirrors it into `farms`,
 * with a guarded reverse trigger so an admin edit made on the farm row lands on
 * the seller row too. Both directions are checked here, plus the two things
 * that must NOT happen: touching the farm's own columns, and looping forever.
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

const SELLER_USER = "11111111-1111-4111-8111-111111111111";

await db.exec(`
  insert into auth.users (id, email) values ('${SELLER_USER}', 'seller@test.invalid')
  on conflict (id) do nothing;
`);

/* One farm + one seller, linked. Values deliberately differ from each other so
   a stale read is visible rather than accidentally equal. */
const farm = await one(`
  insert into public.farms (slug, name_bn, type, division, district, address_bn, cover, description_bn)
  values ('test-farm', 'পুরোনো খামারের নাম', 'vegetables', 'ঢাকা', 'ঢাকা', 'পুরোনো ঠিকানা',
          'https://cdn.example.com/cover.jpg', 'অ্যাডমিনের নিজের লেখা বর্ণনা')
  returning id
`);

const seller = await one(`
  insert into public.sellers (user_id, slug, name_bn, phone, farm_id, division, district,
                              farm_address_bn, product_types)
  values ($1, 'test-seller', 'সেলারের নাম', '01700000000', $2, 'খুলনা', 'খুলনা',
          'সেলারের দেওয়া ঠিকানা', array['dairy'])
  returning id
`, [SELLER_USER, farm.id]);

/* The insert above already differs from the farm row, but the trigger only
   fires on UPDATE — that is intentional, `ensureSellerFarm` owns creation.
   Bring them in line to start from a clean, consistent state. */
await db.exec(`
  update public.farms
     set name_bn = 'সেলারের নাম', division = 'খুলনা', district = 'খুলনা',
         address_bn = 'সেলারের দেওয়া ঠিকানা', type = 'dairy'
   where id = '${farm.id}'
`);

const farmRow = () => one(`select * from public.farms where id = $1`, [farm.id]);
const sellerRow = () => one(`select * from public.sellers where id = $1`, [seller.id]);

/* ==========================================================================
   1. seller → farm (the seller edits their own details from /seller)
   ========================================================================== */
{
  const before = await farmRow();

  await db.exec(`
    update public.sellers
       set name_bn = 'নতুন নাম', district = 'সাতক্ষীরা', farm_address_bn = 'নতুন ঠিকানা',
           product_types = array['fish']
     where id = '${seller.id}'
  `);

  const after = await farmRow();
  check("seller edit reaches the farm name", after.name_bn === "নতুন নাম", after.name_bn);
  check("seller edit reaches the farm district", after.district === "সাতক্ষীরা", after.district);
  check("seller edit reaches the farm address", after.address_bn === "নতুন ঠিকানা", after.address_bn);
  check("product_types maps to the farm type", after.type === "fish", after.type);
  check("farm.updated_at moves with the edit", new Date(after.updated_at) >= new Date(before.updated_at));
}

/* ==========================================================================
   2. farm's own columns are never touched by the mirror
   ========================================================================== */
{
  const row = await farmRow();
  check(
    "the admin's cover survives a seller edit",
    row.cover === "https://cdn.example.com/cover.jpg",
    String(row.cover)
  );
  check(
    "the admin's description survives a seller edit",
    row.description_bn === "অ্যাডমিনের নিজের লেখা বর্ণনা",
    String(row.description_bn)
  );
}

/* ==========================================================================
   3. farm → seller (the admin edits the farm from /foisal/farms)
   ========================================================================== */
{
  await db.exec(`
    update public.farms
       set name_bn = 'অ্যাডমিনের ঠিক করা নাম', district = 'যশোর'
     where id = '${farm.id}'
  `);

  const after = await sellerRow();
  check("admin edit reaches the seller name", after.name_bn === "অ্যাডমিনের ঠিক করা নাম", after.name_bn);
  check("admin edit reaches the seller district", after.district === "যশোর", after.district);
}

/* ==========================================================================
   4. no infinite ping-pong
   ========================================================================== */
{
  /* Each trigger fires the other, so the only thing stopping a loop is that
     both sides refuse to write when nothing actually changed. Prove that:
     set a value, and the two rows must converge in ONE round trip rather than
     oscillating or blowing the stack. */
  let threw = null;
  try {
    await db.exec(`
      update public.sellers set name_bn = 'লুপ পরীক্ষা', district = 'বরিশাল'
       where id = '${seller.id}'
    `);
  } catch (e) {
    threw = e;
  }

  check("a seller update does not recurse", threw === null, threw?.message);

  const f = await farmRow();
  const s = await sellerRow();
  check("name settled on both sides", f.name_bn === "লুপ পরীক্ষা" && s.name_bn === "লুপ পরীক্ষা",
    `farm=${f.name_bn} seller=${s.name_bn}`);
  check("district settled on both sides", f.district === "বরিশাল" && s.district === "বরিশাল",
    `farm=${f.district} seller=${s.district}`);
}

/* ==========================================================================
   5. unrelated columns cause no write at all
   ========================================================================== */
{
  const before = await farmRow();
  await db.exec(`update public.sellers set commission_percent = 12 where id = '${seller.id}'`);
  const after = await farmRow();
  check(
    "an unrelated seller edit does not touch the farm",
    after.updated_at.getTime() === before.updated_at.getTime(),
    `${after.updated_at} vs ${before.updated_at}`
  );
}

console.log(
  failed === 0
    ? "\nAll seller⇄farm sync checks hold. ✅"
    : `\n${failed} check(s) failed. ❌`
);
process.exit(failed === 0 ? 0 : 1);
