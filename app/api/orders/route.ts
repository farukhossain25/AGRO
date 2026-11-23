import { NextResponse } from "next/server";
import { clientKey, created, currentUser, fail, handleError, rateLimit, tooMany } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { createOrder } from "@/lib/orders";
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

    /* Sub-orders, the payment row, the parcel/QR token and the in-app
       notifications are all written inside place_order()'s transaction. Here
       we only fan out the extra channels (push/email/SMS) — `storeInApp:false`
       keeps the notification centre free of duplicates. */
    const notifyTasks = [
      notifyAdmins({
        kind: "order",
        title: `নতুন অর্ডার #${order.order_no}`,
        body: `${order.customer_name} · ৳${order.total} · ${order.district}`,
        link: `${ADMIN_BASE}/orders`,
        storeInApp: false,
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
          phone: data.phone,
          email: data.email || undefined,
          storeInApp: false,
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
          email: data.email || undefined,
          push: false,
          storeInApp: false,
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
    const unavailable = (error as { unavailable?: unknown }).unavailable;

    /* Product-level rejection: send the list back so the cart can offer a
       one-tap "remove these" instead of a dead end. */
    if (status === 409 && Array.isArray(unavailable)) {
      return NextResponse.json(
        { ok: false, message: (error as Error).message, code: "CART_UNAVAILABLE", unavailable },
        { status: 409 }
      );
    }
    if (status === 422) return fail((error as Error).message, 422);

    console.error("[orders] placement failed:", (error as Error).message, error);
    return handleError(error);
  }
}
