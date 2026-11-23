-- 0017_status_vocabulary.sql
--
-- Enum drift between the code and the CHECK constraints. This is the bug that
-- made every checkout fail:
--
--   orders.status CHECK ('pending','confirmed','packing','shipping','delivered',
--                        'cancelled')
--   lib/orders.ts writes status = 'received'
--   → 23514 check_violation → the INSERT is rejected → "অর্ডার সম্পন্ন হয়নি"
--
-- The same mismatch existed for sub-orders ('received'), notifications
-- ('status', 'product', 'camera') and profiles.role (the app's role list is
-- customer | premium | seller | staff | manager | admin, while the table only
-- allowed customer | premium_customer | seller | admin — so promoting somebody
-- to staff/manager, or marking them premium, failed as well).
--
-- The constraints are widened to accept BOTH vocabularies rather than migrated
-- one way: existing rows keep reading correctly and either spelling works.
-- Also: the seeded catalogue has no `approval_status`, and the seller views
-- filter on 'approved', so our own products were invisible there.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in ('pending','received','confirmed','packing','shipped','shipping','delivered','cancelled')
  );

alter table public.sub_orders drop constraint if exists sub_orders_status_check;
alter table public.sub_orders
  add constraint sub_orders_status_check check (
    status in ('pending','received','confirmed','packing','shipped','shipping','delivered','cancelled')
  );

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('order','order_status','status','payment','seller','premium','system','trial','product','camera')
  );

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (
    role in ('customer','premium_customer','premium','seller','staff','manager','admin')
  );

/* Our own catalogue is approved by definition. */
alter table public.products alter column approval_status set default 'approved';
update public.products set approval_status = 'approved' where approval_status is null;
