import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import {
  clientKey,
  created,
  currentUser,
  fail,
  handleError,
  ok,
  rateLimit,
  sanitizeText,
  tooMany,
} from "@/lib/api";
import { notify } from "@/lib/notify";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   Verified-purchase reviews that belong to an order (migration 0005)
   --------------------------------------------------------------------------
   GET  /api/reviews/order?orderId=…  → items that can be reviewed
   POST /api/reviews/order            → create or edit one product review

   Rules enforced here AND in SQL:
     • the order must belong to the caller
     • the line's sub-order must be 'delivered' (or the order itself)
     • one review per (order, product) — a second POST edits it
     • edits allowed only within 7 days of creation
     • ≤ 3 photos, tags from the approved vocabulary
     • rating 1-2 or a negative tag notifies the seller + all admins
   ========================================================================== */

const LOW_RATING = 2;

const createSchema = z.object({
  orderId: z.string().uuid("সঠিক অর্ডার আইডি দিন"),
  productId: z.string().uuid("সঠিক পণ্য আইডি দিন"),
  rating: z.coerce.number().int().min(1, "রেটিং ১ থেকে ৫ দিন").max(5, "রেটিং ১ থেকে ৫ দিন"),
  sellerRating: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(2000).optional(),
  photos: z.array(z.string().url("ছবির লিংক সঠিক নয়")).max(3, "সর্বোচ্চ ৩টি ছবি").optional(),
  tags: z.array(z.string().max(40)).max(8).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("রিভিউ দিতে আগে লগইন করুন", 401);

    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) return fail("অর্ডার আইডি দিন", 422);

    const { getReviewableItems } = await import("@/lib/reviews");
    const result = await getReviewableItems(orderId, user.id);

    if (!result.items.length) {
      return ok({
        delivered: false,
        items: [],
        message: "অর্ডারটি এখনো ডেলিভারি হয়নি — ডেলিভারির পর রিভিউ দিতে পারবেন।",
      });
    }

    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "order-review"), 8, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const user = await currentUser();
    if (!user) return fail("রিভিউ দিতে আগে লগইন করুন", 401);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const body = createSchema.parse(await req.json());
    const client = db();

    // ---- 1. the order must be the caller's
    const { data: order } = await client
      .from("orders")
      .select("id, user_id, order_no, status")
      .eq("id", body.orderId)
      .maybeSingle();

    if (!order || order.user_id !== user.id) {
      return fail("এই অর্ডারটি আপনার নয়", 403);
    }

    // ---- 2. the line must be delivered
    const { data: line } = await client
      .from("order_items")
      .select("id, product_id, sub_order_id, seller_id, sub_orders(status, seller_id)")
      .eq("order_id", body.orderId)
      .eq("product_id", body.productId)
      .maybeSingle();

    if (!line) return fail("এই পণ্যটি এই অর্ডারে নেই", 404);

    const subStatus = (line.sub_orders as unknown as { status: string } | null)?.status;
    const delivered = subStatus === "delivered" || order.status === "delivered";

    if (!delivered) {
      return fail("পণ্যটি এখনো ডেলিভারি হয়নি — ডেলিভারির পর রিভিউ দিতে পারবেন", 409);
    }

    const sellerId = (line.seller_id as string | null) ?? null;

    // ---- 3. one review per product per order (edit instead)
    const { data: existing } = await client
      .from("order_reviews")
      .select("id, created_at, status")
      .eq("order_id", body.orderId)
      .eq("product_id", body.productId)
      .maybeSingle();

    const photos = (body.photos ?? []).slice(0, 3);
    const tags = (body.tags ?? []).slice(0, 8);
    const comment = body.comment ? sanitizeText(body.comment, 2000) : null;
    const title = body.title ? sanitizeText(body.title, 120) : null;

    if (existing) {
      const ageDays = (Date.now() - new Date(existing.created_at).getTime()) / 864e5;
      if (ageDays > 7) {
        return fail("রিভিউ দেওয়ার ৭ দিন পর আর সম্পাদনা করা যায় না", 403);
      }
      if (existing.status === "hidden") {
        return fail("এই রিভিউটি অ্যাডমিন লুকিয়েছেন — সম্পাদনা করা যাবে না", 403);
      }

      const { error } = await client
        .from("order_reviews")
        .update({
          rating: body.rating,
          seller_rating: body.sellerRating ?? null,
          title_bn: title,
          comment,
          photos,
          tags,
          edited_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;

      await maybeNotifyLowRating({
        rating: body.rating,
        tags,
        sellerId,
        productId: body.productId,
        orderNo: order.order_no as string,
        reviewId: existing.id,
        edited: true,
      });

      return ok({ id: existing.id, edited: true });
    }

    const { data: review, error } = await client
      .from("order_reviews")
      .insert({
        order_id: body.orderId,
        sub_order_id: (line.sub_order_id as string | null) ?? null,
        product_id: body.productId,
        seller_id: sellerId,
        user_id: user.id,
        rating: body.rating,
        seller_rating: body.sellerRating ?? null,
        title_bn: title,
        comment,
        photos,
        tags,
        is_verified_purchase: true,
        status: "published",
      })
      .select("id")
      .single();

    if (error) {
      // unique (order_id, product_id) — the other request won the race
      if ((error as { code?: string }).code === "23505") {
        return fail("এই পণ্যের রিভিউ আগেই দেওয়া হয়েছে — সম্পাদনা করুন", 409);
      }
      throw error;
    }

    await maybeNotifyLowRating({
      rating: body.rating,
      tags,
      sellerId,
      productId: body.productId,
      orderNo: order.order_no as string,
      reviewId: review.id,
      edited: false,
    });

    return created({ id: review.id, edited: false });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ helpers */

const NEGATIVE_TAGS = new Set(["stale", "under_weight", "bad_packaging", "late"]);

/**
 * A 1-2 star rating, or a negative quick tag, alerts the seller and every
 * admin immediately so quality issues get caught the same day.
 */
async function maybeNotifyLowRating(input: {
  rating: number;
  tags: string[];
  sellerId: string | null;
  productId: string;
  orderNo: string;
  reviewId: string;
  edited: boolean;
}): Promise<void> {
  const hasNegativeTag = input.tags.some((t) => NEGATIVE_TAGS.has(t));
  if (input.rating > LOW_RATING && !hasNegativeTag) return;

  try {
    // product name for the message
    const { data: product } = await db()
      .from("products")
      .select("name_bn, slug")
      .eq("id", input.productId)
      .maybeSingle();

    const productName = (product?.name_bn as string) ?? "একটি পণ্য";
    const reason = hasNegativeTag ? "নেতিবাচক ট্যাগ" : `${input.rating} স্টার রেটিং`;

    // 1. the seller who supplied it
    if (input.sellerId) {
      const { data: seller } = await db()
        .from("sellers")
        .select("user_id, name_bn")
        .eq("id", input.sellerId)
        .maybeSingle();

      if (seller?.user_id) {
        await notify({
          userId: seller.user_id as string,
          audience: "seller",
          kind: "product",
          title: `নতুন কম রেটিং — ${productName} (${reason})`,
          body: `অর্ডার ${input.orderNo}। রিভিউ দেখে দ্রুত ব্যবস্থা নিন।`,
          link: `/seller/reviews`,
          meta: { reviewId: input.reviewId, productId: input.productId, rating: input.rating },
          push: true,
        });
      }
    }

    // 2. every admin
    const { data: admins } = await db()
      .from("users")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);

    await Promise.all(
      (admins ?? []).map((admin) =>
        notify({
          userId: admin.id as string,
          audience: "admin",
          kind: "product",
          title: `কম রেটিং (${input.rating}★) — ${productName}`,
          body: `অর্ডার ${input.orderNo} · ${reason}`,
          link: `${ADMIN_BASE}/reviews`,
          meta: { reviewId: input.reviewId, productId: input.productId, sellerId: input.sellerId },
          push: true,
        }).catch(() => undefined)
      )
    );
  } catch (error) {
    // notifications must never fail the customer's review
    console.warn("[review] low-rating notify failed:", (error as Error).message);
  }
}
