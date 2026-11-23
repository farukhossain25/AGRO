-- ============================================================================
-- 19_payments_functions.sql
-- ============================================================================
-- WHAT IT DOES
--   The new payment system has NO payment RPCs: there is no submit_payment()
--   or review_payment() to write, because there is no customer-side TrxID
--   verification engine. Orders are created by place_order() (07), which
--   validates the chosen method against `payment_methods` and stores only the
--   method code + `payment_status` on the order. The owner marks an order paid
--   from the admin panel with a plain UPDATE on `orders`.
--
--   What remains here is the updated_at trigger on payment_methods, kept as a
--   standalone re-assert so the payment setup (17–21) is self-contained.
--
-- WHEN TO RUN
--   After 18_payments_schema.sql.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

comment on function public.touch_updated_at() is
  'Sets updated_at = now() on update. Applied to payment_methods by this file '
  'and to every other table by 07_functions_and_triggers.sql.';
