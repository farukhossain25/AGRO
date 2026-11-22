import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, sessionCookie } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { isStaffRole } from "@/lib/permissions";

/* Staff, managers and admins share this shell (section F). Hiding the controls
   is not the security boundary — every API route re-checks the permission —
   but it keeps a staff account from wandering into money screens by URL. */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(sessionCookie.adminName)?.value ?? store.get(sessionCookie.name)?.value;
  const user = await verifySession(token);

  if (!user || !isStaffRole(user.role)) {
    redirect("/admin/login");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
