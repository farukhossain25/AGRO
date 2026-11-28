-- ============================================================================
-- 34_live_tv_channels.sql
-- ============================================================================
-- WHAT IT DOES
--   Makes `cloud_provider = 'tv'` a legal value on public.cameras, so the admin
--   panel can hang a live TV channel (a pasted .m3u8 / .m3u link) on the same
--   farm row where the CCTV cameras already live — and the storefront plays it
--   through exactly the same player and the same signed-token proxy.
--
-- WHY IT IS A DATABASE CHANGE AT ALL
--   `tv` is not a new transport. It is the SAME direct-HLS path as
--   `cloud_provider = 'hls'` (a URL the owner pasted, fetched server-side,
--   rewritten so every segment is signed). The reason a new provider value is
--   needed is that two existing constraints would reject a TV row:
--
--     cameras_cloud_provider_allowed  rejected 'tv' outright
--     cameras_cloud_provider_serial   requires cloud_serial for anything that
--                                     is not 'none' or 'hls' — and a channel
--                                     has no device serial to give
--
--   Rather than weakening either constraint, this migration widens the first
--   by exactly one value and exempts 'tv' from the second with the same
--   reasoning that already exempts 'hls': a pasted URL needs no device id.
--
-- WHY NOT REUSE 'hls'
--   Because the two answer differently. `hls` is a CAMERA whose owner hosts its
--   own HLS; `tv` is a free channel. They differ in entitlement (a channel is
--   always public — no subscription, no trial, no viewer cap), in the words the
--   UI uses, and in the camera counts on /live. Sharing a value would mean
--   reading `is_premium` and `stream_url` to guess which one a row is, and
--   guessing is how the old bugs in lib/watch-rights.ts started.
--
-- WHEN TO RUN
--   After 33_seller_farm_profile_sync.sql — or any time. Idempotent.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- ROLLBACK
--   Rows must be re-pointed first (or deleted), then:
--     alter table public.cameras drop constraint if exists cameras_cloud_provider_allowed;
--     alter table public.cameras add constraint cameras_cloud_provider_allowed
--       check (cloud_provider in ('none', 'hls', 'imou', 'ezviz'));
-- ============================================================================

-- 1. Widen the allowlist. Dropped and re-added because a check constraint
--    cannot be altered in place.
alter table public.cameras
  drop constraint if exists cameras_cloud_provider_allowed;

alter table public.cameras
  add constraint cameras_cloud_provider_allowed
  check (cloud_provider in ('none', 'hls', 'tv', 'imou', 'ezviz'));

-- 2. Nothing to hold back. A TV channel exists precisely because there is no
--    camera to pair, so it is exempt from the serial rule exactly like 'hls'.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'cameras_cloud_provider_serial'
       and conrelid = 'public.cameras'::regclass
  ) then
    alter table public.cameras drop constraint cameras_cloud_provider_serial;
  end if;

  alter table public.cameras
    add constraint cameras_cloud_provider_serial
    check (
      cloud_provider in ('none', 'hls', 'tv')
      or cloud_serial is not null
    );
end $$;

-- 3. A TV channel always has a playlist. Catching a typo here means the
--    storefront never has to render "channel is offline" for a row that was
--    never going to work.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'cameras_tv_needs_url'
       and conrelid = 'public.cameras'::regclass
  ) then
    alter table public.cameras
      add constraint cameras_tv_needs_url
      check (
        cloud_provider <> 'tv'
        or (stream_url is not null and stream_url ~* '^https?://')
      );
  end if;
end $$;
