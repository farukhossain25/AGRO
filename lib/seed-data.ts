/**
 * Static catalogue derived from data/seed.mjs.
 *
 * Used as a resilient fallback when the database is unreachable (offline
 * development, preview environments, or a Supabase outage). Production reads
 * always prefer Postgres — see lib/data.ts.
 */
import * as raw from "../data/seed.mjs";
import type {
  BlogPost,
  Category,
  Combo,
  Coupon,
  DeliveryZone,
  Farmer,
  Package,
  Product,
  Review,
} from "./types";

/** Deterministic UUID-shaped id so SSR and client renders agree. */
export function stableId(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193;
    h2 = (h2 + c * (i + 7)) * 0x85ebca6b;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const a = hex(h1);
  const b = hex(h2);
  const c = hex(h1 ^ h2);
  const d = hex((h1 * 31) ^ (h2 * 17));
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${c.slice(0, 3)}-${c.slice(3)}${d.slice(0, 4)}`;
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const seedCategories: Category[] = (raw.seedCategories as any[]).map((c, i) => ({
  id: stableId(`cat:${c.slug}`),
  slug: c.slug,
  name_bn: c.name_bn,
  name_en: c.name_en,
  description_bn: c.description_bn ?? null,
  icon: c.icon ?? "🌿",
  image: c.image ?? null,
  sort_order: c.sort_order ?? i + 1,
  is_active: true,
  created_at: daysAgo(60),
}));

export const seedProducts: Product[] = (raw.seedProducts as any[]).map((p, i) => {
  const cat = seedCategories.find((c) => c.slug === p.cat);
  return {
    id: stableId(`product:${p.slug}`),
    slug: p.slug,
    category_id: cat?.id ?? null,
    name_bn: p.name_bn,
    name_en: p.name_en,
    description_bn: p.desc ?? null,
    unit: p.unit,
    unit_en: p.unit === "কেজি" ? "kg" : p.unit === "ডজন" ? "dozen" : p.unit === "লিটার" ? "litre" : "pack",
    price: p.price,
    compare_price: p.compare_price ?? null,
    stock: p.stock,
    image: p.image ?? null,
    images: p.image ? [p.image] : [],
    farm_source_bn: p.farm ?? null,
    harvest_date: new Date(Date.now() - (i % 3) * 86_400_000).toISOString().slice(0, 10),
    badge_bn: p.badge_bn ?? null,
    rating: [4.5, 4.7, 4.8, 5.0][i % 4],
    review_count: [12, 25, 41, 8, 63][i % 5],
    is_featured: Boolean(p.featured),
    is_active: true,
    created_at: daysAgo(30 - (i % 20)),
    updated_at: null,
  };
});

export const seedCombos: Combo[] = (raw.seedCombos as any[]).map((c, i) => ({
  id: stableId(`combo:${c.slug}`),
  slug: c.slug,
  name_bn: c.name_bn,
  name_en: c.name_en ?? null,
  description_bn: c.description_bn ?? null,
  kind: c.kind,
  price: c.price,
  original_price: c.original_price ?? null,
  contents: c.contents ?? [],
  image: c.image ?? null,
  is_active: true,
  sort_order: c.sort_order ?? i + 1,
}));

export const seedPackages: Package[] = (raw.seedPackages as any[]).map((p, i) => ({
  id: stableId(`package:${p.slug}`),
  slug: p.slug,
  name_bn: p.name_bn,
  name_en: p.name_en ?? null,
  members_label: p.members_label,
  members_min: p.members_min,
  members_max: p.members_max,
  price_monthly: p.price_monthly,
  saving_label: p.saving_label ?? null,
  features: p.features ?? [],
  image: p.image ?? null,
  is_popular: Boolean(p.is_popular),
  is_active: true,
  sort_order: p.sort_order ?? i + 1,
}));

export const seedFarmers: Farmer[] = (raw.seedFarmers as any[]).map((f, i) => ({
  id: stableId(`farmer:${f.name_bn}`),
  name_bn: f.name_bn,
  location_bn: f.location_bn ?? null,
  specialty_bn: f.specialty_bn ?? null,
  story_bn: f.story_bn ?? null,
  years: f.years ?? 10,
  image: f.image ?? null,
  is_active: true,
  sort_order: f.sort_order ?? i + 1,
}));

export const seedReviews: Review[] = (raw.seedReviews as any[]).map((r, i) => {
  const slugs = ["palong-shak", "rui-mach", "himsagar-aam", "deshi-murgi-full", "sundarban-modhu", "ilish"];
  const product = seedProducts.find((p) => p.slug === slugs[i]);
  return {
    id: stableId(`review:${r.name_bn}:${i}`),
    product_id: product?.id ?? null,
    user_id: null,
    name_bn: r.name_bn,
    location_bn: r.location_bn ?? null,
    rating: r.rating,
    comment: r.comment,
    is_approved: true,
    created_at: daysAgo(i * 3 + 1),
  };
});

export const seedBlogPosts: BlogPost[] = (raw.seedPosts as any[]).map((p, i) => ({
  id: stableId(`post:${p.slug}`),
  slug: p.slug,
  title_bn: p.title_bn,
  excerpt_bn: p.excerpt_bn ?? null,
  content_bn: p.content_bn,
  cover: p.cover ?? null,
  author_bn: "বিশ্বাস এগ্রো টিম",
  tag_bn: p.tag_bn,
  read_minutes: p.read_minutes,
  published_at: daysAgo(i * 4 + 2),
  is_active: true,
}));

export const seedZones: DeliveryZone[] = (raw.seedZones as any[]).map((z, i) => ({
  id: stableId(`zone:${z.district}`),
  district: z.district,
  district_en: z.district_en ?? null,
  division: z.division,
  scope: z.scope,
  charge: z.charge,
  free_over: z.free_over ?? null,
  eta_days: z.eta_days,
  is_active: true,
}));

export const seedCoupons: Coupon[] = (raw.seedCoupons as any[]).map((c) => ({
  id: stableId(`coupon:${c.code}`),
  code: c.code,
  type: c.type,
  value: c.value,
  min_order: c.min_order ?? 0,
  max_discount: c.max_discount ?? null,
  usage_limit: c.usage_limit ?? null,
  used_count: 0,
  expires_at: new Date(Date.now() + 86_400_000 * 180).toISOString(),
  is_active: true,
}));

export const seedBanners = (raw.seedBanners as any[]).map((b, i) => ({
  id: stableId(`banner:${i}`),
  title_bn: b.title_bn,
  subtitle_bn: b.subtitle_bn ?? null,
  image: b.image ?? null,
  link: b.link ?? "/products",
  placement: "home_hero",
  is_active: true,
  sort_order: i + 1,
}));
