import { db, isDbConfigured } from "./db";
import { farmIds, seedCameras, seedFarms } from "./seed-premium";

/* ==========================================================================
   Public supplier details for a product page (section D)
   --------------------------------------------------------------------------
   Reads the `v_product_supplier` view (0004) which whitelists ONLY public
   columns: farm/seller name, photo, district, address, description, rating,
   harvest date, product count, map pin.

   Never returned by this module:
     sellers.nid, sellers.bank_*, sellers.payout_*, sellers.phone
   ========================================================================== */

export type SupplierInfo = {
  /** sellers.id or null for farm-only products */
  sellerId: string | null;
  sellerSlug: string | null;
  sellerNameBn: string | null;
  farmId: string | null;
  farmSlug: string | null;
  farmNameBn: string | null;
  /** portrait of the farmer/owner */
  photo: string | null;
  cover: string | null;
  bioBn: string | null;
  descriptionBn: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  addressBn: string | null;
  lat: number | null;
  lng: number | null;
  establishedYear: number | null;
  certifications: string[];
  /** how many active products this supplier sells */
  productCount: number;
  /** 0 = the farm has no camera (drives the "ক্যামেরা নেই" state) */
  cameraCount: number;
  /** product-level context */
  harvestDate: string | null;
  farmSourceBn: string | null;
  rating: number;
  reviewCount: number;
  /** the farm page slug to link "এই সেলারের সব পণ্য দেখুন" */
  storeHref: string;
};

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve the supplier for a product. Falls back to the seed farm that the
 * static catalogue references, so the card renders in demo/offline mode.
 */
export async function getProductSupplier(product: {
  id: string;
  slug: string;
  farm_source_bn?: string | null;
  harvest_date?: string | null;
  rating?: number;
  review_count?: number;
}): Promise<SupplierInfo | null> {
  if (isDbConfigured()) {
    try {
      const { data, error } = await db()
        .from("v_product_supplier")
        .select(
          "seller_id, seller_slug, seller_name_bn, farm_id, farm_slug, farm_name_bn, farm_photo, farm_bio_bn, farm_description_bn, farm_cover, farm_images, division, district, farm_upazila, farm_address_bn, farm_lat, farm_lng, established_year, certifications, product_count, camera_count"
        )
        .eq("product_id", product.id)
        .maybeSingle();

      if (!error && data) {
        const row = data as Record<string, unknown>;
        const sellerSlug = row.seller_slug as string | null;

        return {
          sellerId: (row.seller_id as string | null) ?? null,
          sellerSlug,
          sellerNameBn: (row.seller_name_bn as string | null) ?? null,
          farmId: (row.farm_id as string | null) ?? null,
          farmSlug: (row.farm_slug as string | null) ?? null,
          farmNameBn: (row.farm_name_bn as string | null) ?? null,
          photo:
            (row.farm_photo as string | null) ??
            ((row.farm_images as string[] | null)?.[0] ?? null),
          cover: (row.farm_cover as string | null) ?? null,
          bioBn: (row.farm_bio_bn as string | null) ?? null,
          descriptionBn: (row.farm_description_bn as string | null) ?? null,
          division: (row.division as string | null) ?? null,
          district: (row.district as string | null) ?? null,
          upazila: (row.farm_upazila as string | null) ?? null,
          addressBn: (row.farm_address_bn as string | null) ?? null,
          lat: num(row.farm_lat),
          lng: num(row.farm_lng),
          establishedYear: num(row.established_year),
          certifications: (row.certifications as string[] | null) ?? [],
          productCount: num(row.product_count) ?? 1,
          cameraCount: num(row.camera_count) ?? 0,
          harvestDate: product.harvest_date ?? null,
          farmSourceBn: product.farm_source_bn ?? null,
          rating: product.rating ?? 5,
          reviewCount: product.review_count ?? 0,
          storeHref: sellerSlug ? `/market/${sellerSlug}` : row.farm_slug ? `/live/farms/${row.farm_slug}` : "/market",
        };
      }
    } catch {
      /* offline → seed fallback below */
    }
  }

  // ---- seed fallback: match on the free-text farm source, else by category
  const source = product.farm_source_bn ?? "";
  const bySlugFarm = seedFarmIdForSlug(product.slug);
  const farm =
    seedFarms.find((f) => f.name_bn === source) ??
    (bySlugFarm ? seedFarms.find((f) => f.id === bySlugFarm) : undefined) ??
    seedFarms[0];
  if (!farm) return null;

  return {
    sellerId: null,
    sellerSlug: null,
    sellerNameBn: farm.name_bn,
    farmId: farm.id,
    farmSlug: farm.slug,
    farmNameBn: farm.name_bn,
    photo: farm.owner_photo ?? null,
    cover: farm.cover ?? null,
    bioBn: farm.owner_bio_bn ?? null,
    descriptionBn: farm.description_bn ?? null,
    division: farm.division,
    district: farm.district,
    upazila: farm.upazila ?? null,
    addressBn: farm.address_bn ?? null,
    lat: farm.lat ?? null,
    lng: farm.lng ?? null,
    establishedYear: farm.established_year ?? null,
    certifications: farm.certifications ?? [],
    productCount: 1,
    cameraCount: 2,
    harvestDate: product.harvest_date ?? null,
    farmSourceBn: product.farm_source_bn ?? null,
    rating: product.rating ?? 5,
    reviewCount: product.review_count ?? 0,
    storeHref: `/live/farms/${farm.slug}`,
  };
}

/** Product ids belonging to the same supplier — powers "সব পণ্য দেখুন". */
export async function getSupplierProductIds(supplier: SupplierInfo): Promise<string[]> {
  if (!isDbConfigured()) return [];
  try {
    let query = db().from("products").select("id").eq("is_active", true).limit(40);
    if (supplier.sellerId) query = query.eq("seller_id", supplier.sellerId);
    else if (supplier.farmId) query = query.eq("farm_id", supplier.farmId);
    else return [];

    const { data } = await query;
    return (data ?? []).map((p) => p.id as string);
  } catch {
    return [];
  }
}

/** Cameras on the supplier's farm — the switcher options for the live block. */
export async function getSupplierCameras(farmId: string | null): Promise<
  { id: string; nameBn: string; zoneBn: string | null; status: string; poster: string | null; lastHeartbeat: string | null }[]
> {
  // Offline / demo mode: use the seeded cameras so the five live-footage
  // states (premium, trial, locked, no-camera, offline) are all reachable.
  if (!farmId || !isDbConfigured()) return seedCameraFallback(farmId);
  try {
    const { data, error } = await db()
      .from("cameras")
      .select("id, name_bn, zone_bn, status, poster, last_heartbeat")
      .eq("farm_id", farmId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) return seedCameraFallback(farmId);

    if (!data?.length) return seedCameraFallback(farmId);

    return (data ?? []).map((c) => ({
      id: c.id as string,
      nameBn: c.name_bn as string,
      zoneBn: (c.zone_bn as string | null) ?? null,
      status: (c.status as string) ?? "offline",
      poster: (c.poster as string | null) ?? null,
      lastHeartbeat: (c.last_heartbeat as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}

/** Seeded cameras for a farm — used offline and as a last-resort fallback. */
function seedCameraFallback(farmId: string | null) {
  if (!farmId) return [];
  return (seedCameras[farmId] ?? []).map((c) => ({
    id: c.id,
    nameBn: c.name_bn,
    zoneBn: c.zone_bn ?? null,
    status: c.status,
    poster: c.poster ?? null,
    lastHeartbeat: c.last_heartbeat ?? null,
  }));
}

/**
 * Deterministic product → seed-farm mapping for offline/demo mode.
 * Mirrors the SQL backfill applied to the live database, so the demo shows the
 * same farms the production data does.
 */
// category-level defaults
const CATEGORY_FARM: [RegExp, string][] = [
  [/^(palong|kacha|kumra|bashor|korola|begun|fulkopi|mula|dhone|shosha|potol|dherosh|lau|shim)/i, farmIds.savarGreens],
  [/^(dudh|doi|chana|makhon|ghee|ponir)/i, farmIds.tangailDairy],
  [/^(dim|murgi|broiler|koli|hasher)/i, farmIds.gazipurPoultry],
  [/^(rupchanda|tilapia|koi|pangash|shing|bagda|chingri|prawn|mach)/i, farmIds.khulnaShrimp],
  [/^(aam|mango|jam|kola|peyara|lebu)/i, farmIds.rajshahiMango],
];

/** Resolve a product slug to its seed farm id (offline mode only). */
export function seedFarmIdForSlug(slug: string): string | null {
  for (const [pattern, farmId] of CATEGORY_FARM) {
    if (pattern.test(slug)) return farmId;
  }
  return null;
}
