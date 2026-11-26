import type { Metadata } from "next";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import {
  getReferralSettings,
  getWalletLedger,
  getWalletSummary,
} from "@/lib/referral";
import { WalletPanel } from "@/components/account/wallet-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ওয়ালেট ও রেফারেল",
  robots: { index: false, follow: false, nocache: true },
};

/* /account/wallet
   --------------------------------------------------------------------------
   The page `credit_referral()`'s notification links to. Without it the "you
   earned ৳45" message opened a 404, which is worse than not sending it.

   Read-only on the server: balance, ledger and the referral settings that make
   the copy truthful. The code claim posts to /api/referral.
   ------------------------------------------------------------------------ */
export default async function AccountWalletPage() {
  const user = await currentUser();
  if (!user) return null;

  const [summary, ledger, settings] = await Promise.all([
    getWalletSummary(user.id),
    getWalletLedger(user.id, 30),
    getReferralSettings(),
  ]);

  let code: string | null = null;
  let referredBy: string | null = null;
  let invited = 0;

  try {
    const { data } = await db()
      .from("profiles")
      .select("referral_code, referred_by")
      .eq("id", user.id)
      .maybeSingle();
    code = data?.referral_code ?? null;
    referredBy = data?.referred_by ?? null;

    const { count } = await db()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id);
    invited = count ?? 0;
  } catch {
    /* a DB blip must not blank the balance the customer opened the page for */
  }

  return (
    <WalletPanel
      code={code}
      balance={summary.balance}
      earned={summary.earned}
      spent={summary.spent}
      maxPercent={summary.max_percent}
      invited={invited}
      commissionPercent={settings.commission_percent}
      minOrder={settings.min_order}
      enabled={settings.enabled}
      alreadyReferred={Boolean(referredBy)}
      ledger={ledger}
    />
  );
}
