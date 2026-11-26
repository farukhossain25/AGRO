import { z } from "zod";
import { db } from "@/lib/db";
import { ADMIN_LOGIN_PATH } from "@/lib/paths";
import { site } from "@/lib/site";
import { created, fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/team — section F
   --------------------------------------------------------------------------
   GET   list staff/manager/admin accounts (team.read)
   POST  invite a new teammate (team.invite, admin only)

   Two hard rules that make this safe to expose:

     1. Nobody may grant a role above their own. `canActOn()` compares the
        permission sets positionally, so a manager cannot mint an admin.
     2. Nobody may change their own role or deactivate themselves — otherwise
        the last admin can lock everyone (including themselves) out.
   ========================================================================== */

/* Rank map for "may I act on this account".
   `customer` MUST be here with a rank of 0 — it is the row a promotion starts
   from. It used to be missing, so `RANK["customer"] ?? 99` made every ordinary
   customer rank ABOVE the admin, and the guard refused the single action this
   screen exists for ("this account has no permission") while a staff→manager
   change — a row that already had a rank — went through. */
const RANK: Record<string, number> = { customer: 0, premium: 0, seller: 0, staff: 1, manager: 2, admin: 3 };

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
  full_name: z.string().trim().min(2, "নাম লিখুন").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^01[3-9]\d{8}$/, "১১ ডিজিটের মোবাইল নম্বর দিন")
    .optional()
    .or(z.literal("")),
  role: z.enum(["staff", "manager", "admin"]),
});

const roleSchema = z.object({
  userId: z.string().uuid(),
  /* "customer" is accepted on purpose: it is the only way to take the panel
     away from someone again. Without it a mis-promoted account stays staff
     forever (the alternative — deleting the account — loses their orders). */
  role: z.enum(["customer", "staff", "manager", "admin"]).optional(),
  is_active: z.boolean().optional(),
  /* The name the CUSTOMER sees when this person picks up a live chat. A staff
     account with no full_name used to appear as its email handle
     ("foysaliqbal09"), which read as a person's name. Setting it here is how
     the owner fixes that for an existing account — no email, no re-signup. */
  full_name: z.string().trim().min(2, "নাম অন্তত ২ অক্ষর").max(80, "নাম ৮০ অক্ষরের মধ্যে").optional(),
});

function canActOn(actorRole: string, targetRole: string): boolean {
  const a = RANK[actorRole] ?? 0;
  const t = RANK[targetRole] ?? 99;
  return a > 0 && a >= t;
}

export async function GET() {
  try {
    await requirePermission("team.read");
    const { data, error } = await db()
      .from("v_team_members")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("team.invite");
    const body = inviteSchema.parse(await req.json());

    if (!canActOn(actor.role, body.role)) {
      return fail("নিজের চেয়ে বড় রোল দেওয়া যাবে না", 403);
    }

    if (!isSupabaseAdminConfigured) {
      return fail("Supabase Auth কনফিগার করা নেই — টিম মেম্বার যোগ করা যাবে না", 503);
    }

    let admin;
    try {
      admin = supabaseAdmin();
    } catch {
      return fail("সার্ভিস রোল কী নেই", 503);
    }

    // Invite sends Supabase's magic link (needs SMTP configured in the project);
    // the profile row is what the admin login reads, so create it immediately.
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
      redirectTo: `${site.url}${ADMIN_LOGIN_PATH}`,
    });

    if (inviteError) {
      const duplicate = /already|exists|registered/i.test(inviteError.message);
      return fail(
        duplicate
          ? "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে — রোল পরিবর্তন করুন"
          : `ইনভাইট পাঠানো যায়নি: ${inviteError.message}`,
        409
      );
    }

    const authId = invited?.user?.id;
    if (!authId) return fail("ইনভাইট তৈরি হয়েছে কিন্তু ইউজার আইডি পাওয়া যায়নি", 500);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: authId,
          full_name: body.full_name,
          phone: body.phone || null,
          role: body.role,
          language: "bn",
        },
        { onConflict: "id" }
      )
      .select("id, full_name, role")
      .single();

    if (profileError) throw profileError;

    await recordAudit({
      actor,
      action: "invite",
      entity: "profiles",
      entityId: authId,
      diff: { email: body.email, role: body.role, full_name: body.full_name },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return created(profile);
  } catch (error) {
    return handleError(error);
  }
}

/** PATCH — change a role or suspend/reactivate an account. */
export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("team.role");
    const body = roleSchema.parse(await req.json());

    if (body.userId === actor.id) {
      return fail("নিজের রোল বা স্টেটাস নিজে বদলানো যাবে না", 403);
    }

    const { data: target, error: readError } = await db()
      .from("profiles")
      .select("id, email, role, is_active")
      .eq("id", body.userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!target) return fail("টিম মেম্বার পাওয়া যায়নি", 404);

    /* `db()` is the service client, and a missing role on an EXISTING account
       means a plain customer — the very row we are trying to promote. Defaulting
       to "customer" (rank 0) is what lets the guard below answer yes instead of
       refusing the one action this screen exists for. */
    const targetRole = String(target.role ?? "customer");

    if (!canActOn(actor.role, targetRole)) {
      return fail("এই অ্যাকাউন্টের উপর আপনার অনুমতি নেই", 403);
    }
    if (body.role && !canActOn(actor.role, body.role)) {
      return fail("নিজের চেয়ে বড় রোল দেওয়া যাবে না", 403);
    }

    const patch: {
      role?: "customer" | "staff" | "manager" | "admin";
      is_active?: boolean;
      full_name?: string;
    } = {};
    if (body.role) patch.role = body.role;
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
    if (body.full_name) patch.full_name = body.full_name;
    if (!Object.keys(patch).length) return fail("পরিবর্তনের কিছু নেই", 400);

    /* Renaming somebody is a team action, not a promotion; the rank guard above
       already made sure the actor outranks the target. Keep the audit entry
       honest about which of the three things changed. */
    const action = body.full_name && !body.role && typeof body.is_active !== "boolean" ? "rename" : body.role ? "role" : "suspend";

    const { error } = await db().from("profiles").update(patch).eq("id", body.userId);
    if (error) throw error;

    // keep the sign-in identity in step — a suspended manager must not keep
    // an admin-capable profile
    let admin = null;
    try {
      admin = supabaseAdmin();
    } catch {
      /* service key missing: the users row above is still updated */
    }
    if (admin) {
      // app_metadata keeps the JWT claim in step with the profile row.
      if (body.role) {
        await admin.auth.admin.updateUserById(body.userId, {
          app_metadata: { role: body.role },
        });
      }
      if (body.is_active === false) {
        try {
          await admin.auth.admin.updateUserById(body.userId, { ban_duration: "876000h" });
        } catch {
          /* non-fatal: the users.is_active flag still blocks the app */
        }
      }
    }

    await recordAudit({
      actor,
      action,
      entity: "profiles",
      entityId: body.userId,
      diff: { from: { role: target.role, is_active: target.is_active }, to: patch },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok(patch);
  } catch (error) {
    return handleError(error);
  }
}
