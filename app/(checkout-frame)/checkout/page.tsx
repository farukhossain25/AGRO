import type { Metadata } from "next";
import { currentUser } from "@/lib/api";
import { db, isDbConfigured } from "@/lib/db";
import { getPublicMethods } from "@/lib/payment-methods";
import { getProfile } from "@/lib/profile";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import type { Address, PublicPaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

/* Checkout must not be indexed and must not be cached. */
export const metadata: Metadata = {
  title: "চেকআউট",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const user = await currentUser().catch(() => null);

  /* The page is only ever as good as the data behind it:
     - payment methods come from the owner's admin panel (/foisal/payment-methods)
     - the address book comes from the signed-in customer's `addresses` rows
     Both are read per request; a database blip degrades to COD + a blank form
     instead of a 500, exactly like the admin pages do. */
  let methods: PublicPaymentMethod[] = [];
  let customer: { full_name: string | null; phone: string | null; email: string | null } | null = null;
  let addresses: Address[] = [];

  if (isDbConfigured()) {
    try {
      methods = await getPublicMethods();
    } catch {
      methods = [];
    }

    if (user?.id) {
      const profile = await getProfile(user.id).catch(() => null);
      customer = {
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        email: profile?.email ?? user.email ?? null,
      };

      const { data } = await db()
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      addresses = (data ?? []) as unknown as Address[];
    }
  }

  return <CheckoutFlow methods={methods} customer={customer} addresses={addresses} />;
}
