import { db, isDbConfigured } from "@/lib/db";
import { SubscriberTable } from "@/components/admin/subscriber-table";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  let rows: Subscription[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db().from("subscriptions").select("*").order("created_at", { ascending: false });
      rows = (data ?? []) as unknown as Subscription[];
    } catch {
      rows = [];
    }
  }

  return <SubscriberTable initial={rows} dbReady={isDbConfigured()} />;
}
