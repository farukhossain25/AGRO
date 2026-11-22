import { db, isDbConfigured } from "@/lib/db";
import { getApprovedReviews } from "@/lib/data";
import { ReviewModeration } from "@/components/admin/review-moderation";
import {
  VerifiedReviewModeration,
  type ModReviewRow,
} from "@/components/admin/verified-review-moderation";

export const dynamic = "force-dynamic";

/* ==========================================================================
   the panel’s review moderation
   --------------------------------------------------------------------------
   Two separate systems live on this page and must stay separate:

     ১. ভেরিফাইড রিভিউ — order_reviews (0005). Purchase-verified, per seller and
        per product, hide/restore only, feeds the quality score.
     ২. পুরোনো মতামত — the legacy `reviews` testimonials table, which has a
        manual approve toggle and is still shown on the homepage/product page.
   ========================================================================== */

async function loadVerified(): Promise<ModReviewRow[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await db()
      .from("order_reviews")
      .select(
        "id, user_id, rating, seller_rating, comment, photos, tags, status, seller_reply, created_at, products(name_bn, slug), sellers(name_bn, slug)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data?.length) return [];

    // reviewer names live in profiles, keyed by the auth user id
    const ids = Array.from(new Set(data.map((r) => r.user_id as string)));
    const { data: profiles } = await db()
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);

    const names = new Map(
      (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
    );

    return (data as unknown as (ModReviewRow & { user_id: string })[]).map((row) => ({
      id: row.id,
      rating: row.rating,
      seller_rating: row.seller_rating,
      comment: row.comment,
      photos: row.photos,
      tags: row.tags,
      status: row.status,
      seller_reply: row.seller_reply,
      created_at: row.created_at,
      products: row.products,
      sellers: row.sellers,
      reviewer: { full_name: names.get(row.user_id) ?? null },
    }));
  } catch {
    return [];
  }
}

export default async function AdminReviewsPage() {
  let rows: Record<string, unknown>[] = (await getApprovedReviews(undefined, 50)) as unknown as Record<
    string,
    unknown
  >[];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("reviews")
        .select("*, products(name_bn)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data?.length) rows = data;
    } catch {
      /* fall back to the seed reviews */
    }
  }

  const verified = await loadVerified();

  return (
    <div className="space-y-8">
      <VerifiedReviewModeration initial={verified} />

      <section className="border-t border-white/10 pt-6">
        <h2 className="text-[16px] font-bold text-sand-50">পুরোনো সাইটের মতামত</h2>
        <p className="mb-3 mt-0.5 text-[11.5px] text-sand-100/45">
          এগুলো ভেরিফাইড রিভিউ নয় — হোমপেজ ও পণ্য পাতায় দেখানোর জন্য ম্যানুয়ালি অনুমোদন করুন।
        </p>
        <ReviewModeration initial={rows} dbReady={isDbConfigured()} />
      </section>
    </div>
  );
}
