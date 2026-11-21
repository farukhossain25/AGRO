import { z } from "zod";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Simulated gateway confirmation — used ONLY while PAYMENTS_SANDBOX is on and
 * no live merchant credentials are configured. It marks the order as paid so
 * the post-payment UI can be exercised end to end.
 */
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

    const { data: order } = await db()
      .from("orders")
      .select("id, order_no, total, payment_ref")
      .eq("order_no", order_no.toUpperCase())
      .maybeSingle();

    if (!order) return fail("অর্ডার পাওয়া যায়নি", 404);

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
