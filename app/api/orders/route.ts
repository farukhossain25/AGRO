import { clientKey, created, currentUser, fail, handleError, rateLimit, tooMany } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { createOrder } from "@/lib/orders";
import { ensureParcel } from "@/lib/parcels";
import { notify, notifyAdmins } from "@/lib/notify";
import { ADMIN_BASE } from "@/lib/paths";

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

    // A parcel row (with its QR token) is created up-front so the shipping
    // label can be printed the moment the order lands. Failure is non-fatal.
    await ensureParcel(order.id, order.order_no).catch((error) =>
      console.warn("[orders] parcel create failed:", (error as Error).message)
    );

    // Notify in the background — never hold the checkout response for this.
    const notifyTasks = [
      notifyAdmins({
        kind: "order",
        title: `নতুন অর্ডার #${order.order_no}`,
        body: `${order.customer_name} · ৳${order.total} · ${order.district}`,
        link: `${ADMIN_BASE}/orders`,
      }),
    ];
    if (user?.id) {
      notifyTasks.push(
        notify({
          userId: user.id,
          kind: "order",
          title: `অর্ডার #${order.order_no} গ্রহণ করা হয়েছে`,
          body: `মোট ৳${order.total}। আমরা শীঘ্রই প্যাকিং শুরু করব।`,
          link: `/track?order=${order.order_no}`,
        })
      );
    } else {
      notifyTasks.push(
        notify({
          userId: null,
          kind: "order",
          title: `অর্ডার #${order.order_no}`,
          body: `${data.phone} — অর্ডার ট্র্যাক করতে অর্ডার নম্বর ও ফোন ব্যবহার করুন।`,
          phone: data.phone,
          push: false,
        })
      );
    }
    await Promise.allSettled(notifyTasks);

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
