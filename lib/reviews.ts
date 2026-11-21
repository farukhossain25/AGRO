import { db, isDbConfigured } from "./db";
import type {
  Complaint,
  ComplaintMessage,
  ComplaintStatus,
  OrderReview,
  RatingBreakdown,
  ReviewSort,
  ReviewTag,
  ReviewWithProfile,
  SupplierQuality,
} from "./types";

/* ==========================================================================
   Reviews, complaints and supplier quality (migration 0005)
   --------------------------------------------------------------------------
   Every read here is server-side with the service role; RLS still protects any
   direct browser access. Write rules (verified purchase, one-per-order,
   7-day edit window) are enforced in SQL as well as in the API layer.
   ========================================================================== */

const REVIEW_SELECT = `
  id, order_id, sub_order_id, product_id, seller_id, user_id, rating, seller_rating,
  title_bn, comment, photos, tags, is_verified_purchase, status, hidden_reason,
  seller_reply, seller_replied_at, created_at, updated_at, edited_at,
  products(name_bn, slug, image),
  sellers(name_bn, slug)
`.replace(/\s+/g, " ");

function shapeReview(row: Record<string, unknown>): ReviewWithProfile {
  const review = row as unknown as OrderReview & {
    products?: { name_bn: string; slug: string; image: string | null } | null;
    sellers?: { name_bn: string; slug: string } | null;
  };
  return {
    ...review,
    photos: (review.photos as string[] | null) ?? [],
    tags: (review.tags as string[] | null) ?? [],
    seller_rating: (review.seller_rating as number | null) ?? null,
    products: review.products ?? null,
    sellers: review.sellers ?? null,
    reviewer: null,
  };
}

/* -------------------------------------------------------- product reviews */

export async function getProductReviews(
  productId: string,
  opts: { sort?: ReviewSort; limit?: number; offset?: number } = {}
): Promise<ReviewWithProfile[]> {
  if (!isDbConfigured()) return [];

  const { sort = "newest", limit = 10, offset = 0 } = opts;

  try {
    let query = db()
      .from("order_reviews")
      .select(REVIEW_SELECT)
      .eq("product_id", productId)
      .eq("status", "published");

    query =
      sort === "highest"
        ? query.order("rating", { ascending: false }).order("created_at", { ascending: false })
        : sort === "lowest"
          ? query.order("rating", { ascending: true }).order("created_at", { ascending: false })
          : query.order("created_at", { ascending: false });

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) return [];

    const reviews = ((data ?? []) as unknown as Record<string, unknown>[]).map(shapeReview);

    // attach reviewer name + avatar from profiles (best-effort)
    const userIds = Array.from(new Set(reviews.map((r) => r.user_id))).slice(0, 40);
    if (userIds.length) {
      const { data: profiles } = await db()
        .from("profiles")
        .select("legacy_user_id, full_name, avatar_url")
        .in("legacy_user_id", userIds);

      const map = new Map(
        (profiles ?? []).map((p) => [
          p.legacy_user_id as string,
          {
            full_name: (p.full_name as string | null) ?? null,
            avatar_url: (p.avatar_url as string | null) ?? null,
          },
        ])
      );

      for (const review of reviews) {
        review.reviewer = map.get(review.user_id) ?? null;
      }
    }

    return reviews;
  } catch {
    return [];
  }
}

export async function getRatingBreakdown(productId: string): Promise<RatingBreakdown | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await db()
      .from("v_product_rating_breakdown")
      .select("total, r5, r4, r3, r2, r1, avg_rating")
      .eq("product_id", productId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      total: Number(data.total ?? 0),
      r5: Number(data.r5 ?? 0),
      r4: Number(data.r4 ?? 0),
      r3: Number(data.r3 ?? 0),
      r2: Number(data.r2 ?? 0),
      r1: Number(data.r1 ?? 0),
      avg_rating: Number(data.avg_rating ?? 0),
    };
  } catch {
    return null;
  }
}

export async function getReviewTags(): Promise<ReviewTag[]> {
  if (!isDbConfigured()) return FALLBACK_TAGS;
  try {
    const { data, error } = await db()
      .from("review_tags")
      .select("slug, label_bn, label_en, sentiment, sort_order")
      .order("sort_order");

    if (error || !data?.length) return FALLBACK_TAGS;
    return data as ReviewTag[];
  } catch {
    return FALLBACK_TAGS;
  }
}

const FALLBACK_TAGS: ReviewTag[] = [
  { slug: "fresh", label_bn: "তাজা", label_en: "Fresh", sentiment: "positive", sort_order: 1 },
  { slug: "packaging", label_bn: "ভালো প্যাকেজিং", label_en: "Good packaging", sentiment: "positive", sort_order: 2 },
  { slug: "right_weight", label_bn: "সঠিক ওজন", label_en: "Correct weight", sentiment: "positive", sort_order: 3 },
  { slug: "on_time", label_bn: "সময়মতো ডেলিভারি", label_en: "On-time delivery", sentiment: "positive", sort_order: 4 },
  { slug: "stale", label_bn: "বাসি", label_en: "Stale", sentiment: "negative", sort_order: 5 },
  { slug: "under_weight", label_bn: "কম ওজন", label_en: "Under weight", sentiment: "negative", sort_order: 6 },
  { slug: "bad_packaging", label_bn: "খারাপ প্যাকেজিং", label_en: "Bad packaging", sentiment: "negative", sort_order: 7 },
  { slug: "late", label_bn: "দেরি", label_en: "Late", sentiment: "negative", sort_order: 8 },
];

/* -------------------------------------------------- reviews for an order */

/**
 * Everything needed to render the review screen for one delivered order:
 * each product + its supplier, and whether it has already been reviewed.
 */
export type ReviewableItem = {
  productId: string;
  productNameBn: string;
  productImage: string | null;
  subOrderId: string | null;
  sellerId: string | null;
  sellerNameBn: string | null;
  quantity: number;
  existingReview: OrderReview | null;
  /** true while the 7-day edit window is still open */
  canEdit: boolean;
};

export async function getReviewableItems(
  orderId: string,
  userId: string
): Promise<{ delivered: boolean; items: ReviewableItem[] }> {
  if (!isDbConfigured()) return { delivered: false, items: [] };

  try {
    const { data: order } = await db()
      .from("orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.user_id !== userId) return { delivered: false, items: [] };

    const { data: items } = await db()
      .from("order_items")
      .select(
        "id, product_id, sub_order_id, seller_id, quantity, products(name_bn, image), sub_orders(status, seller_id, sellers(name_bn))"
      )
      .eq("order_id", orderId);

    const { data: reviews } = await db()
      .from("order_reviews")
      .select("*")
      .eq("order_id", orderId)
      .eq("user_id", userId);

    const reviewByProduct = new Map(
      ((reviews ?? []) as OrderReview[]).map((r) => [r.product_id, r])
    );

    const rows = (items ?? []) as unknown as {
      product_id: string;
      sub_order_id: string | null;
      seller_id: string | null;
      quantity: number;
      products: { name_bn: string; image: string | null } | null;
      sub_orders: { status: string; seller_id: string | null; sellers: { name_bn: string } | null } | null;
    }[];

    // An item is delivered when its own sub-order is delivered; fall back to
    // the parent order when the order was never split.
    const delivered = rows.some(
      (r) => r.sub_orders?.status === "delivered" || order.status === "delivered"
    );

    const items2: ReviewableItem[] = rows
      .filter((r) => r.sub_orders?.status === "delivered" || order.status === "delivered")
      .map((r) => {
        const existing = reviewByProduct.get(r.product_id) ?? null;
        const editedOrCreated = new Date(existing?.created_at ?? 0).getTime();
        return {
          productId: r.product_id,
          productNameBn: r.products?.name_bn ?? "পণ্য",
          productImage: r.products?.image ?? null,
          subOrderId: r.sub_order_id,
          sellerId: r.seller_id ?? r.sub_orders?.seller_id ?? null,
          sellerNameBn: r.sub_orders?.sellers?.name_bn ?? null,
          quantity: Number(r.quantity ?? 1),
          existingReview: existing,
          canEdit: !existing || Date.now() - editedOrCreated < 7 * 864e5,
        };
      });

    return { delivered, items: items2 };
  } catch {
    return { delivered: false, items: [] };
  }
}

/* ------------------------------------------------------------ complaints */

export async function getComplaintsForUser(userId: string): Promise<
  (Complaint & { products: { name_bn: string } | null; sellers: { name_bn: string } | null })[]
> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await db()
      .from("complaints")
      .select("*, products(name_bn), sellers(name_bn)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []) as never;
  } catch {
    return [];
  }
}

export async function getComplaint(
  id: string
): Promise<{ complaint: Complaint; messages: ComplaintMessage[] } | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await db().from("complaints").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;

    const { data: messages } = await db()
      .from("complaint_messages")
      .select("*")
      .eq("complaint_id", id)
      .eq("is_internal", false)
      .order("created_at");

    return {
      complaint: data as Complaint,
      messages: (messages ?? []) as ComplaintMessage[],
    };
  } catch {
    return null;
  }
}

/** Admin / seller inbox. */
export async function listComplaints(filters: {
  status?: ComplaintStatus | "all";
  sellerId?: string;
} = {}): Promise<
  (Complaint & { products: { name_bn: string } | null; sellers: { name_bn: string; slug: string } | null })[]
> {
  if (!isDbConfigured()) return [];
  try {
    let query = db()
      .from("complaints")
      .select("*, products(name_bn), sellers(name_bn, slug)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.sellerId) query = query.eq("seller_id", filters.sellerId);

    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as never;
  } catch {
    return [];
  }
}

export function problemTypeLabelBn(type: string): string {
  return (
    {
      spoiled: "পচা/নষ্ট",
      short_weight: "কম ওজন",
      wrong_item: "ভুল পণ্য",
      late: "দেরি",
      other: "অন্যান্য",
    } as Record<string, string>
  )[type] ?? type;
}

export function resolutionLabelBn(res: string): string {
  return (
    {
      refund: "টাকা ফেরত",
      replacement: "পণ্য বদল",
      inform: "শুধু জানানো",
    } as Record<string, string>
  )[res] ?? res;
}

export function complaintStatusLabelBn(status: string): {
  bn: string;
  tone: "amber" | "leaf" | "red" | "neutral";
} {
  return (
    {
      open: { bn: "নতুন", tone: "amber" as const },
      in_review: { bn: "পর্যালোচনায়", tone: "neutral" as const },
      resolved: { bn: "সমাধান হয়েছে", tone: "leaf" as const },
      rejected: { bn: "গ্রহণ করা হয়নি", tone: "red" as const },
    } as Record<string, { bn: string; tone: "amber" | "leaf" | "red" | "neutral" }>
  )[status] ?? { bn: status, tone: "neutral" };
}

/* ------------------------------------------------------ supplier quality */

export async function getSupplierQuality(sellerId: string): Promise<SupplierQuality | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await db()
      .from("v_supplier_quality")
      .select("*")
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (error || !data) return null;
    return data as SupplierQuality;
  } catch {
    return null;
  }
}

export async function listSupplierQuality(): Promise<SupplierQuality[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await db()
      .from("v_supplier_quality")
      .select("*")
      .order("quality_score", { ascending: true });

    if (error) return [];
    return (data ?? []) as SupplierQuality[];
  } catch {
    return [];
  }
}
