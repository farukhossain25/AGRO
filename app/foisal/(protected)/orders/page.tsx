import { db, isDbConfigured } from "@/lib/db";
import { OrderManager } from "@/components/admin/order-manager";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let orders: (Order & { order_items: [] })[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      orders = (data ?? []) as (Order & { order_items: [] })[];
    } catch {
      orders = [];
    }
  }

  return <OrderManager initial={orders} dbReady={isDbConfigured()} />;
}
