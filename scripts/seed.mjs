/**
 * Idempotent seed — safe to re-run.
 *   node --env-file=.env.local scripts/seed.mjs
 */
import { createClient } from "@supabase/supabase-js";
import {
  seedBanners,
  seedCategories,
  seedCombos,
  seedCoupons,
  seedFarmers,
  seedPackages,
  seedPosts,
  seedProducts,
  seedReviews,
  seedZones,
} from "../data/seed.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const log = (msg) => console.log(`  ${msg}`);
let failures = 0;

async function upsert(table, rows, onConflict = "slug") {
  if (!rows.length) return [];
  const { data, error } = await db.from(table).upsert(rows, { onConflict }).select();
  if (error) {
    failures++;
    console.error(`✖ ${table}: ${error.message}`);
    return [];
  }
  log(`✓ ${table.padEnd(20)} ${data.length} rows`);
  return data;
}

async function main() {
  console.log("\n🌱 Seeding বিশ্বাস এগ্রো …\n");

  /* 1. categories */
  const categories = await upsert(
    "categories",
    seedCategories.map((c, i) => ({
      ...c,
      sort_order: c.sort_order ?? i + 1,
      is_active: true,
    }))
  );
  const catIdBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  /* 2. products */
  const today = new Date();
  const products = await upsert(
    "products",
    seedProducts.map((p, i) => {
      const harvest = new Date(today);
      harvest.setDate(today.getDate() - (i % 3));
      return {
        slug: p.slug,
        category_id: catIdBySlug[p.cat] ?? null,
        name_bn: p.name_bn,
        name_en: p.name_en,
        description_bn: p.desc,
        unit: p.unit,
        unit_en: p.unit === "কেজি" ? "kg" : p.unit === "ডজন" ? "dozen" : p.unit === "লিটার" ? "litre" : "pack",
        price: p.price,
        compare_price: p.compare_price,
        stock: p.stock,
        image: p.image,
        images: [p.image],
        farm_source_bn: p.farm,
        harvest_date: harvest.toISOString().slice(0, 10),
        badge_bn: p.badge_bn ?? null,
        rating: [4.5, 4.7, 4.8, 5.0][i % 4],
        review_count: [12, 25, 41, 8, 63][i % 5],
        is_featured: Boolean(p.featured),
        is_active: true,
      };
    })
  );
  const productIdBySlug = Object.fromEntries(products.map((p) => [p.slug, p.id]));

  /* 3. combos */
  await upsert(
    "combos",
    seedCombos.map((c) => ({ ...c, is_active: true }))
  );

  /* 4. packages */
  await upsert(
    "packages",
    seedPackages.map((p) => ({ ...p, is_active: true }))
  );

  /* 5. delivery zones */
  await upsert(
    "delivery_zones",
    seedZones.map((z) => ({ ...z, is_active: true })).concat(
      // every remaining district gets the default outside-Dhaka rate
      []
    ),
    "district"
  );

  /* 6. coupons */
  await upsert(
    "coupons",
    seedCoupons.map((c) => ({
      ...c,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
      is_active: true,
    })),
    "code"
  );

  /* 7. farmers */
  const { error: farmerErr } = await db.from("farmers").upsert(
    seedFarmers.map((f) => ({ ...f, is_active: true })),
    { onConflict: "name_bn", ignoreDuplicates: false }
  );
  if (farmerErr) {
    // name_bn is not unique — fall back to insert-if-empty
    const { count } = await db.from("farmers").select("id", { count: "exact", head: true });
    if (!count) await db.from("farmers").insert(seedFarmers.map((f) => ({ ...f, is_active: true })));
    log(`✓ farmers (fallback insert)`);
  } else {
    log("✓ farmers");
  }

  /* 8. reviews — needs product ids */
  const reviewRows = seedReviews.map((r, i) => ({
    product_id: productIdBySlug[["palong-shak", "rui-mach", "himsagar-aam", "deshi-murgi-full", "sundarban-modhu", "ilish"][i]] ?? null,
    name_bn: r.name_bn,
    location_bn: r.location_bn,
    rating: r.rating,
    comment: r.comment,
    is_approved: true,
  }));
  const { count: reviewCount } = await db.from("reviews").select("id", { count: "exact", head: true });
  if (!reviewCount) {
    const { error } = await db.from("reviews").insert(reviewRows);
    if (error) console.error("✖ reviews:", error.message);
    else log(`✓ reviews              ${reviewRows.length} rows`);
  } else log(`• reviews already present (${reviewCount})`);

  /* 9. blog posts */
  await upsert(
    "blog_posts",
    seedPosts.map((p) => ({
      slug: p.slug,
      title_bn: p.title_bn,
      excerpt_bn: p.excerpt_bn,
      content_bn: p.content_bn,
      cover: p.cover,
      author_bn: "বিশ্বাস এগ্রো টিম",
      tag_bn: p.tag_bn,
      read_minutes: p.read_minutes,
      is_active: true,
    }))
  );

  /* 10. banners */
  const { count: bannerCount } = await db.from("banners").select("id", { count: "exact", head: true });
  if (!bannerCount) {
    const { error } = await db.from("banners").insert(seedBanners);
    if (error) console.error("✖ banners:", error.message);
    else log(`✓ banners              ${seedBanners.length} rows`);
  }

  /* 11. settings */
  const { error: settingsErr } = await db.from("settings").upsert(
    [
      { key: "store", value: { name: "বিশ্বাস এগ্রো", phone: "+8801700000000", email: "hello@bishwasagro.com" } },
      { key: "delivery", value: { inside_dhaka: 60, outside_dhaka: 150, free_over: 1200 } },
    ],
    { onConflict: "key" }
  );
  if (settingsErr) console.error("✖ settings:", settingsErr.message);
  else log("✓ settings");

  console.log(
    failures
      ? `\n⚠️  Seed finished with ${failures} error(s).\n`
      : "\n✅ Seed complete.\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
