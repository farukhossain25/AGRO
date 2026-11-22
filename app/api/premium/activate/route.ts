import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  subNo: z.string().trim().min(4).max(40),
  reference: z.string().max(120).optional(),
});

/**
 * POST /api/premium/activate
 * --------------------------------------------------------------------------
 * Sandbox stand-in for a gateway callback. Idempotent: activating an
 * already-active subscription is a no-op.
 *
 * SECURITY — this route activates a plan WITHOUT taking money, so it must
 * never be callable by a customer. Previously any signed-in user could POST
 * their own pending sub_no here and get a free year of premium. With manual
 * payments there is exactly one legitimate path to `active`:
 *     admin approves the TrxID -> decidePayment() -> activatePremium()
 * so this handler is now closed to everyone except an admin (the sandbox
 * "simulate success" button, when the owner deliberately tests). The brief is
 * explicit that only an admin may approve a payment.
 *
 * The cancel path (DELETE) stays customer-accessible — cancelling your own
 * subscription is always allowed.
 */
export async function POST(req: Request) {
  try {
    const limit = limitGuard(req, "api-premium-activate", 30, 60_000);
    if (limit) return limit;
    const user = await requireUser();
    const { subNo, reference } = schema.parse(await req.json());

    const client = db();
    const { data: sub, error } = await client
      .from("premium_subscriptions")
      .select("*")
      .eq("sub_no", subNo.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!sub) return fail("সাবস্ক্রিপশন পাওয়া যায়নি", 404);

    /* Admin-only. A customer pointing this at their own pending row would
       otherwise activate a plan they never paid for. */
    if (user.role !== "admin") {
      return fail("এই কাজটি শুধুমাত্র অ্যাডমিন করতে পারেন। পেমেন্ট যাচাইয়ের পর প্ল্যান নিজে থেকেই চালু হবে।", 403);
    }

    if (sub.status === "active") return ok({ already: true, subscription: sub });

    /* Length comes from the plan the customer actually bought (30 / 182 / 365
       days) — a hard-coded 30 gave a yearly customer one month. */
    const { data: plan } = await client
      .from("premium_plans")
      .select("duration_days")
      .eq("id", sub.plan_id)
      .maybeSingle();
    const durationDays = Number(plan?.duration_days) > 0 ? Number(plan?.duration_days) : 30;

    const now = new Date();
    /* Extend an existing live plan; do not add the new term to a lapsed one. */
    const expires =
      sub.expires_at && new Date(sub.expires_at) > now
        ? new Date(new Date(sub.expires_at).getTime() + durationDays * 86_400_000)
        : new Date(now.getTime() + durationDays * 86_400_000);

    const { data: updated, error: updateError } = await client
      .from("premium_subscriptions")
      .update({
        status: "active",
        payment_ref: reference ?? sub.payment_ref ?? null,
        started_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq("id", sub.id)
      .select()
      .single();

    if (updateError) throw updateError;

    await client
      .from("users")
      .update({ role: "premium", premium_until: expires.toISOString() })
      .eq("id", sub.user_id)
      .neq("role", "admin");

    await notify({
      userId: sub.user_id,
      kind: "premium",
      title: "প্রিমিয়াম সক্রিয় হয়েছে 🎉",
      body: `আপনার ${sub.tier === "full" ? "ফুল অ্যাক্সেস" : "বেসিক"} প্ল্যান ${
        expires.toLocaleDateString("bn-BD")
      } পর্যন্ত সক্রিয়। এখন সব লাইভ ক্যামেরা দেখতে পারবেন।`,
      link: "/live",
    }).catch(() => undefined);

    return ok({ subscription: updated, expiresAt: expires.toISOString() });
  } catch (error) {
    return handleError(error);
  }
}

/** GET /api/premium/activate?subNo=... — the sandbox redirect lands here. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const subNo = url.searchParams.get("subNo");
  const ok2 = url.searchParams.get("ok") === "1";

  if (!ok2) return NextResponse.redirect(new URL("/live/plans?failed=1", req.url));

  if (subNo) {
    try {
      await POST(
        new Request(url.toString(), {
          method: "POST",
          headers: req.headers,
          body: JSON.stringify({ subNo }),
        })
      );
    } catch {
      /* fall through to the page which will show the status */
    }
  }

  return NextResponse.redirect(new URL(`/live/plans?activated=${encodeURIComponent(subNo ?? "")}`, req.url));
}

export async function DELETE(req: Request) {
  try {
    const limit = limitGuard(req, "api-premium-activate", 30, 60_000);
    if (limit) return limit;
    const user = await requireUser();
    const { subNo } = schema.parse(await req.json());

    const { data, error } = await db()
      .from("premium_subscriptions")
      .update({ status: "cancelled", auto_renew: false })
      .eq("sub_no", subNo.toUpperCase())
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("সাবস্ক্রিপশন পাওয়া যায়নি", 404);

    // Access continues until expiry — cancelling only stops renewal.
    return ok({ subscription: data, note: "মেয়াদ শেষ পর্যন্ত অ্যাক্সেস থাকবে" });
  } catch (error) {
    return handleError(error);
  }
}
