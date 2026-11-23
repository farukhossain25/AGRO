import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(50),
});

const schema = z.object({
  name_bn: z.string().trim().min(1).max(80).default("আমার কম্বো"),
  items: z.array(itemSchema).min(2, "কমপক্ষে ২টি পণ্য বেছে নিন").max(20),
  repeat_interval: z.enum(["none", "weekly", "monthly"]).default("none"),
  save: z.boolean().default(true),
});

/**
 * POST /api/combos/custom
 * --------------------------------------------------------------------------
 * Prices the selection server-side (never trusts client prices), applies the
 * bundle discount, and optionally stores it as a reusable custom combo.
 */
export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "custom-combo", 20, 60_000);
    if (guard) return guard;

    const user = await requireUser().catch(() => null);
    const data = schema.parse(await req.json());

    const client = db();
    const ids = Array.from(new Set(data.items.map((i) => i.productId)));

    const { data: products, error } = await client
      .from("products")
      .select("id, slug, name_bn, name_en, unit, price, compare_price, stock, image, images, seller_id, is_active")
      .in("id", ids);

    if (error) throw error;

    const byId = new Map((products ?? []).map((p) => [p.id as string, p]));
    const lines: Array<Record<string, unknown>> = [];
    let subtotal = 0;
    let compareTotal = 0;

    for (const item of data.items) {
      const product = byId.get(item.productId);
      if (!product || !product.is_active) continue;
      if (Number(product.stock) < item.qty) {
        return fail(`"${product.name_bn}" এর পর্যাপ্ত স্টক নেই`, 409);
      }

      const price = Number(product.price);
      const compare = Number(product.compare_price ?? price);
      subtotal += price * item.qty;
      compareTotal += (compare > price ? compare : price) * item.qty;

      lines.push({
        productId: product.id,
        slug: product.slug,
        name_bn: product.name_bn,
        unit: product.unit,
        price,
        qty: item.qty,
        lineTotal: Math.round(price * item.qty * 100) / 100,
        sellerId: product.seller_id,
        image: product.image ?? product.images?.[0] ?? null,
      });
    }

    if (lines.length < 2) return fail("কমপক্ষে ২টি বৈধ পণ্য বেছে নিন", 422);

    // Bundle discount: 5% for 4–6 items, 8% for 7+ (capped at ৳300).
    const totalQty = data.items.reduce((n, i) => n + i.qty, 0);
    const pct = totalQty >= 7 ? 8 : totalQty >= 4 ? 5 : 0;
    const bundleDiscount = Math.min(300, Math.round(subtotal * (pct / 100) * 100) / 100);
    const total = Math.round((subtotal - bundleDiscount) * 100) / 100;

    let saved = null;
    if (user && data.save) {
      const { data: row, error: saveError } = await client
        .from("custom_combos")
        .insert({
          user_id: user.id,
          name_bn: data.name_bn,
          items: lines as unknown as import("@/lib/database.types").Json,
          item_count: totalQty,
          price_cached: total,
          repeat_interval: data.repeat_interval,
          is_active: true,
        })
        .select()
        .single();

      if (saveError) throw saveError;
      saved = row;
    }

    return created({
      id: saved?.id ?? null,
      name_bn: data.name_bn,
      items: lines,
      item_count: totalQty,
      subtotal: Math.round(subtotal * 100) / 100,
      compare_total: Math.round(compareTotal * 100) / 100,
      bundle_discount: bundleDiscount,
      bundle_percent: pct,
      total,
      repeat_interval: data.repeat_interval,
      signedIn: Boolean(user),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const { data, error } = await db()
      .from("custom_combos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { id } = await req.json();
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await db().from("custom_combos").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return ok({ deleted: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}
