import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { authErrorBn } from "@/lib/auth-attempts";
import { isSupabaseAuthConfigured, supabaseAnonServer, supabaseService } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1, "বর্তমান পাসওয়ার্ড দিন").max(200),
  newPassword: z
    .string()
    .min(8, "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে")
    .max(72, "পাসওয়ার্ড অনেক বড়"),
});

/**
 * POST /api/auth/password — change the signed-in user's password.
 *
 * Supabase Auth users: re-authenticate with the current password (Supabase
 * requires a fresh login for user.updateUser), then update.
 * Legacy bcrypt users: verify the hash and rotate it in place.
 * Either way the users.password_hash mirror is refreshed so both paths agree.
 */
export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "password-change"), 6, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);

    const { currentPassword, newPassword } = schema.parse(await req.json());
    if (currentPassword === newPassword) {
      return fail("নতুন পাসওয়ার্ড আগেরটির মতো হতে পারবে না", 422, {
        newPassword: "একটি ভিন্ন পাসওয়ার্ড দিন",
      });
    }

    const email = session.email?.toLowerCase() ?? null;
    const profile = await getProfileByLegacyId(session.id);

    let updatedVia: "supabase" | "legacy" | null = null;

    // ---- path 1: Supabase Auth
    if (email && isSupabaseAuthConfigured() && profile) {
      try {
        const client = supabaseAnonServer();

        // verify the current password by attempting a sign-in
        const { error: verifyError } = await client.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

        if (!verifyError) {
          const { error: updateError } = await client.auth.updateUser({ password: newPassword });
          if (!updateError) updatedVia = "supabase";
          else return fail(authErrorBn(updateError.message), 400);
        }
      } catch {
        /* fall through to the legacy path */
      }
    }

    // ---- path 2: bcrypt hash in the users table
    if (!updatedVia && isDbConfigured()) {
      const { data: user } = await db()
        .from("users")
        .select("id, password_hash")
        .eq("id", session.id)
        .maybeSingle();

      if (user?.password_hash) {
        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) return fail("বর্তমান পাসওয়ার্ড সঠিক নয়", 401, {
          currentPassword: "বর্তমান পাসওয়ার্ড মিলছে না",
        });

        const hash = await bcrypt.hash(newPassword, 12);
        await db().from("users").update({ password_hash: hash }).eq("id", session.id);
        updatedVia = "legacy";
      }
    }

    if (!updatedVia) {
      return fail("বর্তমান পাসওয়ার্ড যাচাই করা যায়নি — আবার লগইন করে চেষ্টা করুন", 401);
    }

    // ---- keep the legacy mirror in sync for Supabase users
    if (updatedVia === "supabase" && isDbConfigured() && profile) {
      try {
        const hash = await bcrypt.hash(newPassword, 12);
        await db().from("users").update({ password_hash: hash }).eq("id", session.id);
      } catch {
        /* mirror is best-effort */
      }
    }

    if (isDbConfigured()) {
      await db()
        .from("audit_logs")
        .insert({
          actor_id: session.id,
          action: "password.changed",
          entity: "users",
          entity_id: session.id,
          meta: { via: updatedVia },
        })
        .then(
          () => undefined,
          () => undefined
        );
    }

    return ok({ updated: true, via: updatedVia });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/auth/password — set a password for an account that only has
 * Google sign-in. Requires an existing session (so the user is already
 * authenticated); the service role performs the update.
 */
export async function PATCH(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "password-set"), 4, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);

    const body = (await req.json().catch(() => ({}))) as { password?: string };
    const password = body.password ?? "";
    if (password.length < 8) {
      return fail("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে", 422, {
        password: "কমপক্ষে ৮ অক্ষর দিন",
      });
    }

    const profile = await getProfileByLegacyId(session.id);
    if (!profile) return fail("প্রোফাইল পাওয়া যায়নি — আবার লগইন করুন", 404);

    const { error } = await supabaseService().auth.admin.updateUserById(profile.id, { password });
    if (error) return fail(authErrorBn(error.message), 400);

    // mirror into the legacy column so both login paths accept it
    if (isDbConfigured()) {
      try {
        await db()
          .from("users")
          .update({ password_hash: await bcrypt.hash(password, 12) })
          .eq("id", session.id);
      } catch {
        /* best-effort */
      }
    }

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
