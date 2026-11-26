import { db, isDbConfigured } from "@/lib/db";
import { currentUser, fail, handleError, ok } from "@/lib/api";
import { can as hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/team/lookup — find an EXISTING account to promote
   --------------------------------------------------------------------------
   The team screen used to have one door: invite by email. That meant every new
   staff member needed a working inbox and a magic link, and the owner — who
   already has every customer in the panel — could not simply say "এই লোকটাকে
   স্টাফ বানাও". This route is the finder behind that: type a name, phone or
   email, get the account, set the role.

   Authorisation is the interesting part:
     • you need team.invite (the same right it takes to create a teammate)
     • every result is filtered to accounts you could actually be allowed to
       act on — a manager searching cannot see or promote an admin
     • the caller themselves is never returned (self-promotion is refused in
       PATCH anyway; not returning the row makes it obvious in the UI)

   It never returns password hashes, tokens or anything outside the four
   display columns. The service-role client bypasses RLS, so this whitelist IS
   the boundary.
   ========================================================================== */

const RANK: Record<string, number> = { customer: 0, premium: 0, seller: 0, staff: 1, manager: 2, admin: 3 };

/** Roles a given actor may promote an account TO — mirrors canActOn() in ../route.ts. */
function rolesActorCanGrant(actorRole: string): string[] {
  const rank = RANK[actorRole] ?? 0;
  if (rank >= 3) return ["staff", "manager", "admin"];
  if (rank >= 2) return ["staff", "manager"];
  if (rank >= 1) return ["staff"];
  return [];
}

export type LookupRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
  /** true when the actor may change THIS row's role (mirrors canActOn). */
  can_manage: boolean;
};

export async function GET(req: Request) {
  try {
    const actor = await currentUser();
    if (!actor) return fail("আগে লগইন করুন", 401);
    if (!hasPermission(actor, "team.invite")) return fail("এই কাজের অনুমতি আপনার নেই", 403);

    if (!isDbConfigured()) return ok({ rows: [], q: "", grantable: rolesActorCanGrant(actor.role) });

    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    /* One character returns everything, which is how an owner ends up staring
       at the whole customer table. Two is the shortest useful search. */
    if (q.length < 2) return ok({ rows: [], q });

    /* PostgREST's `or()` filter needs the term escaped: a comma or a closing
       paren inside a customer's name would otherwise rewrite the filter. */
    const safe = q.replace(/[(),%*]/g, " ").trim();
    if (!safe) return ok({ rows: [], q, grantable: rolesActorCanGrant(actor.role) });

    const { data, error } = await db()
      .from("profiles")
      .select("id, full_name, email, phone, role, is_active, created_at")
      .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
      .neq("id", actor.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const actorRank = RANK[actor.role] ?? 0;
    const grantable = new Set(rolesActorCanGrant(actor.role));

    const rows: LookupRow[] = (data ?? []).map((row) => {
      const targetRole = String(row.role ?? "customer");
      const targetRank = RANK[targetRole] ?? 99;
      return {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: targetRole,
        is_active: row.is_active,
        created_at: row.created_at,
        /* Mirrors canActOn(actor, target): you cannot touch an equal or higher
           rank, so a manager cannot demote an admin by searching them up. */
        can_manage: actorRank > 0 && actorRank >= targetRank && grantable.size > 0,
      };
    });

    return ok({ rows, q, grantable: [...grantable] });
  } catch (error) {
    return handleError(error);
  }
}
