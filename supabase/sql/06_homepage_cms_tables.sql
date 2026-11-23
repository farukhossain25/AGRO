-- ============================================================================
-- 06_homepage_cms_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates everything a non-developer edits to change the look of the site:
--     hero_slides, homepage_sections, banners, menus, menu_items, blog_posts,
--     faq_items.
--
-- WHEN TO RUN
--   Sixth, after 05_premium_reviews_tables.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • homepage_sections.key is UNIQUE: the renderer looks sections up by key,
--     so a duplicate key would render the same block twice.
--   • hero_slides with no image still render (plain text slide), which is why
--     image_url is nullable.
-- ============================================================================

-- --------------------------------------------------------------- hero_slides --
create table if not exists public.hero_slides (
  id                  uuid primary key default gen_random_uuid(),
  title_bn            text not null,
  subtitle_bn         text,
  image_url           text,
  image_mobile_url    text,
  video_url           text,
  alt_bn              text,
  cta_label_bn        text,
  cta_href            text,
  secondary_label_bn  text,
  secondary_href      text,
  text_position       text not null default 'left' check (text_position in ('left', 'center', 'right')),
  text_tone           text not null default 'light' check (text_tone in ('light', 'dark')),
  overlay_opacity     integer not null default 45 check (overlay_opacity between 0 and 90),
  starts_at           timestamptz,
  ends_at             timestamptz,
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- --------------------------------------------------------- homepage_sections --
create table if not exists public.homepage_sections (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_bn    text not null,
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ banners --
create table if not exists public.banners (
  id           uuid primary key default gen_random_uuid(),
  title_bn     text not null,
  title_en     text,
  subtitle_bn  text,
  image        text,
  link         text not null default '/products',
  placement    text not null default 'home_hero',
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------- menus --
create table if not exists public.menus (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_bn    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- menu_items --
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references public.menus (id) on delete cascade,
  parent_id   uuid references public.menu_items (id) on delete cascade,
  label_bn    text not null,
  href        text not null default '/',
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- blog_posts --
create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title_bn      text not null,
  title_en      text,
  excerpt_bn    text,
  content_bn    text not null default '',
  cover         text,
  author_bn     text not null default 'বিশ্বাস এগ্রো টিম',
  tag_bn        text not null default 'স্বাস্থ্য টিপস',
  read_minutes  integer not null default 4 check (read_minutes between 1 and 60),
  published_at  timestamptz not null default now(),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- faq_items --
create table if not exists public.faq_items (
  id           uuid primary key default gen_random_uuid(),
  group_bn     text not null default 'সাধারণ',
  question_bn  text not null,
  answer_bn    text not null,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
