import { db, dbUsable, isDbConfigured, markDbUnreachable } from "./db";
import type { Camera, Farm, FarmType } from "./types";

/* ==========================================================================
   Farms + cameras — the only data entry point for farm pages
   --------------------------------------------------------------------------
   Public reads strip stream_key/stream_url before anything leaves the server.
   ========================================================================== */

/** Everything the browser is allowed to know about a camera. */
const PUBLIC_CAMERA_COLUMNS = [
  "id",
  "farm_id",
  "name_bn",
  "zone_bn",
  "protocol",
  "poster",
  "location_lat",
  "location_lng",
  "status",
  "last_heartbeat",
  "is_active",
  "is_premium",
  "max_viewers",
  "sort_order",
].join(", ");

/**
 * `cloud_provider` arrived in migration 24. Asking for it before the migration
 * is applied fails the WHOLE embedded camera select — and because the farm
 * query throws on a nested error, every farm disappeared from the storefront.
 * So the column is requested separately and dropped on 42703.
 */
const PUBLIC_CAMERA_COLUMNS_V24 = `${PUBLIC_CAMERA_COLUMNS}, cloud_provider`;

/* The seller who owns a farm uploads a logo and a banner from /seller. A farm
   row only has `cover`, so the seller's banner is copied there on save — and
   read here as well, so a store branded before that sync existed still shows
   the right picture. `sellers` is a to-many embed (sellers.farm_id → farms). */
const SELLER_BRAND_EMBED = "sellers(slug, logo, banner)";

type FarmWithSeller = Farm & {
  sellers?: { slug: string; logo: string | null; banner: string | null }[] | null;
};

/** True when the database predates migration 22 (no sellers.logo/banner yet). */
function isMissingBrandColumns(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  const code = (error as { code?: string })?.code;
  return code === "42703" || /column .*sellers\.(logo|banner)|sellers\.(logo|banner).*does not exist/i.test(message);
}

/** Run `withBrand`; if the columns are missing, fall back to the plain select. */
type QueryResult = PromiseLike<{
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}>;
async function selectFarms(
  withBrand: () => QueryResult,
  withoutBrand: () => QueryResult,
  /** last resort: neither the seller brand nor the v24 camera columns exist */
  plainest?: () => QueryResult
) {
  // supabase-js reports a bad column as `{ data: null, error }`, not as a throw
  const first = await withBrand();
  if (!first.error) return first;

  if (isMissingBrandColumns(first.error)) {
    const second = await withoutBrand();
    if (!second.error) return second;
    if (plainest && isMissingCameraColumns(second.error)) return plainest();
    return second;
  }

  if (plainest && isMissingCameraColumns(first.error)) {
    const second = await plainest();
    return second;
  }

  return first;
}

/** True when the database predates migration 24 (no cameras.cloud_provider). */
function isMissingCameraColumns(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  const code = (error as { code?: string })?.code;
  return code === "42703" && /cloud_provider/i.test(message);
}

function applySellerBrand(row: FarmWithSeller): Farm {
  const seller = Array.isArray(row.sellers) ? row.sellers[0] : null;
  if (seller?.banner) row.cover = seller.banner;
  row.logo = seller?.logo ?? null;
  delete row.sellers;
  return row;
}

export type FarmFilters = {
  type?: FarmType | "all";
  district?: string;
  search?: string;
  limit?: number;
};

function stripFarm(row: Record<string, unknown>): Farm {
  const farm = row as unknown as Farm;
  if (Array.isArray(farm.cameras)) {
    farm.cameras = farm.cameras.map((c) => c as Camera);
  }
  return farm;
}

/**
 * Farms with a live camera float to the top.
 *
 * WHY THIS IS NOT AN SQL ORDER BY
 *   "Live" is not a column — it is `cameras.status = 'online'`, and the public
 *   camera embed is already fetched with the farm. Ordering in SQL would need
 *   an aggregate over the embed (and the two embeds fall back to different
 *   column sets, see selectFarms). Sorting the page of rows we already have is
 *   both exact and free.
 *
 * ORDER
 *   1. farms with at least one online camera
 *   2. the rest, each group in the admin's sort_order (the query already
 *      returns them that way, and Array.prototype.sort is stable)
 *
 * The directory page still applies its own filters before this runs, so
 * filtering by type/district never reorders anything unexpectedly.
 */
function liveFirst(farms: Farm[]): Farm[] {
  return [...farms].sort((a, b) => {
    const aLive = (a.online_cameras ?? 0) > 0 ? 0 : 1;
    const bLive = (b.online_cameras ?? 0) > 0 ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export async function listFarms(filters: FarmFilters = {}): Promise<Farm[]> {
  if (!dbUsable()) return [];

  try {
    const run = (select: string) => {
      let q = db()
        .from("farms")
        .select(select)
        .eq("is_active", true)
        .order("sort_order");

      if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
      if (filters.district) q = q.eq("district", filters.district);
      if (filters.search) {
        const term = filters.search.replace(/[%,]/g, " ").trim();
        if (term) q = q.or(`name_bn.ilike.%${term}%,district.ilike.%${term}%,owner_name_bn.ilike.%${term}%`);
      }
      if (filters.limit) q = q.limit(filters.limit);
      return q;
    };

    const plain = `*, cameras (${PUBLIC_CAMERA_COLUMNS})`;
    const plainV24 = `*, cameras (${PUBLIC_CAMERA_COLUMNS_V24})`;
    const { data, error } = await selectFarms(
      () => run(`${plainV24}, ${SELLER_BRAND_EMBED}`),
      () => run(plainV24),
      () => run(plain)
    );
    if (error) throw error;

    if (!data?.length) return [];

    const mapped = data.map((row) => {
      const farm = applySellerBrand(stripFarm(row as unknown as Record<string, unknown>) as FarmWithSeller);
      const cams = (farm.cameras ?? []).sort((a, b) => a.sort_order - b.sort_order);
      farm.cameras = cams;
      farm.camera_count = cams.length;
      farm.online_cameras = cams.filter((c) => c.status === "online").length;
      return farm;
    });

    /* The directory, the /live grid and the home teaser all read this one
       function, so a farm that is live right now is first everywhere. */
    return liveFirst(mapped);
  } catch (error) {
    markDbUnreachable();
    console.warn("[farms] list failed:", (error as Error).message);
    return [];
  }
}

/** Tri-state farm lookup, for pages that render a 404 when it is missing. */
export type FarmLookup = { state: "ok"; value: Farm | null } | { state: "error" };

export async function lookupFarmBySlug(slug: string): Promise<FarmLookup> {
  if (!isDbConfigured()) return { state: "ok", value: await getFarmBySlug(slug) };
  if (!dbUsable()) return { state: "error" };

  try {
    const plain = `*, cameras (${PUBLIC_CAMERA_COLUMNS})`;
    const plainV24 = `*, cameras (${PUBLIC_CAMERA_COLUMNS_V24})`;
    const { data, error } = await selectFarms(
      () =>
        db()
          .from("farms")
          .select(`${plainV24}, ${SELLER_BRAND_EMBED}`)
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle(),
      () =>
        db()
          .from("farms")
          .select(plainV24)
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle(),
      () =>
        db()
          .from("farms")
          .select(plain)
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle()
    );
    if (error) throw error;
    if (!data) return { state: "ok", value: null };

    const farm = applySellerBrand(stripFarm(data as unknown as Record<string, unknown>) as FarmWithSeller);
    farm.cameras = (farm.cameras ?? []).sort((a, b) => a.sort_order - b.sort_order);
    farm.camera_count = farm.cameras.length;
    farm.online_cameras = farm.cameras.filter((c) => c.status === "online").length;
    return { state: "ok", value: farm };
  } catch (error) {
    markDbUnreachable(error);
    console.warn("[farms] detail lookup failed:", (error as Error).message);
    return { state: "error" };
  }
}

export async function getFarmBySlug(slug: string): Promise<Farm | null> {
  if (dbUsable()) {
    try {
      const plain = `*, cameras (${PUBLIC_CAMERA_COLUMNS})`;
      const plainV24 = `*, cameras (${PUBLIC_CAMERA_COLUMNS_V24})`;
      const { data, error } = await selectFarms(
        () =>
          db()
            .from("farms")
            .select(`${plainV24}, ${SELLER_BRAND_EMBED}`)
            .eq("slug", slug)
            .eq("is_active", true)
            .maybeSingle(),
        () =>
          db()
            .from("farms")
            .select(plainV24)
            .eq("slug", slug)
            .eq("is_active", true)
            .maybeSingle(),
        () =>
          db()
            .from("farms")
            .select(plain)
            .eq("slug", slug)
            .eq("is_active", true)
            .maybeSingle()
      );

      if (error) throw error;
      if (data) {
        const farm = applySellerBrand(stripFarm(data as unknown as Record<string, unknown>) as FarmWithSeller);
        farm.cameras = (farm.cameras ?? []).sort((a, b) => a.sort_order - b.sort_order);
        farm.camera_count = farm.cameras.length;
        farm.online_cameras = farm.cameras.filter((c) => c.status === "online").length;
        return farm;
      }
    } catch (error) {
      markDbUnreachable(error);
      console.warn("[farms] detail fallback:", (error as Error).message);
    }
  }
  return null;
}

export async function getDairyFarms(): Promise<Farm[]> {
  const farms = await listFarms({ type: "dairy" });
  return farms;
}

export async function listCamerasByFarm(farmId: string): Promise<Camera[]> {
  if (dbUsable()) {
    try {
      let { data, error } = await db()
        .from("cameras")
        .select(PUBLIC_CAMERA_COLUMNS_V24)
        .eq("farm_id", farmId)
        .eq("is_active", true)
        .order("sort_order");

      if (error && isMissingCameraColumns(error)) {
        // pre-migration-24 database — the cameras still work, just no cloud ones
        ({ data, error } = await db()
          .from("cameras")
          .select(PUBLIC_CAMERA_COLUMNS)
          .eq("farm_id", farmId)
          .eq("is_active", true)
          .order("sort_order"));
      }
      if (error) throw error;
      if (data?.length) return data as unknown as Camera[];
    } catch {
      /* fall through */
    }
  }
  return [];
}

/** Every district that has at least one farm — used by the filter bar. */
export async function farmDistricts(): Promise<string[]> {
  const farms = await listFarms({});
  return Array.from(new Set(farms.map((f) => f.district))).sort();
}

export const farmTypeLabelBn: Record<FarmType, string> = {
  vegetables: "শাকসবজি",
  dairy: "দুগ্ধ",
  poultry: "মুরগি ও ডিম",
  fish: "মাছ",
  fruits: "ফল",
};

export const farmTypeIcon: Record<FarmType, string> = {
  vegetables: "🥬",
  dairy: "🐄",
  poultry: "🐓",
  fish: "🐟",
  fruits: "🥭",
};
