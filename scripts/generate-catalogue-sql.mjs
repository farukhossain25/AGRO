/**
 * Generates SQL that puts the demo catalogue into the real database.
 *
 * Why: the storefront has been drawing this catalogue from lib/seed-data.ts
 * because every server-side query failed (service_role had no table grants).
 * Once the grants are back, an empty `products` table would make the shop look
 * empty. This script prints the INSERTs that make the same catalogue real, so
 * the owner can edit it from /foisal instead of only seeing a fallback.
 *
 *   node scripts/generate-catalogue-sql.mjs > /tmp/catalogue.sql
 *
 * NOT part of the running app — a one-off data tool.
 */
import * as seed from "../data/seed.mjs";

const q = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
};
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;

/* Seed category slug → the slug the live `categories` table actually uses. */
const CATEGORY_SLUGS = {
  shakshobji: "vegetables",
  folmul: "fruits",
  "deshi-dim": "eggs",
  mangsho: "meat",
  mach: "fish",
  "dudh-dudhgiyo": "dairy",
  "chal-dal-mosla": "grocery",
  "modhu-organic": "organic",
  "krishi-upokoron": "krishi-upokoron",
};

/* Resolve category ids by slug so the SQL also works on a freshly migrated DB. */
const categoryRef = (seedCat) =>
  `(select id from public.categories where slug = ${q(CATEGORY_SLUGS[seedCat] ?? seedCat)})`;

const unitEn = (unit) =>
  unit === "কেজি" ? "kg" : unit === "ডজন" ? "dozen" : unit === "লিটার" ? "litre" : "pack";

const out = [];

/* ---------------------------------------------------------------- category */
if (!seed.seedCategories.some((c) => c.slug === "krishi-upokoron")) {
  // nothing missing
} else {
  const agri = seed.seedCategories.find((c) => c.slug === "krishi-upokoron");
  out.push(
    `insert into public.categories (id, name, name_bn, name_en, slug, icon, image, description, description_bn, sort_order, active, is_active)
values (${q("b1d2c3e4-5f60-4a71-8b92-c3d4e5f60718")}, ${q(agri.name_bn)}, ${q(agri.name_bn)}, ${q(agri.name_en)}, ${q(agri.slug)}, ${q(agri.icon)}, ${q(agri.image ?? "")}, ${q(agri.description_bn ?? "")}, ${q(agri.description_bn ?? "")}, 9, true, true)
on conflict (slug) do nothing;`
  );
}

/* ---------------------------------------------------------------- products */
const productRows = seed.seedProducts.map((p, i) => {
  const id = `c0de0000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  const created = new Date(Date.now() - (30 - (i % 20)) * 86_400_000).toISOString();
  const harvest = new Date(Date.now() - (i % 3) * 86_400_000).toISOString().slice(0, 10);
  return `(${[
    q(id),
    q(p.name_bn), // legacy NOT NULL `name`
    q(p.name_bn),
    q(p.name_en),
    q(p.slug),
    categoryRef(p.cat),
    q(p.price),
    q(p.unit),
    q(unitEn(p.unit)),
    q(p.desc ?? ""),
    q(p.desc ?? ""),
    q(p.image ?? ""),
    json(p.image ? [p.image] : []),
    q(p.stock),
    q(p.farm ?? ""),
    q(p.farm ?? ""),
    q(p.badge_bn ?? ""),
    q(p.badge_bn ?? ""),
    q(harvest),
    q(Boolean(p.featured)),
    q(true),
    q([4.5, 4.7, 4.8, 5.0][i % 4]),
    q([12, 25, 41, 8, 63][i % 5]),
    q(p.compare_price ?? null),
    q(created),
  ].join(", ")})`;
});

// descriptions are backfilled separately (batch 2)
out.push(`insert into public.products
  (id, name, name_bn, name_en, slug, category_id, price, unit, unit_en, description, description_bn,
   image, images, stock, farm_source, farm_source_bn, badge, badge_bn,
   harvest_date, is_featured, is_active, rating, review_count, compare_price, created_at)
values
${productRows.join(",\n")}
on conflict (slug) do nothing;`);

/* ------------------------------------------------------------------ combos */
const comboRows = seed.seedCombos.map((c, i) => {
  const id = `c0de1000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  return `(${[
    q(id),
    q(c.slug),
    q(c.name_bn),
    q(c.name_en ?? ""),
    q(c.description_bn ?? ""),
    q(c.kind),
    q(c.price),
    q(c.original_price ?? null),
    json(c.contents ?? []),
    q(c.image ?? ""),
    q(true),
    q(c.sort_order ?? i + 1),
  ].join(", ")})`;
});

out.push(`insert into public.combos
  (id, slug, name_bn, name_en, description_bn, kind, price, original_price, contents, image, is_active, sort_order)
values
${comboRows.join(",\n")}
on conflict (slug) do nothing;`);

/* ---------------------------------------------------------------- packages */
const packageRows = seed.seedPackages.map((p, i) => {
  const id = `c0de2000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  return `(${[
    q(id),
    q(p.slug),
    q(p.name_bn),
    q(p.name_en ?? ""),
    q(p.members_label),
    q(p.members_min),
    q(p.members_max),
    q(p.price_monthly),
    q(p.saving_label ?? ""),
    json(p.features ?? []),
    q(p.image ?? ""),
    q(Boolean(p.is_popular)),
    q(true),
    q(p.sort_order ?? i + 1),
  ].join(", ")})`;
});

out.push(`insert into public.packages
  (id, slug, name_bn, name_en, members_label, members_min, members_max, price_monthly, saving_label, features, image, is_popular, is_active, sort_order)
values
${packageRows.join(",\n")}
on conflict (slug) do nothing;`);

/* ----------------------------------------------------------------- farmers */
const farmerRows = seed.seedFarmers.map((f, i) => {
  const id = `c0de3000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  return `(${[
    q(id),
    q(f.name_bn),
    q(f.name_en || f.name_bn), // farmers.name_en (seed only carries the Bangla name)
    q(f.image ?? ""),
    q(true),
    q(f.sort_order ?? i + 1),
  ].join(", ")})`;
});
out.push(`insert into public.farmers (id, name_bn, name_en, image, is_active, sort_order)
values
${farmerRows.join(",\n")}
on conflict (id) do nothing;`);

/* ---------------------------------------------------------- delivery zones */
const zoneRows = seed.seedZones.map((z, i) => {
  const id = `c0de4000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  return `(${[
    q(id),
    q(z.district),
    q(z.district_en ?? ""),
    q(z.division),
    q(z.scope),
    q(z.charge),
    q(z.free_over ?? null),
    q(String(z.eta_days)),
    q(true),
  ].join(", ")})`;
});
out.push(`insert into public.delivery_zones (id, district, district_en, division, scope, charge, free_over, eta_days, is_active)
values
${zoneRows.join(",\n")}
on conflict (id) do nothing;`);

/* ----------------------------------------------------------------- coupons */
const couponRows = seed.seedCoupons.map((c, i) => {
  const id = `c0de5000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  const expires = new Date(Date.now() + 180 * 86_400_000).toISOString();
  return `(${[
    q(id),
    q(c.code),
    q(c.type === "percent" ? "percent" : "fixed"), // discount_type
    q(c.type === "percent" ? "percent" : "fixed"), // type
    q(c.value),
    q(c.value),
    q(c.min_order ?? 0),
    q(c.max_discount ?? null),
    q(c.usage_limit ?? null),
    q(0),
    q(expires.slice(0, 10)),
    q(expires),
    q(true),
    q(true),
  ].join(", ")})`;
});
out.push(`insert into public.coupons
  (id, code, discount_type, type, discount_value, value, min_order, max_discount, usage_limit, used_count,
   expiry_date, expires_at, active, is_active)
values
${couponRows.join(",\n")}
on conflict (id) do nothing;`);

/* ----------------------------------------------------------------- banners */
const bannerRows = seed.seedBanners.map((b, i) => {
  const id = `c0de6000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  return `(${[q(id), q(b.title_bn), q(b.image ?? ""), q(b.link ?? "/products"), q(true), q(i + 1)].join(", ")})`;
});
out.push(`insert into public.banners (id, title, image, link, active, sort_order)
values
${bannerRows.join(",\n")}
on conflict (id) do nothing;`);

console.log(out.join("\n\n"));
