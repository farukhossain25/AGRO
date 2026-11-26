import { currentUser, handleError, ok } from "@/lib/api";
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
    /* Signed out is a normal state on the checkout page, not an error: answer
       with a zero wallet so the summary can simply hide the block. */
    if (!user?.id) {
      return ok({ balance: 0, earned: 0, spent: 0, max_percent: 30, ledger: [], signedIn: false });
    }

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
      signedIn: true,
    });
  } catch (error) {
    return handleError(error);
  }
}
