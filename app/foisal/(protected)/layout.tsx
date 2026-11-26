import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { isStaffRole } from "@/lib/permissions";
import { ADMIN_BASE, isStaffPanelPath } from "@/lib/paths";

/* ==========================================================================
   Admin panel shell — /foisal
   --------------------------------------------------------------------------
   The real gate is here, on the server: role is read from `profiles.role` for
   the CURRENT Supabase session. middleware.ts applies the same rule before this
   layout runs, so a customer never even reaches the render.

   Two tiers, by design:
     • admin       → the whole panel
     • staff/manager → ONLY the live-chat desk (STAFF_PANEL_SUBPATHS). The
       owner's live-chat rule needs every staffer to see an incoming chat, which
       is impossible if a staff account cannot open the panel at all. Every
       other panel URL still 404s for them, both here and in middleware.
   ========================================================================== */

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect(`${ADMIN_BASE}/login?next=${ADMIN_BASE}`);

  if (user.role !== "admin") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!(isStaffRole(user.role) && isStaffPanelPath(pathname))) redirect("/forbidden");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
