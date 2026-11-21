import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import {
  clientKey,
  currentUser,
  fail,
  handleError,
  ok,
  rateLimit,
  sanitizeText,
  tooMany,
} from "@/lib/api";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   POST /api/reviews/:id/reply — the seller's single public reply
   --------------------------------------------------------------------------
   A seller may reply once to a review of their own product. They can NEVER
   edit or delete the review itself — that is enforced by the
   order_reviews_seller_guard trigger in 0005 as well.
   ========================================================================== */

const schema = z.object({ body: z.string().trim().min(2, "উত্তর লিখুন").max(1000) });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const limited = rateLimit(clientKey(req, "review-reply"), 10, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const user = await currentUser();
    if (!user) return fail("আগে লগইন করুন", 401);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const { id } = await ctx.params;
    const { body } = schema.parse(await req.json());
    const text = sanitizeText(body, 1000);
    if (!text) return fail("উত্তর লিখুন", 422);

    const client = db();

    const { data: review } = await client
      .from("order_reviews")
      .select("id, seller_id, user_id, product_id, seller_reply, status")
      .eq("id", id)
      .maybeSingle();

    if (!review) return fail("রিভিউ পাওয়া যায়নি", 404);

    // ---- authorise: admin, or the seller who owns this review
    const isAdmin = user.role === "admin";
    let isSeller = false;

    if (review.seller_id) {
      const { data: seller } = await client
        .from("sellers")
        .select("user_id")
        .eq("id", review.seller_id)
        .maybeSingle();
      isSeller = seller?.user_id === user.id;
    }

    if (!isAdmin && !isSeller) {
      return fail("শুধু সংশ্লিষ্ট সেলার বা অ্যাডমিন উত্তর দিতে পারেন", 403);
    }

    if (review.seller_reply) {
      return fail("এই রিভিউতে ইতিমধ্যে একটি উত্তর দেওয়া হয়েছে (সম্পাদনা করা যায় না)", 409);
    }

    if (review.status === "hidden") {
      return fail("রিভিউটি লুকানো আছে — উত্তর দেওয়া যাবে না", 409);
    }

    const { error } = await client
      .from("order_reviews")
      .update({
        seller_reply: text,
        seller_replied_at: new Date().toISOString(),
        seller_replied_by: user.id,
      })
      .eq("id", id);

    if (error) throw error;

    // let the customer know
    await notify({
      userId: review.user_id as string,
      audience: "user",
      kind: "system",
      title: "আপনার রিভিউতে সেলার উত্তর দিয়েছেন",
      body: text.slice(0, 120),
      link: `/account/reviews`,
      meta: { reviewId: id },
      push: true,
    }).catch(() => undefined);

    return ok({ replied: true });
  } catch (error) {
    return handleError(error);
  }
}
