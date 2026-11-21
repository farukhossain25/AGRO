import { getProducts } from "@/lib/data";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Lightweight search endpoint used by the header search suggestions. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? undefined;
    const categorySlug = url.searchParams.get("category") ?? undefined;
    const sort = (url.searchParams.get("sort") as "price_asc" | "price_desc" | "newest" | "rating" | null) ?? undefined;
    const limit = Math.min(48, Number(url.searchParams.get("limit") ?? 24) || 24);

    const products = await getProducts({ search, categorySlug, sort: sort ?? undefined, limit });

    return ok(
      products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name_bn: p.name_bn,
        name_en: p.name_en,
        price: p.price,
        unit: p.unit,
        image: p.image,
        stock: p.stock,
        rating: p.rating,
      }))
    );
  } catch (error) {
    return handleError(error);
  }
}
