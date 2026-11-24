import { db, isDbConfigured } from "@/lib/db";
import { ReviewManager, type AdminReviewRow } from "@/components/admin/review-manager";
import { FALLBACK_TAGS } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/* ==========================================================================
   the panel's review page
   --------------------------------------------------------------------------
   One list, one table: product reviews written from a delivered order and the
   site-wide testimonial form both live in `reviews`, and both publish
   themselves on submit. Nothing here waits for approval — the owner only
   hides (reversible) or deletes (audited) what should not stay public.
   ========================================================================== */

async function loadReviews(): Promise<AdminReviewRow[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await db()
      .from("reviews")
      .select(
        "id, user_id, rating, seller_rating, title_bn, comment, author_name, photos, tags, is_verified_purchase, status, seller_reply, created_at, products(name_bn, slug), sellers(name_bn, slug)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data?.length) return [];

    // Registered reviewers show their profile name; guests show the name they typed.
    const ids = Array.from(new Set(data.map((r) => r.user_id).filter((id): id is string => Boolean(id))));
    const { data: profiles } = ids.length
      ? await db().from("profiles").select("id, full_name").in("id", ids)
      : { data: null };

    const names = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));

    return (data as unknown as (AdminReviewRow & { user_id: string | null })[]).map((row) => ({
      id: row.id,
      rating: Number(row.rating),
      seller_rating: row.seller_rating === null ? null : Number(row.seller_rating),
      title_bn: row.title_bn,
      comment: row.comment,
      author_name: row.author_name,
      photos: row.photos ?? [],
      tags: row.tags ?? [],
      is_verified_purchase: row.is_verified_purchase,
      status: row.status,
      seller_reply: row.seller_reply,
      created_at: row.created_at,
      products: row.products,
      sellers: row.sellers,
      reviewer: row.user_id ? { full_name: names.get(row.user_id) ?? null } : null,
    }));
  } catch {
    return [];
  }
}

const FALLBACK_TAG_LABELS: Record<string, string> = Object.fromEntries(
  FALLBACK_TAGS.map((t) => [t.slug, t.label_bn])
);

async function loadTagLabels(): Promise<Record<string, string>> {
  if (!isDbConfigured()) return FALLBACK_TAG_LABELS;
  try {
    const { data } = await db().from("review_tags").select("slug, label_bn");
    if (!data?.length) return FALLBACK_TAG_LABELS;
    return Object.fromEntries(data.map((t) => [t.slug as string, t.label_bn as string]));
  } catch {
    return FALLBACK_TAG_LABELS;
  }
}

export default async function AdminReviewsPage() {
  const [reviews, tagLabels] = await Promise.all([loadReviews(), loadTagLabels()]);

  return (
    <div className="space-y-6">
      <ReviewManager initial={reviews} tagLabels={tagLabels} />

      {!isDbConfigured() ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — রিভিউ দেখানো যাচ্ছে না।
        </p>
      ) : null}
    </div>
  );
}
