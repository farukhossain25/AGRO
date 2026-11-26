import { db, isDbConfigured } from "@/lib/db";
import { getReferralSettings } from "@/lib/referral";
import { WalletSettingsForm } from "@/components/admin/wallet-settings-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ওয়ালেটের সীমা ও কমিশন",
  robots: { index: false, follow: false },
};

/* ==========================================================================
   /foisal/wallet-settings — রেফারেল কমিশন ও ওয়ালেটের সীমা
   --------------------------------------------------------------------------
   WHY THIS PAGE EXISTS
     Both numbers already lived inside /foisal/settings → "রেফারেল ও ওয়ালেট",
     but that screen is a long stack of seven groups and the owner asked
     "where do I set how much of an order a customer may pay from the referral
     balance?" — so the answer was "scroll down, it is in there". These two
     knobs move money on every order and deserve their own door in the sidebar.

   WHAT IT SHOWS
     The live values plus the arithmetic consequence in taka: on a ৳১,০০০
     order, a 30% ceiling is ৳৩০০ that can come from the wallet. The owner
     thinks in taka, not in percentages.
   ========================================================================== */

export default async function WalletSettingsPage() {
  const settings = await getReferralSettings();

  /* How many people actually hold credit — the numbers above only matter if
     somebody has a balance to spend. Fails soft: an outage shows 0, never a
     broken page. */
  let holders = 0;
  let totalCredit = 0;

  if (isDbConfigured()) {
    try {
      const { data } = await db()
        .from("profiles")
        .select("wallet_balance")
        .gt("wallet_balance", 0)
        .limit(5000);
      const rows = data ?? [];
      holders = rows.length;
      totalCredit = rows.reduce((sum, r) => sum + Number(r.wallet_balance ?? 0), 0);
    } catch {
      /* the form still works */
    }
  }

  return (
    <WalletSettingsForm
      initial={{
        enabled: settings.enabled,
        commission_percent: settings.commission_percent,
        commission_base: settings.commission_base,
        credit_on: settings.credit_on,
        min_order: settings.min_order,
        wallet_max_percent: settings.wallet_max_percent,
      }}
      holders={holders}
      totalCredit={totalCredit}
    />
  );
}
