-- ============================================================================
-- 35_seller_tv_channels.sql
-- ============================================================================
-- WHAT IT DOES
--   Lets an APPROVED seller add — and remove — their own live TV channels
--   (`cameras.cloud_provider = 'tv'`) on their own farm, without an admin
--   round-trip and without any public IP.
--
-- WHY THE POLICY IS SO NARROW
--   Today a seller can only READ their own farm's cameras. Writing was
--   admin-only, which is right for cameras: a camera has an installation, a
--   device and a support process behind it.
--
--   A TV channel has none of that. It is a URL. Making a seller open a ticket
--   and wait for an admin to paste their own link is friction for no safety —
--   but "a seller may write cameras" would also let them point a camera row at
--   any host they like, and cameras are the one table where a URL becomes an
--   outbound request from the server.
--
--   So the policy is a corridor, not an opening:
--
--     • only INSERT and DELETE — never UPDATE. Changing an existing row (in
--       particular flipping `cloud_provider` on an installed camera, or editing
--       its `stream_url`) stays an admin action.
--     • only `cloud_provider = 'tv'`. A seller cannot create an Imou/EZVIZ/RTSP
--       row, so they cannot make the server talk to a vendor cloud with keys
--       that are not theirs.
--     • only rows on a farm they own (`sellers.user_id = auth.uid()`), the same
--       test the existing SELECT policy uses.
--     • only https playlists (enforced by `cameras_tv_needs_url` in 34 plus
--       this check) — the proxy fetches that URL, so `http://169.254.169.254`
--       or a LAN address must never be storable by a non-admin.
--
--   The API route (/api/sellers/channels) re-checks every one of these. RLS is
--   the floor, not the ceiling: a policy protects the table even if a future
--   route forgets a check.
--
-- WHEN TO RUN
--   After 34_live_tv_channels.sql — or any time. Idempotent.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- ROLLBACK
--   drop policy if exists "seller adds own tv channels" on public.cameras;
--   drop policy if exists "seller deletes own tv channels" on public.cameras;
-- ============================================================================

-- 1. INSERT: a channel, on my farm, pointing at an https playlist.
drop policy if exists "seller adds own tv channels" on public.cameras;
create policy "seller adds own tv channels" on public.cameras
  for insert to authenticated
  with check (
    cloud_provider = 'tv'
    and stream_url ~* '^https://'
    and exists (
      select 1 from public.sellers s
       where s.user_id = auth.uid()
         and s.farm_id = cameras.farm_id
         and s.status = 'approved'
    )
  );

-- 2. DELETE: my own channel. `using` has no `with check` (it is the row being
--    deleted), so the same two facts — mine, and a channel — are what decide it.
drop policy if exists "seller deletes own tv channels" on public.cameras;
create policy "seller deletes own tv channels" on public.cameras
  for delete to authenticated
  using (
    cloud_provider = 'tv'
    and exists (
      select 1 from public.sellers s
       where s.user_id = auth.uid()
         and s.farm_id = cameras.farm_id
         and s.status = 'approved'
    )
  );

-- 3. Belt to the policy's braces: reject any non-https playlist at the table
--    level, whoever writes it. The service-role admin client bypasses RLS, so
--    a table constraint is the only thing that also covers the panel.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'cameras_direct_url_is_https'
       and conrelid = 'public.cameras'::regclass
  ) then
    alter table public.cameras
      add constraint cameras_direct_url_is_https
      check (
        cloud_provider not in ('hls', 'tv')
        or stream_url is null
        or stream_url ~* '^https://'
      );
  end if;
end $$;
