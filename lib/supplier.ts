import { db, isDbConfigured } from "./db";
import { cameraSourceOf, type CameraSource } from "./camera-source";
import { getSupplierQuality } from "./reviews";
import type { SupplierQuality } from "./types";

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
  /**
   * Supplier-level quality from v_supplier_quality (migration 0005).
   * Null for farm-only products or when the view has no rows yet.
   */
  quality: SupplierQuality | null;
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
        const sellerId = (row.seller_id as string | null) ?? null;
        const quality = sellerId ? await getSupplierQuality(sellerId).catch(() => null) : null;

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
          quality,
        };
      }
    } catch {
      /* offline → seed fallback below */
    }
  }

  return null;
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

/**
 * What kind of source a camera row actually is — the ONE decision that has to
 * be right on the product page.
 *
 * The product page used to ignore `cloud_provider` completely and always mount
 * the RTSP player. So a camera configured through Imou/EZVIZ, or a TV channel
 * added with an m3u8 link, was handed to `/api/stream/token`, which plays a
 * MediaMTX `stream_key` and nothing else. That route found no key and answered
 * "এই ক্যামেরার স্ট্রিম কনফিগার করা হয়নি" at 503 — the exact card in the bug
 * report — while the farm page, which does check the provider, played the same
 * row fine.
 *
 * `none` (and a missing column, on a pre-migration-24 database) keeps the old
 * path; everything else goes through the cloud bridge, which resolves the
 * vendor or the pasted playlist.
 */
/* Decided in lib/camera-source.ts so the admin table, the farm page and this
   module cannot disagree about what a row is. Re-exported under the old name
   because the product page's prop type already speaks it. */
export type SupplierCameraSource = CameraSource;

export type SupplierCamera = {
  id: string;
  nameBn: string;
  zoneBn: string | null;
  status: string;
  poster: string | null;
  lastHeartbeat: string | null;
  /** cameras.is_premium = false → open to everyone, no login needed */
  isPublic: boolean;
  /** which player this row needs */
  source: SupplierCameraSource;
};

/** Cameras AND TV channels on the supplier's farm — the live block's options. */
export async function getSupplierCameras(farmId: string | null): Promise<SupplierCamera[]> {
  if (!farmId || !isDbConfigured()) return [];

  /* `cloud_provider` arrived in migration 24. Asking for it before the
     migration is applied fails the WHOLE select, and a product page that
     silently loses its live block is worse than one that shows the old player.
     So it is requested first and dropped on 42703, exactly like lib/farms.ts. */
  const base = "id, name_bn, zone_bn, status, poster, last_heartbeat, is_premium, sort_order, stream_url";
  const run = (select: string) =>
    db().from("cameras").select(select).eq("farm_id", farmId).eq("is_active", true).order("sort_order", { ascending: true });

  try {
    let result = await run(`${base}, cloud_provider`);
    if (result.error) {
      const message = String(result.error.message ?? "");
      if (!/cloud_provider/.test(message) && result.error.code !== "42703") return [];
      result = await run(base);
      if (result.error) return [];
    }

    /* The dynamic select string defeats Supabase's generated row types (it
       falls back to GenericStringError), so the shape is narrowed here once
       instead of being asserted at each field. */
    const rows = (result.data ?? []) as unknown as {
      id: string;
      name_bn: string | null;
      zone_bn: string | null;
      status: string | null;
      poster: string | null;
      last_heartbeat: string | null;
      is_premium: boolean | null;
      stream_url: string | null;
      cloud_provider?: string | null;
    }[];
    if (!rows.length) return [];

    return rows.map((c) => {
      const provider = c.cloud_provider ?? null;
      /* stream_url rides along so a row saved with the dropdown left at "none"
         but an https playlist pasted is still recognised as a cloud source —
         see lib/camera-source.ts for why that mistake was guaranteed. */
      const source = cameraSourceOf(provider, c.stream_url);
      return {
        id: c.id as string,
        nameBn: c.name_bn ?? "",
        zoneBn: c.zone_bn ?? null,
        status: c.status ?? "offline",
        poster: c.poster ?? null,
        lastHeartbeat: c.last_heartbeat ?? null,
        /* A `tv` row is free even if is_premium was left ticked — the same rule
           the token route applies (lib/watch-rights.ts), mirrored here so the
           lock never appears over a channel everyone may watch. */
        isPublic: c.is_premium === false || source === "tv",
        source,
      };
    });
  } catch {
    return [];
  }
}


