import { db, isDbConfigured } from "@/lib/db";
import { getApprovedReviews } from "@/lib/data";
import { ReviewModeration } from "@/components/admin/review-moderation";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  let rows: Record<string, unknown>[] = (await getApprovedReviews(undefined, 50)) as unknown as Record<string, unknown>[];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("reviews")
        .select("*, products(name_bn)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data?.length) rows = data;
    } catch {
      /* fall back */
    }
  }

  return <ReviewModeration initial={rows} dbReady={isDbConfigured()} />;
}
