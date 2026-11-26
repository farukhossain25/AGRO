/* ==========================================================================
   Types for the referral / wallet feature (migration 25)
   --------------------------------------------------------------------------
   Kept in their own file so `lib/types.ts` stays about the storefront
   catalogue. These describe the ledger row and the kinds of movement that can
   appear in it; the SQL check constraint is the real source of truth.
   ========================================================================== */

export type WalletKind = "referral" | "order" | "refund" | "admin" | "bonus";

export type WalletRow = {
  id: string;
  kind: WalletKind;
  /** Positive = credit, negative = debit. */
  amount: number;
  balance_after: number;
  order_no: string | null;
  note_bn: string | null;
  created_at: string;
};

export type ReferralStats = {
  code: string | null;
  invited: number;
  earned: number;
  /** Taka earned per successful invite, from the admin setting. */
  per_invite_hint: string;
};

/** Bengali label for a ledger row. Lives here (not lib/referral.ts) because
 *  the customer's wallet panel is a Client Component and referral.ts imports
 *  server-only modules. */
export function walletKindLabel(kind: WalletKind | string): string {
  switch (kind) {
    case "referral":
      return "রেফারেল বোনাস";
    case "order":
      return "অর্ডারে ব্যবহার";
    case "refund":
      return "রিফান্ড";
    case "admin":
      return "অ্যাডমিন সমন্বয়";
    case "bonus":
      return "বোনাস";
    default:
      return String(kind);
  }
}
