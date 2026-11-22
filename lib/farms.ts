import { db, dbUsable, markDbUnreachable } from "./db";
import type { Camera, Farm, FarmType } from "./types";
import { seedCameras, seedFarms } from "./seed-premium";

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
  const fallback = filterSeedFarms(filters);

  if (!dbUsable()) return fallback;

  try {
    let q = db()
      .from("farms")
      .select(`*, cameras (${PUBLIC_CAMERA_COLUMNS})`)
      .eq("is_active", true)
      .order("sort_order");

    if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
    if (filters.district) q = q.eq("district", filters.district);
    if (filters.search) {
      const term = filters.search.replace(/[%,]/g, " ").trim();
      if (term) q = q.or(`name_bn.ilike.%${term}%,district.ilike.%${term}%,owner_name_bn.ilike.%${term}%`);
    }
    if (filters.limit) q = q.limit(filters.limit);

    const { data, error } = await q;
    if (error) throw error;

    if (!data?.length) return fallback;

    return data.map((row) => {
      const farm = stripFarm(row as unknown as Record<string, unknown>);
      const cams = (farm.cameras ?? []).sort((a, b) => a.sort_order - b.sort_order);
      farm.cameras = cams;
      farm.camera_count = cams.length;
      farm.online_cameras = cams.filter((c) => c.status === "online").length;
      return farm;
    });
  } catch (error) {
    markDbUnreachable();
    console.warn("[farms] falling back to seed data:", (error as Error).message);
    return fallback;
  }
}

export async function getFarmBySlug(slug: string): Promise<Farm | null> {
  if (dbUsable()) {
    try {
      const { data, error } = await db()
        .from("farms")
        .select(`*, cameras (${PUBLIC_CAMERA_COLUMNS})`)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const farm = stripFarm(data as unknown as Record<string, unknown>);
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
  return seedFarms.find((f) => f.slug === slug) ?? null;
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
  return (seedCameras[farmId] ?? []).slice();
}

/** Every district that has at least one farm — used by the filter bar. */
export async function farmDistricts(): Promise<string[]> {
  const farms = await listFarms({});
  return Array.from(new Set(farms.map((f) => f.district))).sort();
}

/* ------------------------------ fallbacks ------------------------------ */

function filterSeedFarms(f: FarmFilters): Farm[] {
  let rows = seedFarms.slice();
  if (f.type && f.type !== "all") rows = rows.filter((r) => r.type === f.type);
  if (f.district) rows = rows.filter((r) => r.district === f.district);
  if (f.search) {
    const q = f.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name_bn.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q) ||
        (r.owner_name_bn ?? "").toLowerCase().includes(q)
    );
  }
  if (f.limit) rows = rows.slice(0, f.limit);
  return rows.map((r) => {
    const cams = seedCameras[r.id] ?? [];
    return {
      ...r,
      cameras: cams,
      camera_count: cams.length,
      online_cameras: cams.filter((c) => c.status === "online").length,
    };
  });
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
