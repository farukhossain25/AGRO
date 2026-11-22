import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

/* ==========================================================================
   Admin panel shell — /foisal
   --------------------------------------------------------------------------
   The real gate is here, on the server: role = 'admin' read from
   `profiles.role` for the CURRENT Supabase session. middleware.ts applies the
   same rule before this layout runs, so a customer never even reaches the
   render. There is no admin link anywhere in the public UI.
   ========================================================================== */

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect("/login?next=/foisal");
  if (user.role !== "admin") {
    // Same 404 a customer sees for any other unknown URL.
    redirect("/forbidden");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
