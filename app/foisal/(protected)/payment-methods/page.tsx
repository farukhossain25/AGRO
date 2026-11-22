import { db } from "@/lib/db";
import { PaymentMethodManager } from "@/components/admin/payment-method-manager";
import type { PaymentMethodRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** /foisal/payment-methods — receiving numbers, no code edit needed. */
export default async function AdminPaymentMethodsPage() {
  const { data } = await db()
    .from("payment_methods")
    .select("*")
    .order("sort_order", { ascending: true });

  return <PaymentMethodManager initial={(data ?? []) as PaymentMethodRow[]} />;
}
