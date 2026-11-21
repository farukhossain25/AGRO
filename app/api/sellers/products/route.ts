import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { sellerProductSchema } from "@/lib/validation";
import { getSellerByUser } from "@/lib/sellers";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Seller product CRUD.
 * Sellers can only touch their own rows, and every new product goes into the
 * admin approval queue (approval_status = 'pending').
 */

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

    const payload = {
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
      image: data.image || null,
      images: data.image ? [data.image] : [],
      weight_grams: data.weight_grams ?? null,
      is_active: true,
      is_featured: false,
      approval_status: "pending",
      approval_note: null,
    };

    const { data: product, error } = await client.from("products").insert(payload).select().single();
    if (error) throw error;

    await notifyAdmins({
      kind: "product",
      title: "নতুন পণ্য অনুমোদনের অপেক্ষায়",
      body: `${data.name_bn} · ${seller.name_bn}`,
      link: "/admin/products",
    }).catch(() => undefined);

    return created({
      product,
      note: "পণ্যটি অ্যাডমিন অনুমোদনের অপেক্ষায় আছে",
      submittedBy: user.id,
    });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const { seller } = await requireSeller();
    const body = await req.json();
    const data = sellerProductSchema.partial().parse(body);
    const id = String(body.id ?? "");
    if (!id) return fail("পণ্যের আইডি দিন", 422);

    const client = db();
    const { data: existing } = await client
      .from("products")
      .select("id, seller_id, approval_status")
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

    // Editing an approved product re-enters the queue — prices and stock are
    // customer-facing, so an admin should see the change.
    if (existing.approval_status === "approved") patch.approval_status = "pending";

    const { data: product, error } = await client
      .from("products")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return ok(product);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const { seller } = await requireSeller();
    const { id } = await req.json();
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await db().from("products").delete().eq("id", id).eq("seller_id", seller.id);
    if (error) throw error;
    return ok({ deleted: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("সেলার অ্যাকাউন্ট প্রয়োজন", 403);
    return handleError(error);
  }
}
