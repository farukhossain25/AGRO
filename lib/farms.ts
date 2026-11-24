import { db, dbUsable, markDbUnreachable } from "./db";
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
  /* which player to mount — never the serial or the credential */
  "cloud_provider",
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
async function selectFarms(withBrand: () => QueryResult, withoutBrand: () => QueryResult) {
  // supabase-js reports a bad column as `{ data: null, error }`, not as a throw
  const first = await withBrand();
  if (first.error && isMissingBrandColumns(first.error)) return withoutBrand();
  return first;
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
    const { data, error } = await selectFarms(
      () => run(`${plain}, ${SELLER_BRAND_EMBED}`),
      () => run(plain)
    );
    if (error) throw error;

    if (!data?.length) return [];

    return data.map((row) => {
      const farm = applySellerBrand(stripFarm(row as unknown as Record<string, unknown>) as FarmWithSeller);
      const cams = (farm.cameras ?? []).sort((a, b) => a.sort_order - b.sort_order);
      farm.cameras = cams;
      farm.camera_count = cams.length;
      farm.online_cameras = cams.filter((c) => c.status === "online").length;
      return farm;
    });
  } catch (error) {
    markDbUnreachable();
    console.warn("[farms] list failed:", (error as Error).message);
    return [];
  }
}

export async function getFarmBySlug(slug: string): Promise<Farm | null> {
  if (dbUsable()) {
    try {
      const plain = `*, cameras (${PUBLIC_CAMERA_COLUMNS})`;
      const { data, error } = await selectFarms(
        () =>
          db()
            .from("farms")
            .select(`${plain}, ${SELLER_BRAND_EMBED}`)
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
      markDbUnreachable();
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
      const { data, error } = await db()
        .from("cameras")
        .select(PUBLIC_CAMERA_COLUMNS)
        .eq("farm_id", farmId)
        .eq("is_active", true)
        .order("sort_order");
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
