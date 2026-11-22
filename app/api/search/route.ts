import { NextResponse } from "next/server";
import { getProducts } from "@/lib/data";

/* ==========================================================================
   /api/search — the live suggestions behind the header search box
   --------------------------------------------------------------------------
   Returns at most six products for a query, shaped small on purpose: a
   suggestion menu that ships full product rows would cost more than the page.
   Bangla and English names both match (see lib/queries.ts) and the result is
   cached for a minute at the edge, so typing does not hammer Postgres.

   GET /api/search?q=আম  →  { ok: true, data: { items: [...] } }
   ========================================================================== */

export const revalidate = 30;

export async function GET(req: Request) {
  const query = (new URL(req.url).searchParams.get("q") ?? "").trim();

  // One letter matches everything — wait until the visitor has typed two.
  if (query.length < 2) {
    return NextResponse.json({ ok: true, data: { items: [] } });
  }

  try {
    const products = await getProducts({ search: query.slice(0, 60) });
    const items = products.slice(0, 6).map((product) => ({
      slug: product.slug,
      name_bn: product.name_bn,
      name_en: product.name_en,
      price: product.price,
      unit: product.unit,
      image: product.image ?? product.images?.[0] ?? null,
      stock: product.stock,
    }));

    return NextResponse.json(
      { ok: true, data: { items, total: products.length } },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
    );
  } catch {
    // A failed suggestion lookup must never break the header.
    return NextResponse.json({ ok: true, data: { items: [] } });
  }
}
