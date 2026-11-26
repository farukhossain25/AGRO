import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { created, fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { sellerProductSchema } from "@/lib/validation";
import { getSellerByUser, getSellerSettings } from "@/lib/sellers";
import { notifyAdmins } from "@/lib/notify";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";

/**
 * Seller product CRUD.
 * Sellers can only touch their own rows. The seller account itself is what
 * gets reviewed; once it is approved, products publish immediately
 * (approval_status = 'approved') — a per-product queue only meant stock and
 * price edits silently vanished from the store until an admin noticed.
 */

/** The listing pages are ISR-cached; a new or edited product must not wait for the next tick. */
function refreshStorefront() {
  try {
    revalidatePath("/products");
    revalidatePath("/");
  } catch {
    /* outside a request context — nothing to purge */
  }
}

async function requireSeller() {
  const user = await requireUser();
  const seller = await getSellerByUser(user.id);
  if (!seller) {
    const err = new Error("SELLER_REQUIRED") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return { user, seller };
}

/**
 * Same as requireSeller(), but the shop must also be open for business.
 *
 * POST already refused a non-approved seller. PATCH and DELETE did not — they
 * only checked "is there a seller row for this user". So a seller who had been
 * suspended (status = 'suspended'), or whose application was rejected, could
 * still rewrite the price, photo and stock of every product already in the
 * catalogue, and could delete them. Suspension was cosmetic.
 *
 * Reads (GET) stay on requireSeller(): a suspended seller should still be able
 * to see their own catalogue and understand what happened.
 */
async function requireApprovedSeller() {
  const { user, seller } = await requireSeller();
  if (seller.status !== "approved") {
    const err = new Error("SELLER_NOT_APPROVED") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return { user, seller };
}

export async function GET() {
  try {
    const { seller } = await requireSeller();
    const { data, error } = await db()
      .from("products")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "product"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "seller-product", 20, 60_000);
    if (guard) return guard;

    const { user, seller } = await requireSeller();
    if (seller.status !== "approved") return fail("আপনার সেলার অ্যাকাউন্ট এখনো অনুমোদিত নয়", 403);

    const data = sellerProductSchema.parse(await req.json());
    const client = db();
    const settings = await getSellerSettings();

    const payload: TablesInsert<"products"> = {
      seller_id: seller.id,
      farm_id: seller.farm_id,
      category_id: data.category_id,
      slug: slugify(data.name_en),
      name_bn: data.name_bn,
      name_en: data.name_en,
      description_bn: data.description_bn || null,
      unit: data.unit,
      unit_en: data.unit_en,
      price: data.price,
      compare_price: data.compare_price ?? null,
      stock: data.stock,
      image: data.images?.[0] ?? data.image ?? null,
      images: data.images?.length ? data.images : data.image ? [data.image] : [],
      weight_grams: data.weight_grams ?? null,
      is_active: true,
      is_featured: false,
      approval_status: settings.auto_approve_products ? "approved" : "pending",
      rejection_reason: null,
    };

    const { data: product, error } = await client.from("products").insert(payload).select().single();
    if (error) throw error;

    refreshStorefront();

    // Informational only — the product is already live.
    await notifyAdmins({
      kind: "product",
      title: settings.auto_approve_products ? "নতুন পণ্য যোগ হয়েছে (স্বয়ংক্রিয় অনুমোদিত)" : "নতুন পণ্য অনুমোদনের অপেক্ষায়",
      body: `${data.name_bn} · ${seller.name_bn}`,
      link: `${ADMIN_BASE}/products`,
    }).catch(() => undefined);

    return created({
      product,
      note: settings.auto_approve_products ? "পণ্যটি এখনই স্টোরে দেখা যাচ্ছে" : "পণ্যটি অ্যাডমিন অনুমোদনের অপেক্ষায় আছে",
      submittedBy: user.id,
    });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if ((error as { message?: string }).message === "SELLER_NOT_APPROVED") {
      return fail("আপনার সেলার অ্যাকাউন্ট এখনো অনুমোদিত নয় — পণ্য বদলানো যাবে না", 403);
    }
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const { seller } = await requireApprovedSeller();
    const body = await req.json();
    const data = sellerProductSchema.partial().parse(body);
    const id = String(body.id ?? "");
    if (!id) return fail("পণ্যের আইডি দিন", 422);

    const client = db();
    const { data: existing } = await client
      .from("products")
      .select("id, seller_id, approval_status, image, images")
      .eq("id", id)
      .maybeSingle();

    if (!existing || existing.seller_id !== seller.id) return fail("পণ্য পাওয়া যায়নি", 404);

    const patch: Record<string, unknown> = {};
    for (const key of [
      "category_id",
      "name_bn",
      "name_en",
      "description_bn",
      "unit",
      "unit_en",
      "price",
      "compare_price",
      "stock",
      "image",
      "weight_grams",
    ] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

    // The gallery travels with the cover: a new list replaces the old one; a
    // cover set on its own just takes the front slot and keeps the rest.
    if (data.images !== undefined) {
      patch.images = data.images;
      patch.image = data.images[0] ?? null;
    } else if (data.image !== undefined) {
      const rest = ((existing.images as string[] | null) ?? []).filter((src) => src !== existing.image).slice(0, 5);
      patch.images = data.image ? [data.image, ...rest] : rest;
    }

    // No re-queue on edit: a verified seller updating today's stock must not
    // have the product disappear from the store until someone re-approves it.
    const { data: product, error } = await client
      .from("products")
      .update(patch as TablesUpdate<"products">)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    refreshStorefront();
    return ok(product);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if ((error as { message?: string }).message === "SELLER_NOT_APPROVED") {
      return fail("আপনার সেলার অ্যাকাউন্ট এখনো অনুমোদিত নয় — পণ্য বদলানো যাবে না", 403);
    }
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const { seller } = await requireApprovedSeller();
    const { id } = await req.json();
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await db().from("products").delete().eq("id", id).eq("seller_id", seller.id);
    if (error) throw error;
    refreshStorefront();
    return ok({ deleted: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if ((error as { message?: string }).message === "SELLER_NOT_APPROVED") {
      return fail("আপনার সেলার অ্যাকাউন্ট এখনো অনুমোদিত নয় — পণ্য বদলানো যাবে না", 403);
    }
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}
