import { z } from "zod";
import { db } from "@/lib/db";
import type { TablesUpdate } from "@/lib/database.types";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { notify } from "@/lib/notify";
import { recordAudit, diffOf } from "@/lib/audit";
import { announceCancellation, cancelOrder, deleteOrder, OrderActionError } from "@/lib/orders";

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
  /** Taka taken from the referral wallet at checkout (migration 25). */
  wallet_used?: number | string | null;
  cancel_reason?: string | null;
};

export async function PATCH(req: Request) {
  try {
    // A write on money and order state — orders.write, not the read permission.
    const actor = await requirePermission("orders.write");
    const { id, status, payment_status, cancel_reason, action } = schema.parse(await req.json());

    const { data: before, error: loadError } = await db()
      .from("orders")
      .select("id, order_no, status, payment_status, payment_ref, user_id, coupon_code, total, wallet_used, cancel_reason")
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

    /* ---------------------------------------------------------------------
       Cancelling is NOT a status update any more.
       ---------------------------------------------------------------------
       Flipping `orders.status` here and undoing the side effects afterwards
       (seven separate calls in the old build) meant a failure halfway left an
       order cancelled while its stock, coupon or wallet stayed put. Worse, the
       route had no way to refund a payment that had already arrived.

       Now the whole thing — status, stock, coupon, wallet, sub_orders — is one
       locked transaction in order_cancel(). It answers "already" for a repeat
       or a race, and "delivered" for an order that is a finished sale.
       --------------------------------------------------------------------- */
    const cancelling = patch.status === "cancelled" || rejecting;

    if (cancelling) {
      const outcome = await cancelOrder(id, patch.cancel_reason ?? "", actor.id);

      if (outcome.result === "delivered") {
        return fail("ডেলিভারি হয়ে যাওয়া অর্ডার বাতিল করা যায় না — টাকা ফেরত দিতে চাইলে পেমেন্ট আলাদা ভাবে সামলান", 409);
      }

      const finalStatus = "cancelled";
      const after = await db()
        .from("orders")
        .select("id, order_no, status, payment_status, user_id, cancel_reason")
        .eq("id", id)
        .maybeSingle();

      if (outcome.result === "cancelled") {
        await announceCancellation(before, patch.cancel_reason ?? "");
      }

      await recordAudit({
        actor,
        action: rejecting ? "reject" : "deactivate",
        entity: "orders",
        entityId: id,
        diff: {
          status: { from: before.status, to: finalStatus },
          ...(patch.cancel_reason ? { cancel_reason: { from: before.cancel_reason ?? null, to: patch.cancel_reason } } : {}),
          ...(outcome.result === "cancelled"
            ? { wallet_refunded: { from: 0, to: outcome.walletRefunded } }
            : {}),
        },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      }).catch(() => undefined);

      if (before.user_id && outcome.result === "cancelled" && rejecting) {
        await notify({
          userId: before.user_id,
          audience: "user",
          kind: "order",
          title: `পেমেন্ট গৃহীত হয়নি — ${before.order_no}`,
          body: patch.cancel_reason || "প্রেরিত TrxID যাচাই হয়নি। সঠিক তথ্য দিয়ে নতুন অর্ডার করুন।",
          link: "/account/orders",
        }).catch(() => undefined);
      }

      return ok({
        id,
        status: finalStatus,
        payment_status: after.data?.payment_status ?? before.payment_status,
        cancel_reason: after.data?.cancel_reason ?? patch.cancel_reason ?? null,
        already: outcome.result === "already",
        wallet_refunded: outcome.result === "cancelled" ? outcome.walletRefunded : 0,
      });
    }

    /* ---- everything that is not a cancellation ------------------------- */
    const { data, error } = await db()
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, order_no, status, payment_status, user_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("অর্ডার পাওয়া যায়নি", 404);

    // The order's progress is the sellers' progress too — their dashboard
    // reads sub_orders.status, which used to stay "received" until delivery.
    if (patch.status) {
      await db()
        .from("sub_orders")
        .update({ status: patch.status as "received" | "packing" | "shipped" | "delivered", updated_at: new Date().toISOString() })
        .eq("order_id", id)
        .in("status", ["received", "packing", "shipped"]);
    }

    const auditAction =
      patch.payment_status === "paid" && before.payment_status !== "paid" ? "verify" : "update";
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
    if (error instanceof OrderActionError) return fail(error.message, error.status);
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}

/**
 * DELETE /api/foisal/orders?id=<uuid>  — orders.write
 *
 * "Remove this order from the history": test orders, duplicates, a customer
 * asking for it to be gone. The audit log keeps a full snapshot of the row.
 *
 * WHAT WAS WRONG BEFORE THIS
 * --------------------------------------------------------------------------
 * This handler restored the stock and the coupon and then deleted the row. It
 * never touched the wallet. An order that had spent ৳300 of wallet credit could
 * be deleted — the customer stayed ৳300 poorer, and because
 * `wallet_transactions.order_id` is `on delete set null`, the ledger row lost
 * the very link that would prove the debit had happened. The money was simply
 * gone, with no record to reconstruct it from.
 *
 * It also deleted a paid-but-undelivered order on request, which destroys the
 * only link between the customer's money and their purchase.
 *
 * Now the whole thing is one transaction in `order_delete()`: refund the wallet
 * if (and only if) the ledger holds a real debit, restore stock and coupon,
 * void the sub_orders, delete the row, and write the audit entry *inside* the
 * transaction. It refuses:
 *   • a delivered order — that is a sale, not a mistake (409 ORDER_DELIVERED)
 *   • a paid, undelivered order — resolve the payment first
 *     (409 ORDER_PAYMENT_UNRESOLVED)
 */
export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("orders.write");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const { data: before, error: loadError } = await db()
      .from("orders")
      .select("id, order_no, status, payment_status, payment_ref, user_id, coupon_code, total, wallet_used, cancel_reason")
      .eq("id", id)
      .maybeSingle<OrderRow>();
    if (loadError) throw loadError;
    if (!before) return fail("অর্ডার পাওয়া যায়নি", 404);

    const outcome = await deleteOrder(id, actor.id);

    /* The RPC writes the audit row itself, inside the transaction, so it can
       never record a delete that was rolled back. Nothing is added here — a
       second record would only duplicate it. */
    return ok({
      id,
      order_no: outcome.orderNo || before.order_no,
      deleted: true,
      restocked_items: outcome.stockRestored,
      coupon_restored: outcome.couponRestored,
      wallet_refunded: outcome.walletRefunded,
    });
  } catch (error) {
    if (error instanceof OrderActionError) return fail(error.message, error.status);
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
