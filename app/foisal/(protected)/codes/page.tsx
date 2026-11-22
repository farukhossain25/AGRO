import { db, isDbConfigured } from "@/lib/db";
import { CodeManager, type AccessCodeRow } from "@/components/admin/code-manager";
import { listPlans } from "@/lib/premium";

export const dynamic = "force-dynamic";

export default async function AdminCodesPage() {
  let rows: AccessCodeRow[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("premium_access_codes")
        .select("*")
        .order("issued_at", { ascending: false })
        .limit(300);
      rows = (data ?? []) as AccessCodeRow[];
    } catch {
      /* offline */
    }
  }

  const plans = await listPlans(false).catch(() => []);

  const unused = rows.filter((r) => r.status === "unused").length;
  const used = rows.filter((r) => r.status === "used").length;

  return (
    <CodeManager
      initial={rows}
      plans={plans.map((p) => ({ id: p.id, label: `${p.name_bn} (${p.duration_days} দিন)` }))}
      dbReady={isDbConfigured()}
      counts={{ unused, used }}
    />
  );
}
