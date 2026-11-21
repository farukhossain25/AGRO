import { listSupplierQuality } from "@/lib/reviews";
import {
  SupplierQualityBoard,
  type QualityRow,
} from "@/components/admin/supplier-quality-board";

export const dynamic = "force-dynamic";

export const metadata = { title: "সেলার কোয়ালিটি স্কোর" };

/* ==========================================================================
   /admin/suppliers/quality
   --------------------------------------------------------------------------
   One row per seller from v_supplier_quality: average rating, complaint rate,
   on-time rate and the composite quality score. Admins can warn, suspend or
   reinstate — every action is written to seller_warnings + audit_logs.
   ========================================================================== */

const THRESHOLDS = { warnBelow: 60, suspendBelow: 40, minReviews: 3 };

export default async function SupplierQualityPage() {
  const rows = await listSupplierQuality();

  const mapped: QualityRow[] = rows.map((row) => ({
    sellerId: row.seller_id,
    slug: row.slug,
    nameBn: row.name_bn,
    status: row.status,
    reviewCount: Number(row.review_count ?? 0),
    avgRating: Number(row.avg_rating ?? 0),
    avgSellerRating: Number(row.avg_seller_rating ?? 0),
    complaintCount: Number(row.complaint_count ?? 0),
    complaintRate: Number(row.complaint_rate ?? 0),
    onTimeRate: Number(row.on_time_rate ?? 0),
    qualityScore: Number(row.quality_score ?? 0),
    lowRatingCount: Number(row.low_rating_count ?? 0),
  }));

  return <SupplierQualityBoard initial={mapped} thresholds={THRESHOLDS} />;
}
