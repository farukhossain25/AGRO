-- ============================================================================
-- 02_core_tables.sql
-- ============================================================================
-- WHAT IT DOES
--   Creates the identity + website-configuration tables:
--     profiles, addresses, site_settings, social_links, team_members,
--     static_pages, audit_log, plus the small support tables the app reads
--     (media_assets, seo_meta, contact_messages, newsletter_subscribers,
--      login_attempts).
--
-- WHEN TO RUN
--   Second, after 01_extensions_and_enums.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- NOTES
--   • profiles.id is the Supabase auth user id (auth.users.id). There is no
--     separate "users" table any more — Supabase Auth owns the credentials.
--   • Every column here matches a column the app actually reads or writes.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  full_name              text,
  email                  text,
  phone                  text,
  bio                    text,
  avatar_url             text,
  role                   public.user_role not null default 'customer',
  is_active              boolean not null default true,
  is_seller              boolean not null default false,
  premium_until          timestamptz,
  phone_verified         boolean not null default false,
  language               text not null default 'bn' check (language in ('bn', 'en')),
  theme                  text not null default 'dark' check (theme in ('dark', 'light')),
  notification_preferences jsonb not null default '{"email": true, "sms": false, "push": true}'::jsonb,
  onboarded              boolean not null default false,
  mfa_enrolled           boolean not null default false,
  last_login_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.profiles is 'One row per Supabase auth user. Role lives here (never in auth.users metadata alone).';

-- --------------------------------------------------------------- addresses --
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null default 'বাসা',
  full_name   text not null,
  phone       text not null,
  division    text not null,
  district    text not null,
  upazila     text not null,
  address     text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ site_settings --
-- One row per settings group: 'store', 'delivery', 'seller', 'reviews',
-- 'payments', 'premium', 'announcement', 'social', 'seo' …
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

comment on table public.site_settings is 'Key/value JSON settings edited from /foisal/settings. Replaces the old `settings` table.';

-- ------------------------------------------------------------- social_links --
create table if not exists public.social_links (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  label_bn      text,
  url           text not null,
  icon          text,
  color         text,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  show_header   boolean not null default false,
  show_footer   boolean not null default true,
  show_contact  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint social_links_platform_url_key unique (platform, url)
);

-- ------------------------------------------------------------- team_members --
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  name_bn     text not null,
  name_en     text,
  role_bn     text not null default 'টিম সদস্য',
  role_en     text,
  bio_bn      text,
  photo       text,
  email       text,
  phone       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- static_pages --
create table if not exists public.static_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title_bn         text not null,
  title_en         text,
  blocks           jsonb not null default '[]'::jsonb,
  seo_title        text,
  seo_description  text,
  is_published     boolean not null default true,
  show_in_footer   boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.static_pages.blocks is 'Array of typed CMS blocks: heading | text | list | callout | image.';

-- ----------------------------------------------------------------- audit_log --
create table if not exists public.audit_log (
  id           bigserial primary key,
  actor_id     uuid,
  actor_email  text,
  actor_role   text,
  action       text not null,
  entity       text,
  entity_id    text,
  diff         jsonb,
  meta         jsonb not null default '{}'::jsonb,
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

comment on table public.audit_log is 'Append-only trail of every admin write. Never updated or deleted from the app.';

-- --------------------------------------------------------------- media_assets --
create table if not exists public.media_assets (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null,
  path         text not null,
  url          text not null,
  mime         text,
  bytes        bigint,
  alt_bn       text,
  title_bn     text,
  tags         text[] not null default '{}'::text[],
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint media_assets_bucket_path_key unique (bucket, path)
);

-- ------------------------------------------------------------------- seo_meta --
create table if not exists public.seo_meta (
  path             text primary key,
  title_bn         text,
  title_en         text,
  description_bn   text,
  description_en   text,
  keywords_bn      text[] not null default '{}'::text[],
  og_title         text,
  og_description   text,
  og_image         text,
  canonical        text,
  noindex          boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------- contact_messages --
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  message     text not null,
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------ newsletter_subscribers --
create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

-- ------------------------------------------------------------- login_attempts --
-- Used by the login-help screen and the sign-in rate limiter. Server only.
create table if not exists public.login_attempts (
  id          bigserial primary key,
  email       text,
  ip          text,
  ok          boolean not null default false,
  created_at  timestamptz not null default now()
);
