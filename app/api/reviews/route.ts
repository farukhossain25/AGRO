import { db } from "@/lib/db";
import { clientKey, created, currentUser, handleError, ok, rateLimit, sanitizeText, tooMany } from "@/lib/api";
import { reviewSchema } from "@/lib/validation";
import { getApprovedReviews } from "@/lib/data";
import { getReviewSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const productId = new URL(req.url).searchParams.get("product_id") ?? undefined;
    const reviews = await getApprovedReviews(productId, 20);
    return ok(reviews);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "review"), 5, 30 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const data = reviewSchema.parse(await req.json());
    const user = await currentUser().catch(() => null);

    // A null product_id means "site-wide" testimonial; the DB expects a FK, so
    // attach it to no product only when the table allows NULL (it does).
    const productId =
      data.product_id === "00000000-0000-4000-8000-000000000000" ? null : data.product_id;

    /* `reviews.auto_publish` (from the panel's settings screen) decides whether
       a new review appears immediately or waits for moderation. Default is
       publish, matching the storefront's "রিভিউ সাথে সাথে দেখাবে" expectation. */
    const reviewRules = await getReviewSettings();

    const { data: review, error } = await db()
      .from("reviews")
      .insert({
        product_id: productId,
        user_id: user?.id ?? null,
        author_name: sanitizeText(data.name_bn, 60),
        author_location: sanitizeText(data.location_bn ?? "", 60) || null,
        rating: data.rating,
        comment: sanitizeText(data.comment, 600),
        status: reviewRules.auto_publish ? "published" : "hidden",
      })
      .select("id")
      .single();

    if (error) throw error;
    return created({ id: review.id, pending: !reviewRules.auto_publish });
  } catch (error) {
    return handleError(error);
  }
}
