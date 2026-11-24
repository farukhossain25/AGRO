-- ============================================================================
-- 24_camera_cloud_bridge.sql
-- ============================================================================
-- WHAT IT DOES
--   Lets the website play a seller's camera WITHOUT a VPS, a laptop at the
--   farm, or an open port on the router — by talking to the camera maker's own
--   cloud API (Imou Life / EZVIZ / any plain HLS URL).
--
--   The seller installs the camera with the phone app it ships with (Imou Life,
--   EZVIZ, etc.) and that app already keeps the camera reachable from the
--   internet. We reuse that same connection: the server asks the cloud for a
--   short-lived playback URL and proxies it through /api/cam/live/<cameraId>.
--
--   Two new columns on public.cameras:
--
--     cloud_provider   'none' | 'hls' | 'imou' | 'ezviz'
--                      'none' → the old MediaMTX/RTSP path (needs a VPS)
--                      'hls'  → cloud_url is played directly
--                      'imou' / 'ezviz' → cloud_serial + credentials
--
--     cloud_serial     the serial number / device id
--                        Imou  : the deviceId from the Imou Life share link
--                        EZVIZ : the 9-char device serial (e.g. F00497273)
--                        hls   : unused
--
--     cloud_channel    channel number — 0 for a single Imou camera,
--                      1..16 for a Dahua/Hikvision DVR channel
--
--   cloud_serial and cloud_channel are NOT secrets (the seller can see them in
--   their own app) but they are only read server-side, never sent to a browser.
--   The API credentials (Imou AppId/AppSecret, EZVIZ appKey/secret) are Vercel
--   environment variables, NOT database columns, so a leaked database row never
--   grants camera access.
--
-- WHEN TO RUN
--   After 23_premium_payment_approval.sql — or any time. Idempotent.
--
-- WHAT YOU SHOULD SEE AFTER RUNNING
--   "Success. No rows returned"
--
-- SAFE TO RUN TWICE
--   Yes — add column if not exists, and the enum widening is guarded.
-- ============================================================================

-- 1. Widening the protocol enum is the only way a browser player can be told
--    "this camera is cloud-hosted". 'hls' and 'webrtc' keep working as before.
do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typname = 'camera_protocol'
       and e.enumlabel = 'cloud'
  ) then
    alter type public.camera_protocol add value 'cloud';
  end if;
end $$;

-- 2. Where the picture comes from.
alter table public.cameras
  add column if not exists cloud_provider text not null default 'none',
  add column if not exists cloud_serial   text,
  add column if not exists cloud_channel  integer not null default 0;

-- 3. A row may only ask for a provider we know how to talk to. Written as a
--    named constraint so re-running does not stack duplicates.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'cameras_cloud_provider_allowed'
       and conrelid = 'public.cameras'::regclass
  ) then
    alter table public.cameras
      add constraint cameras_cloud_provider_allowed
      check (cloud_provider in ('none', 'hls', 'imou', 'ezviz'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'cameras_cloud_provider_serial'
       and conrelid = 'public.cameras'::regclass
  ) then
    -- imou / ezviz need a serial; 'hls' needs stream_url (already a column).
    alter table public.cameras
      add constraint cameras_cloud_provider_serial
      check (cloud_provider = 'none' or cloud_provider = 'hls' or cloud_serial is not null);
  end if;
end $$;

-- 4. The storefront lists "which farms have a live camera" constantly; a partial
--    index keeps that cheap once sellers start adding cloud cameras.
create index if not exists idx_cameras_cloud_live
  on public.cameras (farm_id, cloud_provider)
  where is_active = true and cloud_provider <> 'none';

-- 5. The admin list filters by provider — cheap, small table.
create index if not exists idx_cameras_cloud_provider
  on public.cameras (cloud_provider);
