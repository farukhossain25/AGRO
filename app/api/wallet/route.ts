import { currentUser, fail, handleError, ok } from "@/lib/api";
import { getWalletLedger, getWalletSummary } from "@/lib/referral";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet → { balance, earned, spent, max_percent, ledger[] }
 *
 * Read-only on purpose. Money only moves through SQL (`place_order` for a
 * debit, `credit_referral` / `wallet_apply` for a credit), so there is no POST
 * here that a browser could abuse.
 */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.id) return fail("লগইন করুন", 401);

    const [summary, ledger] = await Promise.all([
      getWalletSummary(user.id),
      getWalletLedger(user.id),
    ]);

    return ok({
      balance: summary.balance,
      earned: summary.earned,
      spent: summary.spent,
      max_percent: summary.max_percent,
      ledger,
    });
  } catch (error) {
    return handleError(error);
  }
}
