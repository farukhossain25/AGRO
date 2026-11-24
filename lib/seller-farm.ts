import { db, isDbConfigured } from "./db";
import type { TablesInsert } from "./database.types";
import type { FarmType, Seller } from "./types";
import { slugifyAscii, toBn } from "./format";

/* ==========================================================================
   Seller → farm onboarding
   --------------------------------------------------------------------------
   A seller's public life happens on `farms`: the "আমাদের খামার" strip (/farm),
   the live-camera directory (/live/farms) and the store page all read it, and
   cameras hang off a farm, not a seller. Applications used to write only a
   `sellers` row, so an approved seller had no farm — nothing to show under
   "আমাদের খামার", and nowhere to attach the camera they requested.

   ensureSellerFarm() is the single idempotent way to give a seller a farm:
   linked → returned, dangling → repaired, missing → created from the data the
   seller already submitted. Called on approval, from the seller dashboard
   (self-heal for sellers approved before this existed) and before a camera
   request is filed.

   provisionRequestCameras() turns "ইনস্টল সম্পন্ন" on a camera request into
   real `cameras` rows, which is the only thing the live page can show.
   ========================================================================== */

export type SellerFarmLink = { id: string; slug: string; name_bn: string };

const FARM_COLS = "id, slug, name_bn" as const;

/** The apply form's product-type ids → the farm_type enum. Unknown → vegetables. */
const FARM_TYPE_BY_PRODUCT: Record<string, FarmType> = {
  vegetables: "vegetables",
  fruits: "fruits",
  dairy: "dairy",
  poultry: "poultry",
  fish: "fish",
  rice: "vegetables",
  honey: "fruits",
  spices: "vegetables",
  agri: "vegetables",
};

export function farmTypeFor(productTypes: string[] | null | undefined): FarmType {
  for (const t of productTypes ?? []) {
    const hit = FARM_TYPE_BY_PRODUCT[String(t).toLowerCase()];
    if (hit) return hit;
  }
  return "vegetables";
}

/** Camera zone that fits the farm — matches the admin Cameras panel's options. */
const ZONE_BY_FARM_TYPE: Record<FarmType, string> = {
  dairy: "গোয়ালঘর",
  poultry: "মুরগিঘর",
  fish: "পুকুর",
  vegetables: "জমি",
  fruits: "জমি",
};

function randomSuffix(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

/**
 * Make sure `seller` has a farm row and `sellers.farm_id` points at it.
 * Never throws for a missing row; a DB error propagates so the caller can
 * decide whether it is fatal (approval must not fail because of it).
 */
export async function ensureSellerFarm(
  seller: Seller,
  opts: { requireApproved?: boolean } = {}
): Promise<SellerFarmLink | null> {
  if (!isDbConfigured()) return null;
  const requireApproved = opts.requireApproved ?? true;
  if (requireApproved && seller.status !== "approved") return null;

  const client = db();

  // 1. already linked → hand it back. A DB error throws rather than falling
  //    through to "create", which would give the seller a twin farm.
  if (seller.farm_id) {
    const { data, error } = await client.from("farms").select(FARM_COLS).eq("id", seller.farm_id).maybeSingle();
    if (error) throw error;
    if (data) return data as unknown as SellerFarmLink;
  }

  // 2. a farm this user already owns (admin-created, or an earlier auto-create
  //    whose link was lost) → relink instead of making a twin
  if (seller.user_id) {
    const { data: owned, error } = await client
      .from("farms")
      .select(FARM_COLS)
      .eq("owner_user_id", seller.user_id)
      .order("created_at")
      .limit(1);
    if (error) throw error;
    const first = owned?.[0];
    if (first) {
      await client.from("sellers").update({ farm_id: first.id }).eq("id", seller.id);
      return first as unknown as SellerFarmLink;
    }
  }

  // 3. create from the application
  const farm = await createFarmForSeller(client, seller, requireApproved);
  if (!farm) return null;

  const { error: linkError } = await client.from("sellers").update({ farm_id: farm.id }).eq("id", seller.id);
  if (linkError) console.warn("[seller-farm] could not link farm to seller:", linkError.message);

  return farm;
}

async function createFarmForSeller(
  client: ReturnType<typeof db>,
  seller: Seller,
  approved: boolean
): Promise<SellerFarmLink | null> {
  const photos = Array.isArray(seller.farm_photos) ? seller.farm_photos : [];

  // slug is unique — try twice with a fresh suffix before giving up
  for (let attempt = 0; attempt < 2; attempt++) {
    const base = slugifyAscii(seller.name_bn, "farm");
    const payload: TablesInsert<"farms"> = {
      slug: `${base}-${randomSuffix()}`.slice(0, 60),
      name_bn: seller.name_bn,
      name_en: null,
      type: farmTypeFor(seller.product_types),
      owner_user_id: seller.user_id,
      // The seller's phone is a private application field; a public farm phone
      // is the admin's call to publish (Farms panel).
      owner_phone: null,
      division: seller.division || "ঢাকা",
      district: seller.district || "ঢাকা",
      upazila: seller.upazila ?? null,
      address_bn: seller.farm_address_bn ?? null,
      description_bn: `${seller.district} জেলার ${seller.name_bn} — বিশ্বাস এগ্রো মার্কেটপ্লেসের যাচাইকৃত বিক্রেতা।`,
      cover: photos[0] ?? null,
      images: photos,
      // Live the moment the seller is approved; a request-driven farm (admin
      // installing cameras) goes live with its cameras.
      is_active: approved,
      is_premium: false,
      sort_order: 100,
    };

    const { data, error } = await client.from("farms").insert(payload).select("id, slug, name_bn").single();
    if (error) {
      if (error.code === "23505" && attempt === 0) continue; // slug taken, retry
      console.warn("[seller-farm] create failed:", error.message);
      return null;
    }
    return data as unknown as SellerFarmLink;
  }
  return null;
}

export type ProvisionResult = {
  created: number;
  farmId: string | null;
  farmSlug: string | null;
  /** sellers.user_id of the requester — for the "your camera is live" notice */
  sellerUserId: string | null;
};

/**
 * "ইনস্টল সম্পন্ন" on a camera request → `camera_count` cameras on the farm,
 * each with a MediaMTX stream key the installer can point the camera at.
 * Only ever called on the *transition* into `installed` (see the admin CRUD
 * route), so saving the row again never duplicates cameras.
 */
export async function provisionRequestCameras(request: {
  id: string;
  seller_id: string | null;
  farm_id: string | null;
  camera_count: number;
}): Promise<ProvisionResult> {
  const empty: ProvisionResult = { created: 0, farmId: request.farm_id, farmSlug: null, sellerUserId: null };
  if (!isDbConfigured()) return empty;

  const client = db();
  let farmId = request.farm_id;
  let sellerUserId: string | null = null;

  if (request.seller_id) {
    const { data: sellerRow } = await client.from("sellers").select("*").eq("id", request.seller_id).maybeSingle();
    if (sellerRow) {
      const seller = sellerRow as unknown as Seller;
      sellerUserId = seller.user_id;
      // Installing hardware for a seller is an implicit go-ahead: give them a
      // farm even if the status column has not caught up yet.
      const farm = await ensureSellerFarm(seller, { requireApproved: false }).catch(() => null);
      if (farm) farmId = farm.id;
    }
  }

  if (!farmId) {
    console.warn("[seller-farm] camera request without a farm:", request.id);
    return { ...empty, sellerUserId };
  }

  const { data: farm } = await client
    .from("farms")
    .select("id, slug, type, is_active")
    .eq("id", farmId)
    .maybeSingle();
  if (!farm) return { ...empty, sellerUserId };

  const count = Math.min(Math.max(1, Number(request.camera_count) || 1), 20);
  const zone = ZONE_BY_FARM_TYPE[(farm.type as FarmType) ?? "vegetables"] ?? "জমি";
  const targetFarmId: string = farmId;

  const rows: TablesInsert<"cameras">[] = Array.from({ length: count }, (_, i) => ({
    farm_id: targetFarmId,
    name_bn: `ক্যামেরা ${toBn(i + 1)}`,
    zone_bn: zone,
    protocol: "hls",
    // MediaMTX path name — the installer sets the camera to push to this.
    stream_key: `${farm.slug}-cam-${i + 1}`,
    status: "online",
    is_active: true,
    is_premium: true,
    max_viewers: 50,
    sort_order: i + 1,
  }));

  const { error } = await client.from("cameras").insert(rows);
  if (error) {
    console.warn("[seller-farm] camera provisioning failed:", error.message);
    return { created: 0, farmId, farmSlug: farm.slug, sellerUserId };
  }

  // A farm with live cameras is public — that is the whole point of the request.
  if (!farm.is_active) await client.from("farms").update({ is_active: true }).eq("id", farmId);
  await client.from("camera_requests").update({ farm_id: farmId }).eq("id", request.id);

  return { created: count, farmId, farmSlug: farm.slug, sellerUserId };
}
