import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  seller_id: z.string().uuid(),
});

type SubRow = { id: string; order_id: string; sub_no: string; seller_earning: number | string };
type ItemRow = { price: number | string; quantity: number };

/**
 * DELETE /api/foisal/seller-payments  { seller_id }
 *
 * "Reset this seller's payments": the owner asked for a way to wipe a seller's
 * payment/order history from the panel without touching the seller's products.
 *
 * What goes:      the seller's sub_orders (the rows that carry commission and
 *                 seller_earning), the order_items belonging to them, and every
 *                 seller_payouts row for that seller.
 * What stays:     the seller record, their products, farms, reviews — nothing
 *                 about the shop itself.
 *
 * The parent orders are not left lying: each affected order is re-totalled from
 * the items that are still on it, and an order that just lost its last item is
 * marked cancelled so a half-empty order never shows as a live sale.
 *
 * Destructive on purpose, so it is behind payouts.write and it is audited with
 * the exact counts it removed.
 */
export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("payouts.write");
    const { seller_id } = schema.parse(await req.json());

    const client = db();

    const { data: seller, error: sellerError } = await client
      .from("sellers")
      .select("id, name_bn, phone")
      .eq("id", seller_id)
      .maybeSingle();
    if (sellerError) throw sellerError;
    if (!seller) return fail("সেলার পাওয়া যায়নি", 404);

    const { data: subs, error: subError } = await client
      .from("sub_orders")
      .select("id, order_id, sub_no, seller_earning")
      .eq("seller_id", seller_id);
    if (subError) throw subError;

    const subRows = (subs ?? []) as unknown as SubRow[];
    const subIds = subRows.map((s) => s.id);
    const affectedOrderIds = Array.from(new Set(subRows.map((s) => s.order_id)));

    // ── 1. the seller's payout records ────────────────────────────────
    const { count: payoutCount, error: payoutError } = await client
      .from("seller_payouts")
      .delete()
      .eq("seller_id", seller_id)
      .select("id");
    if (payoutError) throw payoutError;

    // ── 2. the items that belonged to those sub-orders ────────────────
    let itemCount: number | null = 0;
    if (subIds.length) {
      const { count, error } = await client
        .from("order_items")
        .delete()
        .in("sub_order_id", subIds)
        .select("id");
      if (error) throw error;
      itemCount = count ?? 0;
    }

    // ── 3. the sub-orders themselves ──────────────────────────────────
    const { count: subCount, error: subDeleteError } = await client
      .from("sub_orders")
      .delete()
      .eq("seller_id", seller_id)
      .select("id");
    if (subDeleteError) throw subDeleteError;

    // ── 4. re-total every order that just lost a vendor ───────────────
    const retotalled: string[] = [];
    const cancelled: string[] = [];
    for (const orderId of affectedOrderIds) {
      const { data: order, error: orderError } = await client
        .from("orders")
        .select("id, order_no, subtotal, delivery_charge, discount, total, status")
        .eq("id", orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) continue;

      const { data: rest, error: restError } = await client
        .from("order_items")
        .select("price, quantity")
        .eq("order_id", orderId);
      if (restError) throw restError;

      const remaining = (rest ?? []) as unknown as ItemRow[];
      const subtotal = Math.round(
        remaining.reduce((sum, i) => sum + Number(i.price ?? 0) * Number(i.quantity ?? 0), 0) * 100
      ) / 100;

      if (remaining.length === 0) {
        // Nothing left to deliver: the order cannot stay a live sale.
        await client
          .from("orders")
          .update({
            subtotal: 0,
            total: 0,
            status: "cancelled",
            cancel_reason: "সেলারের পেমেন্ট রেকর্ড অ্যাডমিন রিসেট করেছেন",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        cancelled.push(order.order_no);
      } else {
        const total = Math.max(
          0,
          Math.round((subtotal + Number(order.delivery_charge ?? 0) - Number(order.discount ?? 0)) * 100) / 100
        );
        await client
          .from("orders")
          .update({ subtotal, total, updated_at: new Date().toISOString() })
          .eq("id", orderId);
        retotalled.push(order.order_no);
      }
    }

    await recordAudit({
      actor,
      action: "delete",
      entity: "sellers",
      entityId: seller_id,
      diff: {
        seller: seller.name_bn,
        sub_orders: subCount ?? 0,
        order_items: itemCount ?? 0,
        seller_payouts: payoutCount ?? 0,
        retotalled_orders: retotalled,
        cancelled_orders: cancelled,
      },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    return ok({
      seller: { id: seller.id, name_bn: seller.name_bn },
      removed: {
        sub_orders: subCount ?? 0,
        order_items: itemCount ?? 0,
        seller_payouts: payoutCount ?? 0,
      },
      retotalled_orders: retotalled,
      cancelled_orders: cancelled,
    });
  } catch (error) {
    return handleError(error);
  }
}
