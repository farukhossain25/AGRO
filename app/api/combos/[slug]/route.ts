import { decodeRouteParam } from "@/lib/format";
import { getComboBySlug } from "@/lib/data";
import { fail, ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params;
    const slug = decodeRouteParam(rawSlug);
    const combo = await getComboBySlug(slug);
    if (!combo) return fail("কম্বো পাওয়া যায়নি", 404);
    return ok(combo);
  } catch (error) {
    return handleError(error);
  }
}
