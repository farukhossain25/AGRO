import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { sellerApplySchema } from "@/lib/validation";
import { getSellerSettings, getSellerByUser } from "@/lib/sellers";
import { notify, notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * GET  /api/sellers/apply → the current user's seller record (or null)
 * POST /api/sellers/apply → apply to sell (or update a rejected application)
 */
export async function GET() {
  try {
    const user = await requireUser();
    const seller = await getSellerByUser(user.id);
    return ok(seller);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "seller"
  );
}

export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "seller-apply", 5, 60 * 60_000);
    if (guard) return guard;

    const user = await requireUser();
    const data = sellerApplySchema.parse(await req.json());

    const existing = await getSellerByUser(user.id);
    if (existing && existing.status !== "rejected") {
      return fail(
        existing.status === "approved"
          ? "আপনি ইতিমধ্যে অনুমোদিত বিক্রেতা"
          : "আপনার আবেদন আগেই জমা হয়েছে — অনুমোদনের অপেক্ষায়",
        409
      );
    }

    const settings = await getSellerSettings();
    const client = db();

    const baseSlug = slugify(data.name_bn);
    const slug = existing?.slug ?? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const payload = {
      user_id: user.id,
      slug,
      name_bn: data.name_bn,
      phone: data.phone,
      email: data.email || user.email,
      nid: data.nid || null,
      farm_address_bn: data.farm_address_bn,
      division: data.division,
      district: data.district,
      product_types: data.product_types,
      payout_method: data.payout_method,
      payout_number: data.payout_number,
      bank_name: data.bank_name || null,
      bank_account: data.bank_account || null,
      farm_id: data.farm_id ?? null,
      commission_percent: settings.default_commission_percent,
      status: settings.auto_approve ? "approved" : "pending",
      rejection_reason: null,
      approved_at: settings.auto_approve ? new Date().toISOString() : null,
    };

    const { data: seller, error } = existing
      ? await client.from("sellers").update(payload).eq("id", existing.id).select().single()
      : await client.from("sellers").insert(payload).select().single();

    if (error) throw error;

    await client.from("users").update({ is_seller: true }).eq("id", user.id);

    await notify({
      userId: user.id,
      kind: "seller",
      title: seller.status === "approved" ? "আপনার সেলার অ্যাকাউন্ট অনুমোদিত" : "আবেদন জমা হয়েছে",
      body:
        seller.status === "approved"
          ? "এখন পণ্য যোগ করে বিক্রি শুরু করতে পারবেন।"
          : "আমরা ২৪–৪৮ ঘণ্টার মধ্যে যাচাই করে জানাব।",
      link: "/seller",
    }).catch(() => undefined);

    await notifyAdmins({
      kind: "seller",
      title: "নতুন সেলার আবেদন",
      body: `${data.name_bn} · ${data.district}`,
      link: "/admin/sellers",
    }).catch(() => undefined);

    return created(seller);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}
