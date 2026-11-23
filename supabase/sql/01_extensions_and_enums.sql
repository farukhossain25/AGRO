-- ============================================================================
-- 01_extensions_and_enums.sql
-- ============================================================================
-- WHAT IT DOES
--   Installs the Postgres extensions the app needs and creates every enum type
--   used by the new schema (roles, order status, payment status, etc.).
--
-- WHEN TO RUN
--   First file, right after creating a fresh Supabase project (and after
--   00_RESET_ALL_DANGEROUS.sql if you are wiping an existing database).
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes. Extensions use IF NOT EXISTS and each enum is created inside a
--   DO block that ignores "already exists".
-- ============================================================================

-- gen_random_uuid(), gen_random_bytes()  -> ids, QR tokens, access codes
create extension if not exists pgcrypto with schema extensions;
-- trigram search for product / order search boxes
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums. Each one is guarded so a second run is a no-op.
-- ---------------------------------------------------------------------------
do $$
begin
  -- accounts -----------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('customer', 'premium', 'seller', 'staff', 'manager', 'admin');
  end if;

  -- orders -------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('received', 'packing', 'shipped', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_kind') then
    create type public.payment_method_kind as enum ('mfs', 'bank', 'cod', 'gateway', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_account_type') then
    create type public.payment_account_type as enum ('personal', 'agent', 'merchant', 'account');
  end if;

  -- catalog ------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'farm_type') then
    create type public.farm_type as enum ('vegetables', 'dairy', 'poultry', 'fish', 'fruits');
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_status') then
    create type public.camera_status as enum ('online', 'offline', 'maintenance');
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_protocol') then
    create type public.camera_protocol as enum ('hls', 'webrtc');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_approval') then
    create type public.product_approval as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'seller_status') then
    create type public.seller_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'coupon_type') then
    create type public.coupon_type as enum ('percent', 'fixed');
  end if;

  -- subscriptions / combos ---------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'combo_kind') then
    create type public.combo_kind as enum ('daily', 'weekly', 'monthly');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('active', 'paused', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_frequency') then
    create type public.subscription_frequency as enum ('weekly', 'biweekly', 'monthly');
  end if;

  -- premium ------------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'premium_tier') then
    create type public.premium_tier as enum ('basic', 'full');
  end if;
  if not exists (select 1 from pg_type where typname = 'premium_interval') then
    create type public.premium_interval as enum ('monthly', 'half_yearly', 'yearly');
  end if;
  if not exists (select 1 from pg_type where typname = 'premium_status') then
    create type public.premium_status as enum ('pending', 'active', 'grace', 'expired', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'access_code_status') then
    create type public.access_code_status as enum ('unused', 'used', 'revoked', 'expired');
  end if;

  -- reviews & complaints -----------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('published', 'hidden');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_status') then
    create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_problem') then
    create type public.complaint_problem as enum ('spoiled', 'short_weight', 'wrong_item', 'late', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'resolution_type') then
    create type public.resolution_type as enum ('refund', 'replacement', 'inform');
  end if;

  -- notifications ------------------------------------------------------------
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type public.notification_kind as enum ('order', 'status', 'premium', 'seller', 'product', 'camera', 'payment', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_audience') then
    create type public.notification_audience as enum ('user', 'seller', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared helper: updated_at maintenance (used by every table's trigger in 07).
-- Created here because it is a pure function with no table dependency.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'BEFORE UPDATE trigger that stamps updated_at = now().';
