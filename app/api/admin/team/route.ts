import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/auth-attempts";
import { recordAudit } from "@/lib/audit";
import { isSupabaseAuthConfigured, supabaseService } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/admin/team — section F
   --------------------------------------------------------------------------
   GET   list staff/manager/admin accounts (team.read)
   POST  invite a new teammate (team.invite, admin only)

   Two hard rules that make this safe to expose:

     1. Nobody may grant a role above their own. `canActOn()` compares the
        permission sets positionally, so a manager cannot mint an admin.
     2. Nobody may change their own role or deactivate themselves — otherwise
        the last admin can lock everyone (including themselves) out.
   ========================================================================== */

const RANK: Record<string, number> = { staff: 1, manager: 2, admin: 3 };

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
  role: z.enum(["staff", "manager", "admin"]).optional(),
  is_active: z.boolean().optional(),
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

    if (!isSupabaseAuthConfigured()) {
      return fail("Supabase Auth কনফিগার করা নেই — টিম মেম্বার যোগ করা যাবে না", 503);
    }

    let admin;
    try {
      admin = supabaseService();
    } catch {
      return fail("সার্ভিস রোল কী নেই", 503);
    }

    // Invite sends Supabase's magic link (needs SMTP configured in the project);
    // the profile row is what the admin login reads, so create it immediately.
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/login`,
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

    // Mirror into public.users so order/audit foreign keys resolve.
    const { error: mirrorError } = await admin.from("users").upsert(
      {
        id: authId,
        name: body.full_name,
        email: body.email,
        phone: body.phone || null,
        role: body.role,
        is_active: true,
      },
      { onConflict: "id" }
    );
    if (mirrorError) console.warn("[team] users mirror skipped:", mirrorError.message);

    await recordAudit({
      actor,
      action: "invite",
      entity: "users",
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
      .from("users")
      .select("id, email, role, is_active")
      .eq("id", body.userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!target) return fail("টিম মেম্বার পাওয়া যায়নি", 404);

    if (!canActOn(actor.role, String(target.role))) {
      return fail("এই অ্যাকাউন্টের উপর আপনার অনুমতি নেই", 403);
    }
    if (body.role && !canActOn(actor.role, body.role)) {
      return fail("নিজের চেয়ে বড় রোল দেওয়া যাবে না", 403);
    }

    const patch: Record<string, unknown> = {};
    if (body.role) patch.role = body.role;
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
    if (!Object.keys(patch).length) return fail("পরিবর্তনের কিছু নেই", 400);

    const { error } = await db().from("users").update(patch).eq("id", body.userId);
    if (error) throw error;

    // keep the sign-in identity in step — a suspended manager must not keep
    // an admin-capable profile
    let admin = null;
    try {
      admin = supabaseService();
    } catch {
      /* service key missing: the users row above is still updated */
    }
    if (admin) {
      const profilePatch: Record<string, unknown> = {};
      if (body.role) profilePatch.role = body.role;
      if (Object.keys(profilePatch).length) {
        await admin.from("profiles").update(profilePatch).eq("legacy_user_id", body.userId);
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
      action: body.role ? "role" : "suspend",
      entity: "users",
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
