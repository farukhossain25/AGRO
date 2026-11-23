import { z } from "zod";
import { db } from "@/lib/db";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { initPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

const schema = z.object({
  order_no: z.string().trim().min(4).max(32),
  method: z.enum(["bkash", "nagad", "sslcommerz"]),
});

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "pay"), 10, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { order_no, method } = schema.parse(await req.json());

    const { data: order, error } = await db()
      .from("orders")
      .select("order_no, total, customer_name, customer_phone, customer_email, address, district, payment_status, user_id")
      .eq("order_no", order_no.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!order) return fail("অর্ডার পাওয়া যায়নি", 404);
    if (order.payment_status === "paid") return fail("এই অর্ডার ইতিমধ্যে পরিশোধিত", 409);

    /* Section G: opening a gateway session for somebody else's order leaks the
       customer's name, phone and address to the caller (the form fields are
       passed back to the gateway init). Require the same ownership rule as the
       simulate endpoint. Guest orders with no user_id stay open so checkout
       keeps working without an account. */
    if (order.user_id) {
      const user = await currentUser();
      if (!user || user.id !== order.user_id) {
        return fail("এই অর্ডারের জন্য আপনার অনুমতি নেই", 403);
      }
    }

    const init = await initPayment(method, {
      orderNo: order.order_no,
      amount: Number(order.total),
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email ?? undefined,
        address: order.address,
        district: order.district,
      },
    });

    // Persist the gateway reference so callbacks can reconcile.
    if (init.reference) {
      await db().from("orders").update({ payment_ref: init.reference }).eq("order_no", order.order_no);
    }

    return ok({ redirect: init.redirectUrl, simulated: init.simulated, reference: init.reference });
  } catch (error) {
    return handleError(error);
  }
}
