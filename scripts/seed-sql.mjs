/**
 * Emits seed data as a single SQL script (for Supabase SQL Editor / connector).
 *   node scripts/seed-sql.mjs > supabase/seed.sql
 *
 * Mirrors scripts/seed.mjs exactly — same rows, same order, same slug joins.
 */
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

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "null" : String(Number(v)));
const b = (v) => (v ? "true" : "false");
const j = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const out = [];
out.push(`-- বিশ্বাস এগ্রো / Biswas Agro — seed data`);
out.push(`-- Generated from data/seed.mjs. Idempotent.`);
out.push(`begin;\n`);

const unitEn = (u) => (u === "কেজি" ? "kg" : u === "ডজন" ? "dozen" : u === "লিটার" ? "litre" : "pack");

/* ---------------------------------------------------------- categories */
out.push(`-- 1. categories`);
const catValues = seedCategories
  .map(
    (c, i) =>
      `  (${q(c.slug)}, ${q(c.name_bn)}, ${q(c.name_en)}, ${q(c.description_bn ?? null)}, ${q(c.icon ?? "🌿")}, ${i + 1}, true)`
  )
  .join(",\n");

out.push(`insert into categories (slug, name_bn, name_en, description_bn, icon, sort_order, is_active) values
${catValues}
on conflict (slug) do update set
  name_bn = excluded.name_bn,
  name_en = excluded.name_en,
  description_bn = excluded.description_bn,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;\n`);

/* ------------------------------------------------------------ products */
out.push(`-- 2. products`);
const today = new Date();
const prodValues = seedProducts
  .map((p, i) => {
    const harvest = new Date(today);
    harvest.setDate(today.getDate() - (i % 3));
    return `  (${q(p.slug)}, (select id from categories where slug = ${q(p.cat)}), ${q(p.name_bn)}, ${q(p.name_en)}, ${q(p.desc)}, ${q(p.unit)}, ${q(unitEn(p.unit))}, ${n(p.price)}, ${n(p.compare_price)}, ${n(p.stock)}, ${q(p.image)}, array[${q(p.image)}]::text[], ${q(p.farm)}, ${q(harvest.toISOString().slice(0, 10))}, ${q(p.badge_bn ?? null)}, ${n([4.5, 4.7, 4.8, 5.0][i % 4])}, ${n([12, 25, 41, 8, 63][i % 5])}, ${b(p.featured)}, true)`;
  })
  .join(",\n");

out.push(`insert into products (slug, category_id, name_bn, name_en, description_bn, unit, unit_en, price, compare_price, stock, image, images, farm_source_bn, harvest_date, badge_bn, rating, review_count, is_featured, is_active) values
${prodValues}
on conflict (slug) do update set
  category_id = excluded.category_id,
  name_bn = excluded.name_bn,
  name_en = excluded.name_en,
  description_bn = excluded.description_bn,
  unit = excluded.unit,
  unit_en = excluded.unit_en,
  price = excluded.price,
  compare_price = excluded.compare_price,
  stock = excluded.stock,
  image = excluded.image,
  images = excluded.images,
  farm_source_bn = excluded.farm_source_bn,
  badge_bn = excluded.badge_bn,
  rating = excluded.rating,
  review_count = excluded.review_count,
  is_featured = excluded.is_featured,
  is_active = true;\n`);

/* -------------------------------------------------------------- combos */
out.push(`-- 3. combos`);
const comboValues = seedCombos
  .map((c) => {
    const cols = Object.keys(c);
    return `  ${cols.map((k) => render(c[k])).join(", ")}`;
  })
  .join(",\n");
out.push(`insert into combos (${Object.keys(seedCombos[0]).join(", ")}, is_active) values
${seedCombos.map((c) => `  ${Object.entries(c).map(([k, v]) => render(k === "items" ? JSON.stringify(v) : v)).join(", ")}, true`).join(",\n")}
on conflict (slug) do update set ${Object.keys(seedCombos[0]).filter((k) => k !== "slug").map((k) => `${k} = excluded.${k}`).join(", ")}, is_active = true;\n`);

function render(v) {
  if (Array.isArray(v)) {
    // jsonb array of objects (combo items / package contents)
    if (v.some((x) => typeof x === "object")) return `${j(v)}`;
    return `array[${v.map(q).join(",")}]::text[]`;
  }
  if (typeof v === "number") return n(v);
  if (typeof v === "boolean") return b(v);
  if (v && typeof v === "object") return j(v);
  return q(v);
}

/* ------------------------------------------------------------ packages */
out.push(`-- 4. packages`);
const pkgKeys = Object.keys(seedPackages[0]);
// packages.features is jsonb (not text[]) — render arrays there as jsonb
out.push(`insert into packages (${pkgKeys.join(", ")}) values
${seedPackages
  .map((p) => `  ${pkgKeys.map((k) => (Array.isArray(p[k]) ? j(p[k]) : render(p[k]))).join(", ")}`)
  .join(",\n")}
on conflict (slug) do update set ${pkgKeys.filter((k) => k !== "slug").map((k) => `${k} = excluded.${k}`).join(", ")};\n`);

/* -------------------------------------------------------- delivery zones */
out.push(`-- 5. delivery zones`);
const zoneKeys = Object.keys(seedZones[0]);
out.push(`insert into delivery_zones (${zoneKeys.join(", ")}) values
${seedZones.map((z) => `  ${zoneKeys.map((k) => render(z[k])).join(", ")}`).join(",\n")}
on conflict (district) do update set ${zoneKeys.filter((k) => k !== "district").map((k) => `${k} = excluded.${k}`).join(", ")};\n`);

/* ------------------------------------------------------------- coupons */
out.push(`-- 6. coupons`);
out.push(`insert into coupons (code, type, value, min_order, max_discount, usage_limit, expires_at, is_active) values
${seedCoupons
  .map(
    (c) =>
      `  (${q(c.code)}, ${q(c.type)}, ${n(c.value)}, ${n(c.min_order ?? 0)}, ${n(c.max_discount)}, ${n(c.usage_limit)}, now() + interval '180 days', true)`
  )
  .join(",\n")}
on conflict (code) do update set
  type = excluded.type,
  value = excluded.value,
  min_order = excluded.min_order,
  max_discount = excluded.max_discount,
  usage_limit = excluded.usage_limit,
  expires_at = excluded.expires_at,
  is_active = true;\n`);

/* ------------------------------------------------------------- farmers */
out.push(`-- 7. farmers`);
out.push(`delete from farmers where name_bn in (${seedFarmers.map((f) => q(f.name_bn)).join(", ")});`);
out.push(`insert into farmers (name_bn, location_bn, specialty_bn, story_bn, years, image, is_active, sort_order) values
${seedFarmers
  .map((f) => `  (${q(f.name_bn)}, ${q(f.location_bn)}, ${q(f.specialty_bn)}, ${q(f.story_bn)}, ${n(f.years)}, ${q(f.image)}, true, ${n(f.sort_order)})`)
  .join(",\n")};\n`);

/* ------------------------------------------------------------- reviews */
out.push(`-- 8. reviews`);
const reviewSlugs = ["palong-shak", "rui-mach", "himsagar-aam", "deshi-murgi-full", "sundarban-modhu", "ilish"];
out.push(`delete from reviews where user_id is null;`);
out.push(`insert into reviews (product_id, name_bn, location_bn, rating, comment, is_approved, created_at) values
${seedReviews
  .map(
    (r, i) =>
      `  ((select id from products where slug = ${q(reviewSlugs[i])}), ${q(r.name_bn)}, ${q(r.location_bn)}, ${n(r.rating)}, ${q(r.comment)}, true, now() - interval '${i * 3 + 1} days')`
  )
  .join(",\n")};\n`);

/* ----------------------------------------------------------- blog posts */
out.push(`-- 9. blog posts`);
out.push(`insert into blog_posts (slug, title_bn, excerpt_bn, content_bn, cover, author_bn, tag_bn, read_minutes, is_active) values
${seedPosts
  .map(
    (p) =>
      `  (${q(p.slug)}, ${q(p.title_bn)}, ${q(p.excerpt_bn)}, ${q(p.content_bn)}, ${q(p.cover)}, ${q("বিশ্বাস এগ্রো টিম")}, ${q(p.tag_bn)}, ${n(p.read_minutes)}, true)`
  )
  .join(",\n")}
on conflict (slug) do update set
  title_bn = excluded.title_bn,
  excerpt_bn = excluded.excerpt_bn,
  content_bn = excluded.content_bn,
  cover = excluded.cover,
  tag_bn = excluded.tag_bn,
  read_minutes = excluded.read_minutes,
  is_active = true;\n`);

/* ------------------------------------------------------------- banners */
out.push(`-- 10. banners`);
out.push(`delete from banners;`);
out.push(`insert into banners (title_bn, subtitle_bn, image, link, placement, is_active, sort_order) values
${seedBanners
  .map(
    (bn) =>
      `  (${q(bn.title_bn)}, ${q(bn.subtitle_bn ?? null)}, ${q(bn.image ?? null)}, ${q(bn.link ?? "/products")}, 'home_hero', true, ${n(bn.sort_order)})`
  )
  .join(",\n")};\n`);

/* ------------------------------------------------------------ settings */
out.push(`-- 11. settings`);
out.push(`insert into settings (key, value) values
  ('store', ${j({ name: "বিশ্বাস এগ্রো", phone: "+8801700000000", email: "hello@bishwasagro.com" })}),
  ('delivery', ${j({ inside_dhaka: 60, outside_dhaka: 120, free_over: 1200 })})
on conflict (key) do update set value = excluded.value, updated_at = now();\n`);

out.push(`commit;`);

process.stdout.write(out.join("\n"));
