import type { Metadata } from "next";
import { db, isDbConfigured } from "@/lib/db";
import { requirePermission } from "@/lib/api";
import {
  buildSellerSales,
  type SellerSalesPayout,
  type SellerSalesProductRow,
  type SellerSalesRow,
  type SellerSalesSeller,
  type SellerSalesSub,
} from "@/lib/seller-sales";
import { SellerSalesManager } from "@/components/admin/seller-sales-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "সেলার বিক্রয় ও পেমেন্ট — AGRO অ্যাডমিন" };

/* ==========================================================================
   /foisal/seller-sales — per-seller sales, pending orders and what admin owes
   --------------------------------------------------------------------------
   Read-only aggregation over existing tables (sub_orders carries the seller's
   money because the commission is taken per sub_order). See lib/seller-sales.ts
   for exactly how each figure is computed. Nothing is written back.
   ========================================================================== */

export default async function AdminSellerSalesPage() {
  let rows: SellerSalesRow[] = [];
  let dbReady = isDbConfigured();

  if (isDbConfigured()) {
    try {
      await requirePermission("payouts.read");
      const client = db();
      const [{ data: sellers }, { data: subs }, { data: payouts }, { data: products }] = await Promise.all([
        client
          .from("sellers")
          .select("id, slug, name_bn, phone, status, commission_percent, payout_method, payout_number, created_at")
          .order("created_at", { ascending: false }),
        client
          .from("sub_orders")
          .select("seller_id, sub_no, status, subtotal, commission, seller_earning, created_at"),
        client
          .from("seller_payouts")
          .select("seller_id, amount, status")
          .eq("status", "paid"),
        client
          .from("products")
          .select("id, seller_id, name_bn, approval_status, is_active, stock, price")
          .not("seller_id", "is", null),
      ]);

      rows = buildSellerSales(
        (sellers ?? []) as unknown as SellerSalesSeller[],
        (subs ?? []) as unknown as SellerSalesSub[],
        (payouts ?? []) as unknown as SellerSalesPayout[],
        (products ?? []) as unknown as SellerSalesProductRow[]
      );
    } catch {
      dbReady = false;
    }
  }

  return <SellerSalesManager rows={rows} dbReady={dbReady} />;
}
