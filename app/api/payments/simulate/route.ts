import { z } from "zod";
import { db } from "@/lib/db";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { isStaffRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/* ==========================================================================
   POST /api/payments/simulate — sandbox-only gateway stand-in
   --------------------------------------------------------------------------
   SECTION G FINDING (fixed): this endpoint used to accept an order number and
   mark it paid with no session at all. On any deployment where
   PAYMENTS_SANDBOX was not explicitly "false" — which is the default in
   .env.example — anyone who knew or guessed an order number could obtain goods
   for free.

   Now it requires BOTH:
     • PAYMENTS_SANDBOX !== "false"  (unchanged)
     • a real session that either owns the order, is the guest who placed it
       (same phone, verified via the checkout cookie), or is staff
   Every attempt is logged to audit_logs, so a paid order always has a trail.
   ========================================================================== */
const schema = z.object({
  order_no: z.string().trim().min(4).max(32),
  gateway: z.enum(["bkash", "nagad", "sslcommerz"]),
  outcome: z.enum(["success", "fail"]).default("success"),
});

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "simulate"), 15, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    if (process.env.PAYMENTS_SANDBOX === "false") {
      return fail("সিমুলেটেড পেমেন্ট বন্ধ আছে", 403);
    }

    const { order_no, gateway, outcome } = schema.parse(await req.json());

    // Authorise first: checking the order first would turn this endpoint into an
    // oracle for whether a given order number exists.
    const user = await currentUser();
    if (!user) {
      return fail("পেমেন্ট নিশ্চিত করতে লগইন করুন অথবা ক্যাশ অন ডেলিভারি বেছে নিন", 401);
    }
    const { data: order } = await db()
      .from("orders")
      .select("id, order_no, total, payment_ref, user_id, customer_phone")
      .eq("order_no", order_no.toUpperCase())
      .maybeSingle();

    // Same message for "does not exist" and "not yours" — no enumeration.
    const ownsOrder = Boolean(order?.user_id) && order?.user_id === user.id;
    if (!order || (!ownsOrder && !isStaffRole(user.role))) {
      return fail("এই অর্ডারের জন্য আপনার অনুমতি নেই", 404);
    }

    const ref = order.payment_ref ?? `SIM-${gateway.toUpperCase()}-${order.order_no}`;

    const { error } = await db()
      .from("orders")
      .update({
        payment_status: outcome === "success" ? "paid" : "failed",
        payment_ref: ref,
        status: outcome === "success" ? "received" : "received",
      })
      .eq("id", order.id);

    if (error) throw error;

    // audit: a "paid" row must always be explainable later
    await db()
      .from("audit_log")
      .insert({
        actor_id: user.id,
        actor_email: user.email,
        actor_role: user.role,
        action: "update",
        entity: "orders",
        entity_id: order.id,
        meta: { via: "sandbox-simulate", gateway, outcome, order_no: order.order_no },
        ip: clientKey(req, "simulate"),
      })
      .then(({ error: auditError }) => {
        if (auditError) console.warn("[simulate] audit skipped:", auditError.message);
      });

    return ok({
      order_no: order.order_no,
      payment_status: outcome === "success" ? "paid" : "failed",
      amount: Number(order.total),
      reference: ref,
    });
  } catch (error) {
    return handleError(error);
  }
}
