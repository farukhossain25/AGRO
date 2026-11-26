import { currentUser, ok, handleError } from "@/lib/api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/referral/share-code
 *
 * The code to put inside a shared product link. Two answers, in priority order:
 *
 *   1. the influencer's promo TOKEN — when the account has an active
 *      influencer code. Anyone who opens the link with that token becomes the
 *      influencer's referral and may use the promo code.
 *   2. the ordinary profile code (ABCD2345) — every customer has one.
 *
 * Signed out → `code: null`, and the caller shares a plain link.
 */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.id) return ok({ code: null, signedIn: false });

    const { data: promo } = await db()
      .from("coupons")
      .select("share_token")
      .eq("funder_user_id", user.id)
      .eq("audience", "influencer")
      .eq("is_active", true)
      .not("share_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (promo?.share_token) return ok({ code: promo.share_token, kind: "influencer" });

    const { data: me } = await db()
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .maybeSingle();

    return ok({ code: me?.referral_code ?? null, kind: "customer" });
  } catch (error) {
    return handleError(error);
  }
}
