import { getSessionUser } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { getRoleAccessSummary, ROLE_LABEL_BN } from "@/lib/role-access";
import { AccessEditor } from "@/components/admin/access-editor";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "প্যানেল অ্যাক্সেস", robots: { index: false, follow: false } };

/* ==========================================================================
   /foisal/access — কে কোন অংশে ঢুকতে পারবে
   --------------------------------------------------------------------------
   The owner's request: "কোন রোল কী কী অ্যাক্সেস করতে পারবে সেসব অ্যাডমিন প্যানেল
   থেকে অ্যাডমিন সেট করে দেবে."

   Reading the permission grid needs `team.read` (manager and up). The save
   button needs `team.role` (admin only) — the card is still shown to a manager
   so they can see their own remit, with the controls disabled and a line
   explaining why. The route re-checks both, so the disabled button is a
   courtesy, not the control.
   ========================================================================== */

type CatalogRow = {
  permission: string;
  group_key: string;
  group_bn: string;
  label_bn: string;
  hint_bn: string | null;
  is_sensitive: boolean;
  sort_order: number;
};

export default async function AdminAccessPage() {
  const user = await getSessionUser();

  /* The catalogue is a static reference table (migration 30 §1). One read. */
  let catalog: CatalogRow[] = [];
  try {
    const { data } = await db()
      .from("permission_catalog")
      .select("permission, group_key, group_bn, label_bn, hint_bn, is_sensitive, sort_order")
      .order("group_key")
      .order("sort_order");
    catalog = (data ?? []) as CatalogRow[];
  } catch {
    catalog = [];
  }

  /* Effective state, from the same module every guard uses — so this page can
     never show a different answer than the middleware enforces. */
  const summary = await getRoleAccessSummary();

  const overrides: Record<string, Record<string, boolean>> = {};
  for (const row of summary) {
    overrides[row.role] = Object.fromEntries(
      Object.entries(row.overrides).filter(([, granted]) => typeof granted === "boolean")
    ) as Record<string, boolean>;
  }

  /* The defaults as data, for the client to diff against. */
  const { rolePermissionDefaults } = await import("@/lib/permissions");
  const defaults = rolePermissionDefaults();

  return (
    <AccessEditor
      catalog={catalog}
      defaults={defaults as unknown as Record<string, string[]>}
      initialOverrides={overrides}
      roles={summary.map((row) => ({ role: row.role, labelBn: ROLE_LABEL_BN[row.role] }))}
      canEdit={can(user, "team.role")}
    />
  );
}
