import { db } from "@/lib/db";
import { clientKey, created, currentUser, fail, handleError, ok, rateLimit, sanitizeText, tooMany } from "@/lib/api";
import { reviewSchema } from "@/lib/validation";
import { getApprovedReviews } from "@/lib/data";

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

    /* Reviews used to be accepted from anyone: `user_id` was simply null when
       there was no session, and the row went live immediately (no moderation
       queue). On a public page that is an open graffiti wall — one visitor with
       a script can post unlimited 1-star reviews under any name, and nothing
       ties the review to a real person if it needs removing.
       A session is now required. `rating_verified` / order checks stay as they
       are; this only closes the "no account at all" hole. */
    const user = await currentUser();
    if (!user) return fail("রিভিউ দিতে লগইন করুন", 401);

    // A null product_id means "site-wide" testimonial; the DB expects a FK, so
    // attach it to no product only when the table allows NULL (it does).
    const productId =
      data.product_id === "00000000-0000-4000-8000-000000000000" ? null : data.product_id;

    /* Reviews go live the moment they are submitted — no approval queue. The
       panel can hide or delete one afterwards (/foisal/reviews), which is the
       only moderation the owner asked for. */
    const { data: review, error } = await db()
      .from("reviews")
      .insert({
        product_id: productId,
        user_id: user.id,
        author_name: sanitizeText(data.name_bn, 60),
        author_location: sanitizeText(data.location_bn ?? "", 60) || null,
        rating: data.rating,
        comment: sanitizeText(data.comment, 600),
        status: "published",
      })
      .select("id")
      .single();

    if (error) throw error;
    return created({ id: review.id, published: true });
  } catch (error) {
    return handleError(error);
  }
}
