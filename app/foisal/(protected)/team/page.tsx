import { db, dbUsable } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { TeamManager, type TeamRow } from "@/components/admin/team-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "টিম ও রোল", robots: { index: false, follow: false } };

export default async function AdminTeamPage() {
  const user = await getSessionUser();

  let rows: TeamRow[] = [];
  if (dbUsable()) {
    try {
      const { data } = await db()
        .from("v_team_members")
        .select("*")
        .order("created_at", { ascending: false });
      rows = (data ?? []) as TeamRow[];
    } catch {
      rows = [];
    }
  }

  return (
    <TeamManager
      initial={rows}
      selfId={user?.id ?? ""}
      canInvite={can(user, "team.invite")}
      canChangeRole={can(user, "team.role")}
      dbReady={dbUsable()}
    />
  );
}
