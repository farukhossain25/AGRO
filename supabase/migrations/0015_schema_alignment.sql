-- 0015_schema_alignment.sql
--
-- Why this migration exists
-- -------------------------
-- The live database was built from an older generation of the schema than the
-- code in this repo. `/foisal` therefore failed for two independent reasons:
--
--   1. `service_role` had no table privileges at all (fixed in 0014), and
--   2. several tables were missing the columns the app writes, and kept
--      legacy NOT NULL columns the app never fills:
--
--        * banners        had `title` only — the panel writes title_bn,
--                         subtitle_bn, placement, is_active
--        * blog_posts     had `title/content/author` — the panel writes
--                         title_bn/content_bn/author_bn/cover/tag_bn/
--                         read_minutes/is_active/published_at
--        * hero_slides    had `image` — the storefront reads image_url,
--                         cta_*, text_position, overlay_opacity, starts_at …
--        * homepage_sections had (key, value) — the panel and the homepage
--                         need label_bn, is_visible, sort_order, config
--        * social_links   had no label_bn/icon
--        * reviews        was the "verified order review" design, while the
--                         storefront writes testimonials (name_bn, location_bn,
--                         rating, comment, is_approved)
--        * products.name, categories.name and coupons.discount_type/
--          discount_value are legacy twins the app never sets, so every INSERT
--          from the panel died on a NOT NULL violation.
--
-- Strategy: additive and non-destructive. The legacy columns are kept (some
-- DDL/triggers may still reference them) and simply given defaults, the modern
-- columns are added nullable-or-defaulted, and the legacy NOT NULLs that the
-- testimonial flow cannot satisfy are relaxed. Nothing is dropped, no data is
-- rewritten, and re-running the file is a no-op.

/* ------------------------------------------------------------- products --- */
-- `name` is the pre-Bangla twin of `name_bn`; the panel only sends `name_bn`.
alter table public.products alter column name set default '';

/* ----------------------------------------------------------- categories --- */
alter table public.categories alter column name set default '';

/* -------------------------------------------------------------- coupons --- */
-- Legacy twins of `type` / `value`. `discount_type` has a CHECK on
-- ('percent','fixed'), so the default must stay inside that set.
alter table public.coupons alter column discount_type set default 'percent';
alter table public.coupons alter column discount_value set default 0;

/* -------------------------------------------------------------- banners --- */
alter table public.banners
  add column if not exists title_bn text,
  add column if not exists subtitle_bn text,
  add column if not exists placement text not null default 'home_hero',
  add column if not exists is_active boolean not null default true;

alter table public.banners alter column title set default '';

update public.banners
   set title_bn = coalesce(nullif(title_bn, ''), nullif(title, '')),
       is_active = coalesce(active, true)
 where title_bn is null or is_active is null;

/* ----------------------------------------------------------- blog_posts --- */
alter table public.blog_posts
  add column if not exists title_bn text,
  add column if not exists excerpt_bn text,
  add column if not exists content_bn text,
  add column if not exists cover text,
  add column if not exists author_bn text,
  add column if not exists tag_bn text,
  add column if not exists read_minutes integer not null default 4,
  add column if not exists is_active boolean not null default true,
  add column if not exists published_at timestamptz not null default now();

alter table public.blog_posts
  alter column title set default '',
  alter column content set default '',
  alter column author set default '';

/* ---------------------------------------------------------- hero_slides --- */
alter table public.hero_slides
  add column if not exists subtitle_bn text,
  add column if not exists image_url text,
  add column if not exists image_mobile_url text,
  add column if not exists video_url text,
  add column if not exists alt_bn text,
  add column if not exists cta_label_bn text,
  add column if not exists cta_href text,
  add column if not exists secondary_label_bn text,
  add column if not exists secondary_href text,
  add column if not exists text_position text not null default 'left',
  add column if not exists text_tone text not null default 'light',
  add column if not exists overlay_opacity integer not null default 45,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

-- Rows created before this migration only carry the legacy `image`.
update public.hero_slides
   set image_url = coalesce(nullif(image_url, ''), nullif(image, ''))
 where image_url is null;

/* --------------------------------------------------------- social_links --- */
alter table public.social_links
  add column if not exists label_bn text,
  add column if not exists icon text;

/* --------------------------------------------------- homepage_sections ---- */
-- The table used to be a (key, value) bag; the panel reorders rows and the
-- homepage reads label_bn / is_visible / sort_order / config.
alter table public.homepage_sections
  add column if not exists label_bn text,
  add column if not exists is_visible boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists config jsonb not null default '{}'::jsonb;

update public.homepage_sections set label_bn = coalesce(label_bn, key) where label_bn is null;

/* -------------------------------------------------------------- reviews --- */
-- Storefront testimonials: anonymous, name + rating + comment, moderated by
-- `is_approved`. The legacy order-review columns stay, but they cannot be
-- mandatory any more — a public testimonial has no sub-order.
alter table public.reviews
  add column if not exists name_bn text,
  add column if not exists location_bn text,
  add column if not exists rating numeric(2, 1),
  add column if not exists comment text,
  add column if not exists is_approved boolean not null default true;

alter table public.reviews
  alter column user_id drop not null,
  alter column sub_order_id drop not null,
  alter column product_rating drop not null,
  alter column seller_rating drop not null;
