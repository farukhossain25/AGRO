import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, ok, requireUser, limitGuard } from "@/lib/api";
import { getPremiumSettings, listPlans } from "@/lib/premium";
import { initPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

const schema = z.object({
  planSlug: z.string().trim().min(2).max(64),
  method: z.enum(["bkash", "nagad", "sslcommerz", "cod"]),
  /** mock gateways need an explicit flag so a lazy click does not create a sub */
  confirm: z.boolean().default(true),
});

/**
 * POST /api/premium/subscribe
 * --------------------------------------------------------------------------
 * Creates a `pending` premium_subscriptions row, then asks the payment layer
 * for a redirect. Sandbox gateways return a simulated URL that hits
 * /api/premium/activate, which is what flips the row to `active`.
 */
export async function POST(req: Request) {
  try {
    const guard = limitGuard(req, "premium-sub", 6, 60_000);
    if (guard) return guard;

    const user = await requireUser();
    const { planSlug, method } = schema.parse(await req.json());

    const plans = await listPlans(true);
    const plan = plans.find((p) => p.slug === planSlug);
    if (!plan) return fail("প্ল্যানটি পাওয়া যায়নি", 404);

    const settings = await getPremiumSettings();
    const client = db();

    // One open subscription at a time — a pending row from an abandoned
    // checkout would otherwise stack up.
    const { data: pending } = await client
      .from("premium_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending");

    for (const row of pending ?? []) {
      await client.from("premium_subscriptions").update({ status: "cancelled" }).eq("id", row.id);
    }

    // Lifetime already-active plan? Extend from the current expiry instead of today.
    const { data: current } = await client
      .from("premium_subscriptions")
      .select("expires_at, status, tier")
      .eq("user_id", user.id)
      .in("status", ["active", "grace"])
      .order("expires_at", { ascending: false })
      .limit(1);

    const base =
      current?.[0]?.expires_at && new Date(current[0].expires_at) > new Date()
        ? new Date(current[0].expires_at)
        : new Date();

    const expires = new Date(base.getTime() + plan.duration_days * 86_400_000);
    const subNo = `PS-${Date.now().toString(36).toUpperCase()}`;

    const { data: sub, error } = await client
      .from("premium_subscriptions")
      .insert({
        sub_no: subNo,
        user_id: user.id,
        plan_id: plan.id,
        plan_name_bn: plan.name_bn,
        tier: plan.tier,
        status: method === "cod" ? "active" : "pending",
        amount: plan.price,
        payment_method: method,
        platform: "web",
        started_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        grace_until: null,
        device_limit: plan.max_devices || settings.default_device_limit,
        auto_renew: false,
      })
      .select()
      .single();

    if (error) throw error;

    if (method === "cod") {
      await activateUser(user.id, expires);
      return created({ subscription: sub, redirect: null, simulated: false, expiresAt: expires.toISOString() });
    }

    const init = await initPayment(method, {
      orderNo: subNo,
      amount: plan.price,
      customer: {
        name: user.name ?? "গ্রাহক",
        phone: user.phone ?? "",
        email: user.email ?? undefined,
        address: "",
        district: "",
      },
    });

    await client
      .from("premium_subscriptions")
      .update({ payment_ref: init.reference ?? null })
      .eq("id", sub.id);

    return created({
      subscription: sub,
      redirect: init.redirectUrl,
      simulated: init.simulated,
      reference: init.reference,
      expiresAt: expires.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}

/** Flip the user's role + premium_until so middleware and headers agree. */
async function activateUser(userId: string, until: Date) {
  await db()
    .from("users")
    .update({ role: "premium", premium_until: until.toISOString() })
    .eq("id", userId)
    .neq("role", "admin");
}

export async function GET() {
  try {
    const user = await requireUser();
    const { data, error } = await db()
      .from("premium_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return handleError(error);
  }
}
