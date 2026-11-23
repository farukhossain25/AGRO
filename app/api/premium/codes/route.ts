import { z } from "zod";
import { db } from "@/lib/db";
import type { TablesInsert } from "@/lib/database.types";
import { fail, handleError, limitGuard, ok, requireUser, created } from "@/lib/api";
import { normaliseAccessCode, generateAccessCode } from "@/lib/stream-auth";
import { getPremiumSettings } from "@/lib/premium";

export const dynamic = "force-dynamic";

const redeemSchema = z.object({ code: z.string().trim().min(8).max(20) });

/** POST /api/premium/codes — redeem a card sold offline */
export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "code-redeem", 8, 60_000);
    if (guard) return guard;

    const user = await requireUser();
    const { code } = redeemSchema.parse(await req.json());
    const normalised = normaliseAccessCode(code);

    const client = db();
    const { data: row, error } = await client
      .from("access_codes")
      .select("*")
      .eq("code", normalised)
      .maybeSingle();

    if (error) throw error;
    if (!row) return fail("কোডটি সঠিক নয়", 404);
    if (row.status === "used") return fail("এই কোডটি আগেই ব্যবহার করা হয়েছে", 409);
    if (row.status === "expired") return fail("কোডটির মেয়াদ শেষ", 410);
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await client.from("access_codes").update({ status: "expired" }).eq("id", row.id);
      return fail("কোডটির মেয়াদ শেষ", 410);
    }

    const settings = await getPremiumSettings();
    const plan = row.plan_id
      ? (await client.from("plans").select("*").eq("id", row.plan_id).maybeSingle()).data
      : null;

    const days = plan?.duration_days ?? 30;
    const now = new Date();
    const expires = new Date(now.getTime() + days * 86_400_000);

    const { data: sub, error: subError } = await client
      .from("user_subscriptions")
      .insert({
        sub_no: `PC-${Date.now().toString(36).toUpperCase()}`,
        user_id: user.id,
        plan_id: plan?.id ?? null,
        plan_name_bn: plan?.name_bn ?? "অ্যাক্সেস কোড প্ল্যান",
        tier: plan?.tier ?? "full",
        status: "active",
        amount: 0,
        payment_method: "code",
        platform: "web",
        payment_ref: normalised,
        started_at: now.toISOString(),
        expires_at: expires.toISOString(),
        device_limit: plan?.max_devices ?? settings.default_device_limit,
        auto_renew: false,
      })
      .select()
      .single();

    if (subError) throw subError;

    await client
      .from("access_codes")
      .update({ status: "used", user_id: user.id, used_at: now.toISOString(), subscription_id: sub.id })
      .eq("id", row.id);

    await client
      .from("profiles")
      .update({ role: "premium", premium_until: expires.toISOString() })
      .eq("id", user.id)
      .neq("role", "admin");

    return created({ subscription: sub, expiresAt: expires.toISOString(), days });
  } catch (error) {
    return handleError(error);
  }
}

const generateSchema = z.object({
  count: z.number().int().min(1).max(200).default(10),
  planId: z.string().uuid().optional(),
  /** days until the unused card itself expires */
  validDays: z.number().int().min(1).max(730).default(180),
});

/** POST /api/premium/codes/generate — admin only */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return fail("শুধু অ্যাডমিন পারবেন", 403);

    const { count, planId, validDays } = generateSchema.parse(await req.json());
    const expires = new Date(Date.now() + validDays * 86_400_000).toISOString();

    const rows = Array.from({ length: count }, () => ({
      code: generateAccessCode(),
      plan_id: planId ?? null,
      status: "unused",
      expires_at: expires,
      note: `BATCH-${new Date().toISOString().slice(0, 10)}`,
    }));

    const { data, error } = await db().from("access_codes").insert(rows as TablesInsert<"access_codes">[]).select("code");
    if (error) throw error;

    await db().from("audit_log").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: "premium_codes.generate",
      entity: "premium_access_codes",
      meta: { count, planId: planId ?? null, validDays },
    });

    return created({ codes: (data ?? []).map((r) => r.code) });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return fail("শুধু অ্যাডমিন পারবেন", 403);

    const { data, error } = await db()
      .from("access_codes")
      .select("code, status, plan_id, note, expires_at, used_at, issued_at")
      .order("issued_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return handleError(error);
  }
}
