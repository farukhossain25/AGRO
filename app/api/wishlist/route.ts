import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { currentUser, fail, handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const toggleSchema = z.object({
  productId: z.string().uuid("সঠিক পণ্য আইডি দিন"),
});

/**
 * GET    /api/wishlist           → saved product ids + full product rows
 * POST   /api/wishlist           → { productId } toggle (returns { saved })
 * DELETE /api/wishlist?productId → remove
 *
 * RLS in 0004 restricts wishlists to `user_id = app_user_id()`, so a browser
 * holding the anon key can only ever touch its own rows.
 */
export async function GET() {
  try {
    const session = await currentUser();
    if (!session) return ok({ items: [], ids: [] });
    if (!isDbConfigured()) return ok({ items: [], ids: [] });

    const { data, error } = await db()
      .from("wishlists")
      .select("product_id, created_at, products(id, slug, name_bn, name_en, price, compare_price, image, unit, stock, rating, review_count, is_active)")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });

    if (error) return ok({ items: [], ids: [] });

    const rows = (data ?? []) as { product_id: string; products: unknown }[];
    const items = rows.map((r) => r.products).filter(Boolean);

    return ok({ items, ids: rows.map((r) => r.product_id) });
  } catch (error) {
    // Offline / DB unreachable: an empty wishlist is a valid degraded answer —
    // never break the page or the header over it.
    console.warn("[wishlist] read failed:", (error as Error).message);
    return ok({ items: [], ids: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await currentUser();
    if (!session) return fail("উইশলিস্টে রাখতে আগে লগইন করুন", 401);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const { productId } = toggleSchema.parse(await req.json());

    const { data: existing } = await db()
      .from("wishlists")
      .select("id")
      .eq("user_id", session.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (existing) {
      await db().from("wishlists").delete().eq("id", existing.id);
      return ok({ saved: false });
    }

    const { error } = await db()
      .from("wishlists")
      .insert({ user_id: session.id, product_id: productId });

    if (error) return fail("উইশলিস্টে সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন", 503);
    return ok({ saved: true });
  } catch (error) {
    console.warn("[wishlist] write failed:", (error as Error).message);
    return fail("উইশলিস্টে সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন", 503);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    if (!productId) return fail("পণ্য আইডি দিন", 400);

    await db()
      .from("wishlists")
      .delete()
      .eq("user_id", session.id)
      .eq("product_id", productId);

    return ok({ saved: false });
  } catch (error) {
    return handleError(error);
  }
}
