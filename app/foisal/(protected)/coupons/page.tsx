import { db, isDbConfigured } from "@/lib/db";
import { CouponManager } from "@/components/admin/coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  let rows: Record<string, unknown>[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("coupons").select("*").order("created_at", { ascending: false });
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return <CouponManager initial={rows} />;
}
