import Link from "next/link";
import { currentUser } from "@/lib/api";
import { getOrdersForUser } from "@/lib/data";
import { formatDateBn, money } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { bn: string; tone: string }> = {
  received: { bn: "গৃহীত", tone: "bg-white/[0.07] text-sand-100/70" },
  packing: { bn: "প্যাকিং", tone: "bg-amber-500/15 text-amber-300" },
  shipped: { bn: "ডেলিভারির পথে", tone: "bg-sky-500/15 text-sky-300" },
  delivered: { bn: "সম্পন্ন", tone: "bg-leaf-600/20 text-leaf-200" },
  cancelled: { bn: "বাতিল", tone: "bg-red-500/15 text-red-300" },
};

export default async function OrdersPage() {
  const user = await currentUser();
  if (!user) return null;

  const orders = (await getOrdersForUser(user.id).catch(() => [])) as (Order & { order_items: OrderItem[] })[];

  if (!orders.length) {
    return (
      <EmptyState
        icon="📦"
        title="এখনো কোনো অর্ডার নেই"
        body="আপনার প্রথম তাজা বাজার শুরু করুন — খামার থেকে সরাসরি।"
        action={<Link href="/products" className="btn-primary">পণ্য দেখুন</Link>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const status = statusLabels[order.status] ?? statusLabels.received;
        return (
          <article key={order.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[13px] font-bold text-leaf-200">{order.order_no}</p>
                <p className="text-[11px] text-sand-100/45">{formatDateBn(order.created_at)}</p>
              </div>
              <span className={`badge ${status.tone}`}>{status.bn}</span>
              <div className="text-right">
                <p className="text-[14px] font-bold">{money(Number(order.total), true)}</p>
                <p className="text-[10.5px] text-sand-100/40">
                  {order.payment_method === "cod" ? "ক্যাশ অন ডেলিভারি" : order.payment_method.toUpperCase()}
                  {" · "}
                  {order.payment_status === "paid" ? "পরিশোধিত" : "অপরিশোধিত"}
                </p>
              </div>
            </div>

            {order.order_items?.length ? (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {order.order_items.slice(0, 4).map((it) => (
                  <li key={it.id} className="badge bg-white/[0.04] text-sand-100/60">
                    {it.name_bn} ×{it.quantity}
                  </li>
                ))}
                {order.order_items.length > 4 ? (
                  <li className="badge bg-white/[0.04] text-sand-100/40">
                    +{order.order_items.length - 4}
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/track?order=${order.order_no}`} className="btn-ghost btn-sm">
                ট্র্যাক করুন
              </Link>
              {order.status === "delivered" ? (
                <Link href={`/order-success?order=${order.order_no}`} className="btn-ghost btn-sm">
                  ইনভয়েস দেখুন
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
