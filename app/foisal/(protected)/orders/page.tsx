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
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(200);
      // The table stores customer_phone/customer_email; the app's Order shape
      // uses phone/email (the orders API does the same mapping).
      orders = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        ...row,
        phone: row.customer_phone,
        email: row.customer_email,
      })) as unknown as (Order & { order_items: [] })[];
    } catch {
      orders = [];
    }
  }

  return <OrderManager initial={orders} dbReady={isDbConfigured()} />;
}
