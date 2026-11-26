import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { can, isStaffRole, type Permission as Perm } from "@/lib/permissions";
import { ADMIN_BASE, canOpenPanelPath } from "@/lib/paths";
import { getRoleOverrides } from "@/lib/role-access";

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

  /* The admin's configuration (migration 30) applies to staff and manager only.
     An admin never needs it, so an admin request does not pay for the query.
     Same cached read as middleware, so the two guards cannot disagree about
     which door opens. */
  const overrides = user.role === "admin" ? null : await getRoleOverrides();

  if (user.role !== "admin") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const hold = (permission: Perm) => can(user, permission, overrides);
    /* middleware.ts has already redirected the panel root for a non-admin, so
       anything that reaches here is a real sub-page. This is the second copy of
       the same rule on purpose: middleware can be bypassed by a direct server
       render path, the API underneath re-checks again. */
    if (!(isStaffRole(user.role) && canOpenPanelPath(pathname, hold))) redirect("/forbidden");
  }

  /* The shell is a client component and filters the sidebar with `can()`. It
     needs the same overrides or it would hide a page the guards just allowed
     (or worse, show one that 404s). Only the diff crosses the boundary — the
     defaults stay in code. */
  return (
    <AdminShell user={user} overrides={overrides}>
      {children}
    </AdminShell>
  );
}
