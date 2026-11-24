import { z } from "zod";
import { db } from "@/lib/db";
import type { TablesUpdate } from "@/lib/database.types";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { notify } from "@/lib/notify";
import { recordAudit, diffOf } from "@/lib/audit";
import { applyOrderCancellation } from "@/lib/orders";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["received", "packing", "shipped", "delivered", "cancelled"]).optional(),
  payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  cancel_reason: z.string().trim().max(300).optional(),
  /**
   * A reported payment (TrxID) that turned out to be fake or wrong. Before
   * this existed the panel could only *confirm* a payment, so a suspicious
   * one had to be confirmed or left hanging. This marks it failed and
   * cancels the order, with every consequence that carries.
   */
  action: z.enum(["reject_payment"]).optional(),
});

type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  payment_status: string;
  payment_ref: string | null;
  user_id: string | null;
  coupon_code: string | null;
  total: number | string;
  cancel_reason?: string | null;
};

export async function PATCH(req: Request) {
  try {
    // A write on money and order state — orders.write, not the read permission.
    const actor = await requirePermission("orders.write");
    const { id, status, payment_status, cancel_reason, action } = schema.parse(await req.json());

    const { data: before, error: loadError } = await db()
      .from("orders")
      .select("id, order_no, status, payment_status, payment_ref, user_id, coupon_code, total, cancel_reason")
      .eq("id", id)
      .maybeSingle<OrderRow>();
    if (loadError) throw loadError;
    if (!before) return fail("অর্ডার পাওয়া যায়নি", 404);

    const rejecting = action === "reject_payment";
    const patch: TablesUpdate<"orders"> = {};

    if (rejecting) {
      patch.payment_status = "failed";
      patch.status = "cancelled";
      patch.cancel_reason = cancel_reason?.trim() || "পেমেন্ট যাচাই হয়নি — প্রেরিত TrxID মিল পায়নি";
    } else {
      if (status) patch.status = status;
      if (payment_status) patch.payment_status = payment_status;
      if (status === "cancelled" && cancel_reason?.trim()) patch.cancel_reason = cancel_reason.trim();
    }
    if (!Object.keys(patch).length) return fail("আপডেট করার কিছু নেই", 422);

    // A cancelled order stays cancelled. The flip below is guarded in the
    // database, so a repeat click, a retry or two admins at once can never run
    // the side effects (stock back, coupon back, seller notifications) twice.
    const cancelling = patch.status === "cancelled" && before.status !== "cancelled";
    const query = db()
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    const gated = cancelling ? query.not("status", "eq", "cancelled") : query;
    const { data, error } = await gated.select("id, order_no, status, payment_status, user_id").maybeSingle();
    if (error) throw error;

    if (!data) {
      // Someone else cancelled it between the read above and this update.
      return ok({
        id,
        status: "cancelled",
        payment_status: before.payment_status,
        cancel_reason: before.cancel_reason ?? patch.cancel_reason ?? null,
        already: true,
      });
    }

    if (cancelling) {
      await applyOrderCancellation(before, patch.cancel_reason ?? "");
    }

    // The order's progress is the sellers' progress too — their dashboard
    // reads sub_orders.status, which used to stay "received" until delivery.
    if (patch.status && patch.status !== "cancelled") {
      await db()
        .from("sub_orders")
        .update({ status: patch.status as "received" | "packing" | "shipped" | "delivered", updated_at: new Date().toISOString() })
        .eq("order_id", id)
        .in("status", ["received", "packing", "shipped"]);
    }

    const auditAction = rejecting
      ? "reject"
      : cancelling
        ? "deactivate"
        : patch.payment_status === "paid" && before.payment_status !== "paid"
          ? "verify"
          : "update";
    await recordAudit({
      actor,
      action: auditAction,
      entity: "orders",
      entityId: id,
      diff: diffOf(before as unknown as Record<string, unknown>, { ...patch, cancel_reason: patch.cancel_reason ?? undefined }),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    // marking an order delivered invites per-supplier reviews (section A)
    if (patch.status === "delivered" && data.user_id) {
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

    // The customer should hear about a money decision either way
    if (data.user_id && patch.payment_status && patch.payment_status !== before.payment_status) {
      const paid = patch.payment_status === "paid";
      await notify({
        userId: data.user_id as string,
        audience: "user",
        kind: "order",
        title: paid ? `পেমেন্ট গৃহীত — ${data.order_no}` : `পেমেন্ট গৃহীত হয়নি — ${data.order_no}`,
        body: paid
          ? "আপনার পেমেন্ট যাচাই হয়েছে, অর্ডার প্রসেস হচ্ছে।"
          : (patch.cancel_reason as string | undefined) || "প্রেরিত TrxID যাচাই হয়নি। সঠিক তথ্য দিয়ে নতুন অর্ডার করুন।",
        link: "/account/orders",
      }).catch(() => undefined);
    }

    return ok({ id: data.id, status: data.status, payment_status: data.payment_status, cancel_reason: patch.cancel_reason ?? null });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}

/** Order counts + revenue grouped by day, used by the reports page. */
export async function GET(req: Request) {
  try {
    await requirePermission("orders.write");
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
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
