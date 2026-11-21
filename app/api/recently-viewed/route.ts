import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { currentUser, fail, handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ productId: z.string().uuid() });

const COLUMNS =
  "product_id, viewed_at, products(id, slug, name_bn, name_en, price, compare_price, image, unit, stock, rating, review_count, is_active)";

/**
 * GET  /api/recently-viewed  → the last 12 products this user opened
 * POST /api/recently-viewed  → { productId } upsert (called by the product page)
 *
 * Guests keep a localStorage list client-side; this endpoint is the
 * signed-in, cross-device version.
 */
export async function GET() {
  try {
    const session = await currentUser();
    if (!session || !isDbConfigured()) return ok({ items: [] });

    const { data, error } = await db()
      .from("recently_viewed")
      .select(COLUMNS)
      .eq("user_id", session.id)
      .order("viewed_at", { ascending: false })
      .limit(12);

    if (error) return ok({ items: [] });

    const items = ((data ?? []) as { products: unknown }[]).map((r) => r.products).filter(Boolean);
    return ok({ items });
  } catch (error) {
    console.warn("[recently-viewed] read failed:", (error as Error).message);
    return ok({ items: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await currentUser();
    // Silent for guests — the client keeps its own localStorage list.
    if (!session || !isDbConfigured()) return ok({ tracked: false });

    const { productId } = schema.parse(await req.json());

    await db()
      .from("recently_viewed")
      .upsert(
        { user_id: session.id, product_id: productId, viewed_at: new Date().toISOString() },
        { onConflict: "user_id,product_id" }
      );

    // keep the table tidy: only the newest 60 rows per user matter
    const { data: stale } = await db()
      .from("recently_viewed")
      .select("product_id")
      .eq("user_id", session.id)
      .order("viewed_at", { ascending: false })
      .range(60, 200);

    if (stale?.length) {
      await db()
        .from("recently_viewed")
        .delete()
        .eq("user_id", session.id)
        .in(
          "product_id",
          stale.map((s) => s.product_id)
        );
    }

    return ok({ tracked: true });
  } catch (error) {
    // never break a product page over analytics
    if (error && typeof error === "object" && "issues" in error) return fail("পণ্য আইডি সঠিক নয়", 422);
    return ok({ tracked: false });
  }
}
