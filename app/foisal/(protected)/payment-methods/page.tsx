import { isDbConfigured } from "@/lib/db";
import { listAllMethods } from "@/lib/payment-methods";
import type { PaymentMethodRow } from "@/lib/types";
import { PaymentMethodManager } from "@/components/admin/payment-method-manager";

export const dynamic = "force-dynamic";

export default async function AdminPaymentMethodsPage() {
  let methods: PaymentMethodRow[] = [];

  if (isDbConfigured()) {
    try {
      methods = await listAllMethods();
    } catch {
      methods = [];
    }
  }

  return (
    <PaymentMethodManager
      initial={methods}
      dbReady={isDbConfigured()}
      configured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)}
    />
  );
}
