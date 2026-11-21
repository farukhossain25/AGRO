import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, sessionCookie } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(sessionCookie.adminName)?.value ?? store.get(sessionCookie.name)?.value;
  const user = await verifySession(token);

  if (!user || user.role !== "admin") {
    redirect("/admin/login");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
