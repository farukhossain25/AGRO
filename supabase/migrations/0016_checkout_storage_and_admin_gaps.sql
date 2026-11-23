-- 0016_checkout_storage_and_admin_gaps.sql
--
-- Second half of the schema reconciliation. 0015 added the content columns;
-- this one fixes what the checkout, the notification fan-out, the parcel
-- labels and the image uploads actually need.
--
--   1. storage buckets — the upload routes ask for `product-images`,
--      `payment-proofs`, `review-photos` and `complaint-photos`. The project
--      only had `Product-images` (capital P), `Avatars`, `Fram-images`,
--      `catalog-media` and `avatars`, and Supabase bucket names are exact, so
--      every admin image upload failed with "Bucket not found".
--   2. sub_orders.sub_no — lib/sellers.ts writes a sub-order number that the
--      table never had; the insert failed and per-seller split never happened.
--   3. audit_logs.admin_name — NOT NULL, but lib/audit.ts never sent it, so
--      every audit write was rejected (silently, because the Supabase client
--      returns `{ error }` instead of throwing).
--   4. notifications — legacy `type`/`title`/`message` are NOT NULL while the
--      app writes `kind`/`title_bn`/`body_bn`, so no in-app notification was
--      ever stored. The code now writes both dialects; these defaults keep a
--      partial write from failing.
--   5. cart_items — server-side cart for logged-in customers so the cart
--      survives a device switch (guests stay on localStorage).
--
-- Everything is idempotent.

/* ------------------------------------------------------- storage buckets --- */
insert into storage.buckets (id, name, public)
values
  ('product-images',   'product-images',   true),
  ('review-photos',    'review-photos',    true),
  ('complaint-photos', 'complaint-photos', true),
  ('payment-proofs',   'payment-proofs',   false)
on conflict (id) do update set public = excluded.public;

/* --------------------------------------------------------------- sub_orders */
alter table public.sub_orders add column if not exists sub_no text;
alter table public.sub_orders add column if not exists payment_status text default 'pending';
create unique index if not exists sub_orders_sub_no_idx on public.sub_orders (sub_no) where sub_no is not null;

/* -------------------------------------------------------------- audit_logs - */
alter table public.audit_logs alter column admin_name set default '';

/* ----------------------------------------------------------- notifications - */
alter table public.notifications alter column type set default 'system';
alter table public.notifications alter column title set default '';
alter table public.notifications alter column message set default '';

/* -------------------------------------------------------------- cart_items - */
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null,
  kind text not null default 'product',
  slug text,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_kind_check check (kind in ('product', 'combo')),
  constraint cart_items_quantity_check check (quantity > 0 and quantity <= 99),
  constraint cart_items_unique unique (user_id, item_id, kind)
);

alter table public.cart_items enable row level security;

grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;

drop policy if exists cart_items_own on public.cart_items;
create policy cart_items_own on public.cart_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
