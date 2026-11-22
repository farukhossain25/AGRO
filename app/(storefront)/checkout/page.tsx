import type { Metadata } from "next";
import { getActiveMethods } from "@/lib/manual-payments";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import type { PublicPaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

/* Checkout must not be indexed and must not be cached: it embeds live payment
   methods (including the receiving number) that the owner can change at any
   time from /foisal/payment-methods. */
export const metadata: Metadata = {
  title: "চেকআউট",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  let methods: PublicPaymentMethod[] = [];
  try {
    const rows = await getActiveMethods();
    methods = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name_bn: row.name_bn,
      name_en: row.name_en,
      kind: row.kind,
      logo_url: row.logo_url,
      account_type: row.account_type,
      account_number: row.account_number,
      account_name: row.account_name,
      bank_name: row.bank_name,
      branch_name: row.branch_name,
      instruction_bn: row.instruction_bn,
      min_amount: Number(row.min_amount),
      max_amount: row.max_amount == null ? null : Number(row.max_amount),
      requires_trx: row.requires_trx,
      requires_sender: row.requires_sender,
    }));
  } catch {
    // A database hiccup must not block checkout entirely — cash on delivery
    // always works, so the customer can still order.
    methods = [];
  }

  return <CheckoutFlow methods={methods} />;
}
