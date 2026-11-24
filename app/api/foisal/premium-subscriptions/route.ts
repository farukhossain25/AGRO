import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { diffOf, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/* ==========================================================================
   PATCH /api/foisal/premium-subscriptions — approve or reject a paid plan
   --------------------------------------------------------------------------
   A premium purchase is a manual payment: the customer sends money to the
   bKash/Nagad number, opens the payment page and reports their TrxID. The row
   in `user_subscriptions` stays `pending` until this route runs — nothing else
   in the app can move a row to `active`, which is what makes this the single
   point of truth the owner asked for ("verify the payment from the premium
   page itself").

   Two actions only:

     approve  → status=active, role=premium + premium_until on the profile,
                the access period is re-derived from the plan the customer
                bought (30 / 182 / 365 days), extending an existing live plan
                instead of overwriting it. The customer is notified.
     reject   → status=cancelled, cancelled_at=now, cancel_reason written,
                profile role left alone (or downgraded from premium → customer
                if that lapsed-to-pending row was their only entitlement).
                The reason is mandatory and the customer is told why.

   Both are idempotent: approving an already-active row returns `already`,
   rejecting an already-cancelled one keeps the first reason.
   ========================================================================== */

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    id: z.string().uuid(),
    /** what the admin saw in the SMS/app — stored verbatim on payment_ref */
    reference: z.string().trim().max(160).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    id: z.string().uuid(),
    reason: z.string().trim().min(2, "কারণ লিখতে হবে").max(300),
  }),
]);

type SubRow = {
  id: string;
  sub_no: string;
  user_id: string;
  plan_id: string | null;
  plan_name_bn: string;
  tier: "basic" | "full";
  amount: number | string;
  status: "pending" | "active" | "grace" | "expired" | "cancelled";
  started_at: string | null;
  expires_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  cancel_reason: string | null;
};

const DAY = 86_400_000;

/**
 * GET /api/foisal/premium-subscriptions — the pending-payment count.
 *
 * The sidebar badge reads this on every navigation. It is deliberately tiny:
 * one head-count query, nothing else, and an empty payload when the DB is
 * unreachable (the panel keeps working, the badge just does not show).
 */
export async function GET() {
  try {
    await requirePermission("premium.manage");
    const { count, error } = await db()
      .from("user_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) throw error;
    return ok({ pending: count ?? 0 });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return ok({ pending: 0 });
  }
}

export async function PATCH(req: Request) {
  try {
    // premium.manage, not orders.write — approving a plan grants access.
    const actor = await requirePermission("premium.manage");
    const body = schema.parse(await req.json());

    const client = db();
    const { data: before, error: loadError } = await client
      .from("user_subscriptions")
      .select(
        "id, sub_no, user_id, plan_id, plan_name_bn, tier, amount, status, started_at, expires_at, payment_method, payment_ref, cancel_reason"
      )
      .eq("id", body.id)
      .maybeSingle<SubRow>();
    if (loadError) throw loadError;
    if (!before) return fail("সাবস্ক্রিপশনটি পাওয়া যায়নি", 404);

    const now = new Date();

    /* ── approve ─────────────────────────────────────────────────────── */
    if (body.action === "approve") {
      if (before.status === "active") {
        return ok({ already: true, subscription: before });
      }
      if (before.status === "cancelled") {
        return fail("বাতিল হওয়া সাবস্ক্রিপশন আবার চালু করা যায় না — গ্রাহক নতুন করে পেমেন্ট করবেন", 409);
      }

      /* Length comes from the plan the customer actually bought. A hard-coded
         30 days gave a yearly customer one month (same bug the sandbox
         activate route documents). */
      const { data: plan } = await client
        .from("plans")
        .select("duration_days")
        .eq("id", before.plan_id ?? "")
        .maybeSingle();
      const durationDays = Number(plan?.duration_days) > 0 ? Number(plan?.duration_days) : 30;

      /* Extend a live plan; do not add a new term to a lapsed one. */
      const base =
        before.expires_at && new Date(before.expires_at) > now ? new Date(before.expires_at) : now;
      const expires = new Date(base.getTime() + durationDays * DAY);

      const { data: updated, error } = await client
        .from("user_subscriptions")
        .update({
          status: "active",
          payment_ref: body.reference?.trim() || before.payment_ref,
          started_at: now.toISOString(),
          expires_at: expires.toISOString(),
          reviewed_at: now.toISOString(),
          reviewed_by: actor.id,
          updated_at: now.toISOString(),
        })
        .eq("id", before.id)
        /* only a pending row may flip — a double click / two admins cannot
           ship two access periods */
        .eq("status", "pending")
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!updated) return ok({ already: true });

      await client
        .from("profiles")
        .update({ role: "premium", premium_until: expires.toISOString() })
        .eq("id", before.user_id)
        .neq("role", "admin");

      await recordAudit({
        actor,
        action: "approve",
        entity: "user_subscriptions",
        entityId: before.id,
        diff: diffOf(before as unknown as Record<string, unknown>, {
          status: "active",
          expires_at: expires.toISOString(),
          payment_ref: updated.payment_ref,
        }),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      }).catch(() => undefined);

      await notify({
        userId: before.user_id,
        audience: "user",
        kind: "premium",
        title: "প্রিমিয়াম সক্রিয় হয়েছে 🎉",
        body: `আপনার ${before.plan_name_bn} প্ল্যানের পেমেন্ট যাচাই হয়েছে। ${expires.toLocaleDateString(
          "bn-BD"
        )} পর্যন্ত সব লাইভ ক্যামেরা দেখতে পারবেন (${before.sub_no})।`,
        link: "/account/premium",
        meta: { subNo: before.sub_no },
        push: true,
      }).catch(() => undefined);

      return ok({ subscription: updated, expiresAt: expires.toISOString(), days: durationDays });
    }

    /* ── reject ──────────────────────────────────────────────────────── */
    if (before.status === "cancelled") {
      return ok({ already: true, subscription: before });
    }
    if (before.status === "active" || before.status === "grace") {
      return fail("সক্রিয় সাবস্ক্রিপশন এখান থেকে বাতিল হয় না — গ্রাহকের অ্যাকাউন্ট পেজ থেকে বাতিল করুন", 409);
    }

    const { data: updated, error } = await client
      .from("user_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: now.toISOString(),
        auto_renew: false,
        cancel_reason: body.reason,
        reviewed_at: now.toISOString(),
        reviewed_by: actor.id,
        updated_at: now.toISOString(),
      })
      .eq("id", before.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) return ok({ already: true });

    /* A rejected payment must leave no access behind. The profile keeps
       premium_until only while another live subscription covers it. */
    const [{ data: others }, { data: profile }] = await Promise.all([
      client
        .from("user_subscriptions")
        .select("id, expires_at")
        .eq("user_id", before.user_id)
        .in("status", ["active", "grace"])
        .gt("expires_at", now.toISOString())
        .limit(1),
      client.from("profiles").select("role").eq("id", before.user_id).maybeSingle(),
    ]);
    if (!others?.length && profile?.role === "premium") {
      await client
        .from("profiles")
        .update({ role: "customer", premium_until: null })
        .eq("id", before.user_id)
        .eq("role", "premium");
    }

    await recordAudit({
      actor,
      action: "reject",
      entity: "user_subscriptions",
      entityId: before.id,
      diff: diffOf(before as unknown as Record<string, unknown>, {
        status: "cancelled",
        cancel_reason: body.reason,
      }),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    await notify({
      userId: before.user_id,
      audience: "user",
      kind: "premium",
      title: `প্রিমিয়াম পেমেন্ট যাচাই হয়নি — ${before.sub_no}`,
      body: `কারণ: ${body.reason}\n\nটাকা কেটে নেওয়া হয়ে থাকলে পেমেন্ট মাধ্যমের সাথে যোগাযোগ করুন, অথবা সঠিক TrxID দিয়ে আবার জমা দিন।`,
      link: "/account/premium",
      meta: { subNo: before.sub_no, reason: body.reason },
      push: true,
    }).catch(() => undefined);

    return ok({ subscription: updated });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
