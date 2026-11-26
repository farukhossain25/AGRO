import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { can, isStaffRole, type Permission as Perm } from "@/lib/permissions";
import { ADMIN_BASE, canOpenPanelPath } from "@/lib/paths";

/* ==========================================================================
   Admin panel shell — /foisal
   --------------------------------------------------------------------------
   The real gate is here, on the server: role is read from `profiles.role` for
   the CURRENT Supabase session. middleware.ts applies the same rule before this
   layout runs, so a customer never even reaches the render.

   Two tiers, by permission:
     • admin          → the whole panel
     • staff/manager  → the pages their own permissions cover
       (PANEL_PAGE_PERMISSIONS in lib/paths.ts). A staff account gets the
       catalogue, media and content it can already edit through the API; a
       manager additionally gets orders, customers, reports and payouts.
       Money, team and settings pages stay admin-only, and every page's own
       API re-checks the permission — this layout only decides which door opens.
   ========================================================================== */

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect(`${ADMIN_BASE}/login?next=${ADMIN_BASE}`);

  if (user.role !== "admin") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const hold = (permission: Perm) => can(user, permission);
    /* middleware.ts has already redirected the panel root for a non-admin, so
       anything that reaches here is a real sub-page. This is the second copy of
       the same rule on purpose: middleware can be bypassed by a direct server
       render path, the API underneath re-checks again. */
    if (!(isStaffRole(user.role) && canOpenPanelPath(pathname, hold))) redirect("/forbidden");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
