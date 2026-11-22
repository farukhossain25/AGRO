import { z } from "zod";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { markDelivered } from "@/lib/parcels";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(16).max(64) });

/** POST /api/admin/parcels/deliver — rider scans, staff confirms */
export async function POST(req: Request) {
  try {
    const admin = await requirePermission("orders.write");
    const { token } = schema.parse(await req.json());

    const parcel = await markDelivered(token, admin.id);
    if (!parcel) return fail("পার্সেল পাওয়া যায়নি", 404);

    // Tell the customer their box arrived.
    try {
      const { data: order } = await db()
        .from("orders")
        .select("user_id, order_no")
        .eq("id", parcel.order_id)
        .maybeSingle();

      if (order?.user_id) {
        await notify({
          userId: order.user_id,
          kind: "status",
          title: "আপনার অর্ডার ডেলিভারি সম্পন্ন হয়েছে",
          body: `অর্ডার #${order.order_no} সফলভাবে পৌঁছেছে। ধন্যবাদ!`,
          link: `/track?order=${order.order_no}`,
          push: true,
        });
      }
    } catch {
      /* notification is best-effort */
    }

    return ok({ orderNo: parcel.order_no, delivered: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
