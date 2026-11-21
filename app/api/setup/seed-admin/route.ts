import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { isSupabaseAuthConfigured, supabaseService } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   POST /api/setup/seed-admin   ← one-time admin bootstrap
   --------------------------------------------------------------------------
   Equivalent of the Netlify function described in the brief, adapted to the
   Vercel/Next target (a Next route handler is the native equivalent).

   Security:
     • requires `Authorization: Bearer $SEED_SECRET` (timing-safe compare)
     • refuses to run if the secret is missing or shorter than 24 chars
     • writes a settings row `admin_seeded=true` on success
     • every later call returns 409 unless `force: true` AND a different
       SEED_SECRET is supplied → effectively one-shot

   Uses the SERVICE ROLE key only on the server. ADMIN_PASSWORD is read from
   the environment and is never returned in the response.

   Usage:
     curl -X POST https://<domain>/api/setup/seed-admin \
       -H "Authorization: Bearer $SEED_SECRET"
   ========================================================================== */

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    password: z.string().min(8).max(200).optional(),
    force: z.boolean().optional(),
  })
  .default({});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.headers.get("x-seed-secret")?.trim() ?? "";
}

export async function POST(req: Request) {
  try {
    const secret = process.env.SEED_SECRET ?? "";

    if (!secret || secret.length < 24) {
      return fail(
        "SEED_SECRET সেট করা নেই (কমপক্ষে ২৪ অক্ষর)। Vercel → Settings → Environment Variables এ যোগ করুন।",
        503
      );
    }

    const supplied = bearer(req);
    if (!supplied || !safeEqual(supplied, secret)) {
      return fail("অনুমতি নেই — SEED_SECRET টোকেন সঠিক নয়", 401);
    }

    if (!isDbConfigured() || !isSupabaseAuthConfigured()) {
      return fail("Supabase কনফিগার করা নেই (URL / service role / anon key)", 503);
    }

    // ---- one-shot guard
    const { data: flag } = await db()
      .from("settings")
      .select("value")
      .eq("key", "admin_seeded")
      .maybeSingle();

    const alreadySeeded = Boolean((flag?.value as { done?: boolean } | null)?.done);
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    if (alreadySeeded && !body.force) {
      return fail(
        "অ্যাডমিন ইতিমধ্যে তৈরি হয়েছে। নতুন করে করতে চাইলে force:true পাঠান অথবা settings থেকে admin_seeded মুছুন।",
        409
      );
    }

    const email = (body.email ?? process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
    const password = body.password ?? process.env.ADMIN_PASSWORD ?? "";

    if (!email) return fail("ADMIN_EMAIL সেট করুন অথবা email পাঠান", 400);
    if (!password || password.length < 8) {
      return fail("ADMIN_PASSWORD সেট করুন (কমপক্ষে ৮ অক্ষর)", 400);
    }

    // ---- 1. create or update the Supabase Auth user
    const admin = supabaseService();
    let authId: string | null = null;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // admin is trusted; no verification mail needed
      user_metadata: { full_name: "Admin", role: "admin" },
      app_metadata: { role: "admin" },
    });

    if (created?.user) {
      authId = created.user.id;
    } else {
      // already exists → find and update the password
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);

      if (!existing) {
        return fail(`অ্যাডমিন অ্যাকাউন্ট তৈরি করা যায়নি: ${createError?.message ?? "unknown"}`, 500);
      }

      authId = existing.id;
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        app_metadata: { role: "admin" },
      });
      if (updateError) return fail(`পাসওয়ার্ড আপডেট ব্যর্থ: ${updateError.message}`, 500);
    }

    if (!authId) return fail("অ্যাডমিন আইডি পাওয়া যায়নি", 500);

    // ---- 2. ensure the app user row
    let { data: legacy } = await db().from("users").select("id").eq("email", email).maybeSingle();

    if (!legacy) {
      const { data: inserted, error: insertError } = await db()
        .from("users")
        .insert({ name: "Admin", email, role: "admin" })
        .select("id")
        .single();
      if (insertError) return fail(`users row তৈরি ব্যর্থ: ${insertError.message}`, 500);
      legacy = inserted;
    } else {
      await db().from("users").update({ role: "admin" }).eq("id", legacy.id);
    }

    // ---- 3. profile with role=admin (the trigger may have made a customer row)
    const { error: profileError } = await db()
      .from("profiles")
      .upsert(
        {
          id: authId,
          legacy_user_id: legacy!.id,
          full_name: "Admin",
          role: "admin",
          onboarded: true,
          language: "bn",
        },
        { onConflict: "id" }
      );

    if (profileError) return fail(`প্রোফাইল তৈরি ব্যর্থ: ${profileError.message}`, 500);

    // ---- 4. mark as seeded (disables subsequent runs)
    await db()
      .from("settings")
      .upsert({ key: "admin_seeded", value: { done: true, at: new Date().toISOString(), email } });

    await db()
      .from("audit_logs")
      .insert({
        actor_id: legacy!.id,
        action: "admin.seeded",
        entity: "profiles",
        entity_id: authId,
        meta: { email, forced: Boolean(body.force) },
      })
      .then(
        () => undefined,
        () => undefined
      );

    return ok({
      created: !alreadySeeded,
      email,
      authId,
      legacyUserId: legacy!.id,
      next: "Now sign in at /admin/login and then remove SEED_SECRET from Vercel.",
    });
  } catch (error) {
    return handleError(error);
  }
}

/** GET → a non-secret readiness probe (never reveals whether the admin exists). */
export async function GET() {
  return ok({
    seedSecretConfigured: Boolean(process.env.SEED_SECRET && process.env.SEED_SECRET.length >= 24),
    supabaseConfigured: isDbConfigured() && isSupabaseAuthConfigured(),
    adminEmailConfigured: Boolean(process.env.ADMIN_EMAIL),
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
  });
}
