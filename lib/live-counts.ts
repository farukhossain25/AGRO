import type { Farm } from "./types";

/* ==========================================================================
   What counts as "live" on a farm
   --------------------------------------------------------------------------
   One definition, shared by the server (lib/farms.ts, sorting and page stats)
   and the client (farm cards, directory, home strip) — because that is exactly
   where the bug came from.

   A farm's video is two different things:

     cameras   cloud_provider <> 'tv'  → camera_count / online_cameras
     channels  cloud_provider =  'tv'  → tv_count / tv_online

   Counting them together was the first lie (a farm with three channels said
   "৩টি ক্যামেরা"). Counting only cameras was the second: an m3u8 channel that
   plays perfectly was invisible to "is this farm live?", so it sorted below a
   silent farm and its card read "০ লাইভ" over a running stream.

   Deliberately dependency-free: no supabase import, so it can be pulled into a
   "use client" component without dragging the server client into the bundle.
   ========================================================================== */

/** Cameras and/or channels playing right now. */
export function isAnythingLive(farm: Pick<Farm, "online_cameras" | "tv_online">): boolean {
  return (farm.online_cameras ?? 0) > 0 || (farm.tv_online ?? 0) > 0;
}

/** Total live video on a farm — used for ordering, never for a label. */
export function liveVideoCount(farm: Pick<Farm, "online_cameras" | "tv_online">): number {
  return (farm.online_cameras ?? 0) + (farm.tv_online ?? 0);
}

/**
 * The label for a farm's card: "২ লাইভ · ১ টিভি", "১ টিভি", "অফলাইন".
 * `bn` is injected so each surface keeps its own digit helper.
 */
export function liveBadgeParts(
  farm: Pick<Farm, "online_cameras" | "tv_online">,
  bn: (n: number) => string
): string[] {
  const cams = farm.online_cameras ?? 0;
  const tv = farm.tv_online ?? 0;
  const parts: string[] = [];
  if (cams) parts.push(`${bn(cams)} লাইভ`);
  if (tv) parts.push(`${bn(tv)} টিভি`);
  return parts;
}
