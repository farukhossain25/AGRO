import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductsByIds, getProductsBySlugs, getCombosBySlugs, getCombos } from "@/lib/queries";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["product", "combo"]).default("product"),
        slug: z.string().trim().max(120).optional(),
        quantity: z.number().int().min(1).max(99).default(1),
      })
    )
    .max(60),
});

type Line = {
  /** The id the client should now use — a repaired id when the row was re-keyed. */
  id: string;
  kind: "product" | "combo";
  slug: string | null;
  ok: boolean;
  name: string;
  price: number;
  stock: number;
  reason?: string;
};

/**
 * POST /api/cart/validate
 *
 * Cheap, read-only re-check of a cart against the live catalogue. The cart page
 * calls it on mount so a customer sees "এই পণ্যটি আর নেই" *before* filling in
 * an address, and so a cart saved before a catalogue re-seed (ids changed,
 * slugs did not) is healed in place instead of failing at checkout.
 */
export async function POST(req: Request) {
  try {
    const { items } = bodySchema.parse(await req.json());
    if (!items.length) return NextResponse.json({ ok: true, data: { lines: [] } });

    const productIds = items.filter((i) => i.kind === "product").map((i) => i.id);
    const productSlugs = items.filter((i) => i.kind === "product" && i.slug).map((i) => i.slug as string);
    const needsCombos = items.some((i) => i.kind === "combo");

    const [byId, bySlug, allCombos, combosBySlug] = await Promise.all([
      productIds.length ? getProductsByIds(productIds) : Promise.resolve([]),
      productSlugs.length ? getProductsBySlugs(productSlugs) : Promise.resolve([]),
      needsCombos ? getCombos() : Promise.resolve([]),
      needsCombos
        ? getCombosBySlugs(items.filter((i) => i.kind === "combo" && i.slug).map((i) => i.slug as string))
        : Promise.resolve([]),
    ]);

    const products = [...byId, ...bySlug];
    const combos = [...allCombos, ...combosBySlug];

    const lines: Line[] = items.map((item) => {
      if (item.kind === "product") {
        const product =
          products.find((p) => p.id === item.id) ??
          (item.slug ? products.find((p) => p.slug === item.slug) : undefined);

        if (!product) {
          return {
            id: item.id,
            kind: "product",
            slug: item.slug ?? null,
            ok: false,
            name: "",
            price: 0,
            stock: 0,
            reason: "পণ্যটি আর বিক্রিতে নেই",
          };
        }
        const reason =
          product.is_active === false
            ? "পণ্যটি বন্ধ আছে"
            : product.stock <= 0
              ? "স্টক শেষ"
              : undefined;
        return {
          id: product.id,
          kind: "product",
          slug: product.slug,
          ok: !reason,
          name: product.name_bn,
          price: Number(product.price),
          stock: product.stock,
          reason,
        };
      }

      const combo =
        combos.find((c) => c.id === item.id) ??
        (item.slug ? combos.find((c) => c.slug === item.slug) : undefined);

      if (!combo) {
        return {
          id: item.id,
          kind: "combo",
          slug: item.slug ?? null,
          ok: false,
          name: "",
          price: 0,
          stock: 0,
          reason: "কম্বোটি আর পাওয়া যাচ্ছে না",
        };
      }
      return {
        id: combo.id,
        kind: "combo",
        slug: combo.slug,
        ok: combo.is_active !== false,
        name: combo.name_bn,
        price: Number(combo.price),
        stock: 99,
        reason: combo.is_active === false ? "কম্বোটি বন্ধ আছে" : undefined,
      };
    });

    return NextResponse.json({ ok: true, data: { lines } });
  } catch (error) {
    console.error("[cart/validate] failed:", (error as Error).message, error);
    return handleError(error);
  }
}
