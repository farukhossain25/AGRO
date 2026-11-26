-- ============================================================================
-- 26_footer_payments.sql
-- ============================================================================
-- WHAT IT DOES
--   Gives the storefront footer/checkout a way to say "show this method in the
--   payment row" separately from "this method can take an order", and gives the
--   admin panel a real reorder action (not a number the owner types by hand).
--
--   1. payment_methods.show_on_checkout
--        true  → the method is one of the tiles the footer shows
--        false → still usable at checkout (customers can pay with it) but the
--                footer leaves its logo off the row
--      Default true, so nothing disappears the moment this file is run.
--
--   2. move_payment_method(p_id, p_direction)
--        Swaps sort_order with the previous/next row in ONE transaction, so
--        two quick clicks can never leave two methods with the same position.
--        The footer reads the table on every request, so the new order is live
--        on the next page load — no deploy.
--
--   3. A one-time cleanup: methods that share a sort_order are spread out, so
--      "first in admin order" always means exactly one method.
--
--   SAFE TO RE-RUN: add column if not exists / create or replace / the reorder
--   function is idempotent. Run it AFTER 25_coupons_referrals_wallet.sql.
-- ============================================================================

-- ------------------------------------------------- 1. the footer switch -----
alter table public.payment_methods
  add column if not exists show_on_checkout boolean not null default true;

comment on column public.payment_methods.show_on_checkout is
  'Footer/checkout payment row: true = show this method''s tile. false = the '
  'method still works for orders but its logo stays out of the footer row.';

-- ---------------------------------------------------- 2. stable order --------
-- Rows seeded by older scripts may all carry sort_order = 0; the footer's
-- "first N" logic would then be decided by chance. Give every remaining tie a
-- distinct position, keeping the current order (code) as the tie-breaker.
with ranked as (
  select id,
         row_number() over (order by sort_order, code) - 1 as new_order
    from public.payment_methods
)
update public.payment_methods m
   set sort_order = r.new_order
  from ranked r
 where m.id = r.id
   and m.sort_order is distinct from r.new_order;

-- -------------------------------------------------------- 3. reorder RPC ----
-- p_direction: -1 moves the method one step earlier (up, closer to the front
-- of the footer row), +1 one step later. A method already at the end simply
-- stays there. Returns the two rows that changed, so the panel can update its
-- list without a full reload.
create or replace function public.move_payment_method(p_id uuid, p_direction integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me   public.payment_methods%rowtype;
  v_swap public.payment_methods%rowtype;
begin
  if coalesce(p_direction, 0) not in (-1, 1) then
    raise exception 'BAD_DIRECTION';
  end if;

  select * into v_me from public.payment_methods where id = p_id for update;
  if not found then
    raise exception 'METHOD_NOT_FOUND';
  end if;

  if p_direction = -1 then
    select * into v_swap
      from public.payment_methods
     where (sort_order, code) < (v_me.sort_order, v_me.code)
     order by sort_order desc, code desc
     limit 1;
  else
    select * into v_swap
      from public.payment_methods
     where (sort_order, code) > (v_me.sort_order, v_me.code)
     order by sort_order asc, code asc
     limit 1;
  end if;

  -- already first / already last: nothing to swap, not an error
  if not found then
    return jsonb_build_object('moved', false, 'id', v_me.id);
  end if;

  update public.payment_methods
     set sort_order = v_swap.sort_order, updated_at = now()
   where id = v_me.id;
  update public.payment_methods
     set sort_order = v_me.sort_order, updated_at = now()
   where id = v_swap.id;

  return jsonb_build_object(
    'moved', true,
    'a', jsonb_build_object('id', v_me.id,   'sort_order', v_swap.sort_order),
    'b', jsonb_build_object('id', v_swap.id, 'sort_order', v_me.sort_order)
  );
end;
$$;

-- The admin panel calls this with the owner's own session, so `authenticated`
-- needs the grant; the service role (server routes) as well.
grant execute on function public.move_payment_method(uuid, integer)
  to authenticated, service_role;

-- ============================================================================
-- VERIFY (run afterwards; both lines should answer true)
-- ----------------------------------------------------------------------------
--   select count(*) filter (where show_on_checkout) > 0 as has_footer_tiles
--     from public.payment_methods where is_active;
--   select count(*) = count(distinct sort_order) as order_is_unique
--     from public.payment_methods;
-- ============================================================================
