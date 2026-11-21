import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, requireAdmin } from "@/lib/api";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["received", "packing", "shipped", "delivered", "cancelled"]).optional(),
  payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { id, status, payment_status } = schema.parse(await req.json());

    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (payment_status) patch.payment_status = payment_status;
    if (!Object.keys(patch).length) return fail("আপডেট করার কিছু নেই", 422);

    const { data, error } = await db().from("orders").update(patch).eq("id", id).select("id, order_no, status, payment_status, user_id").single();
    if (error) throw error;

    // marking an order delivered invites per-supplier reviews (section A)
    if (status === "delivered") {
      await db()
        .from("sub_orders")
        .update({ status: "delivered" })
        .eq("order_id", id)
        .then(
          () => undefined,
          () => undefined
        );

      if (data.user_id) {
        await notify({
          userId: data.user_id as string,
          audience: "user",
          kind: "order",
          title: "পণ্য পেয়েছেন? রিভিউ দিন ⭐",
          body: `অর্ডার ${data.order_no} ডেলিভারি সম্পন্ন। প্রতিটি সেলার ও পণ্যকে আলাদাভাবে রেটিং দিন।`,
          link: `/account/orders/${id}/review`,
          meta: { orderId: id, cta: "review" },
          push: true,
        }).catch(() => undefined);
      }
    }

    return ok({ id: data.id, status: data.status, payment_status: data.payment_status });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}

/** Order counts + revenue grouped by day, used by the reports page. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const days = Math.min(180, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await db()
      .from("orders")
      .select("id, total, status, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}
