import { db, isDbConfigured } from "@/lib/db";
import { WalletManager } from "@/components/admin/wallet-manager";

export const dynamic = "force-dynamic";

/* /foisal/wallet — ওয়ালেট ও রেফারেল
   --------------------------------------------------------------------------
   Every account's store credit in one place, sorted by balance so the people
   who actually hold money are at the top. A manual credit/debit is the only
   write: it goes through wallet_apply(), which owns the ledger.
   ------------------------------------------------------------------------ */
export default async function AdminWalletPage() {
  let rows: Record<string, unknown>[] = [];

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("profiles")
        .select("id, full_name, phone, email, wallet_balance, wallet_earned, wallet_spent, referral_code")
        .order("wallet_balance", { ascending: false })
        .limit(200);
      rows = data ?? [];
    } catch {
      rows = [];
    }
  }

  return <WalletManager initial={rows as never} />;
}
