import type { Metadata } from "next";
import { getPublicMethods } from "@/lib/payment-methods";
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
    methods = await getPublicMethods();
  } catch {
    // A database hiccup must not block checkout entirely — cash on delivery
    // always works, so the customer can still order.
    methods = [];
  }

  return <CheckoutFlow methods={methods} />;
}
