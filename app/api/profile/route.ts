import { z } from "zod";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { getProfileByLegacyId, updateProfile } from "@/lib/profile";
import { db, isDbConfigured } from "@/lib/db";
import { SUPABASE_URL } from "@/lib/env";
import { resolvePremiumState } from "@/lib/premium";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateSchema = z.object({
  full_name: z.string().trim().min(2, "নাম কমপক্ষে ২ অক্ষর").max(80).optional(),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^(\+?88)?01[3-9]\d{8}$/.test(v), "সঠিক মোবাইল নম্বর দিন (01712345678)")
    .optional(),
  bio: z.string().trim().max(400, "বায়ো ৪০০ অক্ষরের মধ্যে রাখুন").optional(),
  language: z.enum(["bn", "en"]).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  notifications: z
    .object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    })
    .optional(),
  onboarded: z.boolean().optional(),
  /* Only a file in OUR avatars bucket (or a Google profile photo) may be set
     as an avatar — otherwise this column becomes a tracking pixel. */
  avatar_url: z
    .string()
    .trim()
    .max(600)
    .refine(
      (value) =>
        value === "" ||
        value.startsWith(`${SUPABASE_URL}/storage/v1/object/public/avatars/`) ||
        /^https:\/\/(lh3\.googleusercontent\.com|[a-z0-9-]+\.googleusercontent\.com)\//i.test(value),
      "ছবির লিঙ্ক সঠিক নয়"
    )
    .optional(),
});

/** GET /api/profile — the signed-in user's profile + premium summary. */
export async function GET() {
  try {
    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);

    const profile = await getProfileByLegacyId(session.id);
    if (!profile) return ok({ profile: null, premium: null });

    const premium = await resolvePremiumState(session.id, session.role).catch(() => null);

    return ok({
      profile,
      premium: premium
        ? {
            active: premium.canWatch,
            tier: premium.subscription?.tier ?? null,
            plan: premium.subscription?.plan_name_bn ?? null,
            expiresAt: premium.subscription?.expires_at ?? null,
            trialActive: premium.trial?.active ?? false,
            trialMinutes: premium.trial?.minutes ?? 0,
            reason: premium.reason,
          }
        : null,
    });
  } catch (error) {
    // Never break the profile page because the DB blinked.
    console.warn("[profile] read failed:", (error as Error).message);
    return ok({ profile: null, premium: null });
  }
}

/** PATCH /api/profile — update editable fields. */
export async function PATCH(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "profile-update"), 20, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);

    const profile = await getProfileByLegacyId(session.id);
    if (!profile) return fail("প্রোফাইল পাওয়া যায়নি — আবার লগইন করুন", 404);

    const patch = updateSchema.parse(await req.json());
    const updated = await updateProfile(profile.id, patch);

    if (!updated) return fail("প্রোফাইল সংরক্ষণ করা যায়নি", 500);

    if (isDbConfigured()) {
      await db()
        .from("audit_logs")
        .insert({
          actor_id: session.id,
          action: "profile.updated",
          entity: "profiles",
          entity_id: profile.id,
          meta: { fields: Object.keys(patch) },
        })
        .then(
          () => undefined,
          () => undefined
        );
    }

    return ok({ profile: updated });
  } catch (error) {
    return handleError(error);
  }
}
