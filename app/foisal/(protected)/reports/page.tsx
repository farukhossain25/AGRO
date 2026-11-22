import { db, isDbConfigured } from "@/lib/db";
import { ReportsView } from "@/components/admin/reports-view";

export const dynamic = "force-dynamic";

type Row = { id: string; total: number; status: string; created_at: string };

async function loadOrders(days: number): Promise<Row[]> {
  if (!isDbConfigured()) return [];
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await db()
      .from("orders")
      .select("id, total, status, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });
    return (data ?? []) as Row[];
  } catch {
    return [];
  }
}

export default async function ReportsPage() {
  const orders = await loadOrders(90);
  return <ReportsView orders={orders} dbReady={isDbConfigured()} />;
}
