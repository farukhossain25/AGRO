import { db } from "@/lib/db";
import { currentUser } from "@/lib/api";
import { can } from "@/lib/permissions";
import { PaymentConsole } from "@/components/admin/payment-console";
import type { PaymentQueueRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /foisal/payments — the verification queue.
 *
 * Read access needs `payments.read` (manager+); the approve buttons are only
 * rendered when the session holds `payments.verify` (admin). The API enforces
 * both again, so hiding the button is a courtesy, not the boundary.
 */
export default async function AdminPaymentsPage() {
  const user = await currentUser();

  const [queue, methods] = await Promise.all([
    db()
      .from("v_payment_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    db().from("payment_methods").select("code, name_bn").order("sort_order"),
  ]);

  return (
    <PaymentConsole
      initial={(queue.data ?? []) as PaymentQueueRow[]}
      methods={(methods.data ?? []) as { code: string; name_bn: string }[]}
      canVerify={can(user, "payments.verify")}
    />
  );
}
