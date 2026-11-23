import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/checkout-frame";

export const dynamic = "force-dynamic";

/* Checkout must not be indexed and must not be cached. */
export const metadata: Metadata = {
  title: "চেকআউট",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  return <CheckoutFrame />;
}
