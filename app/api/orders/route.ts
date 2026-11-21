import { clientKey, created, currentUser, fail, handleError, rateLimit, tooMany } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { createOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "order"), 8, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = await req.json();
    const data = checkoutSchema.parse(body);

    const user = await currentUser().catch(() => null);

    const { order } = await createOrder({
      userId: user?.id ?? null,
      customer: {
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || undefined,
        division: data.division,
        district: data.district,
        upazila: data.upazila,
        address: data.address,
        delivery_note: data.delivery_note || undefined,
      },
      paymentMethod: data.payment_method,
      items: data.items,
      couponCode: data.coupon_code || undefined,
    });

    return created({
      order_no: order.order_no,
      total: order.total,
      payment_method: order.payment_method,
      status: order.status,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 422) return fail((error as Error).message, 422);
    return handleError(error);
  }
}
