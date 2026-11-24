import { db, isDbConfigured } from "@/lib/db";
import { SellerReviewManager, type SellerRow } from "@/components/admin/seller-review-manager";

export const dynamic = "force-dynamic";

/* ==========================================================================
   /foisal/sellers — review seller applications
   --------------------------------------------------------------------------
   The rows are passed through untouched: an earlier version decorated each
   row with a display-only `contact` key, and the generic PATCH then sent that
   key to Supabase, so every approval failed with "column contact does not
   exist". Anything computed for display now lives inside the component.
   ========================================================================== */

export default async function AdminSellersPage() {
  let rows: SellerRow[] = [];
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("sellers")
        .select("*")
        .order("created_at", { ascending: false });
      rows = (data ?? []) as unknown as SellerRow[];
    } catch {
      dbReady = false;
    }
  }

  return <SellerReviewManager rows={rows} dbReady={dbReady} />;
}
