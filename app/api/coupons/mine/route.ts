import { currentUser, ok, handleError } from "@/lib/api";
import { listMyCoupons } from "@/lib/referral";

export const dynamic = "force-dynamic";

/**
 * GET /api/coupons/mine
 *
 * The coupons this account may still use — the checkout field and
 * /account/coupons both read this. A coupon disappears from the list the
 * moment this account has used it up (per_user_limit), so a customer never
 * sees a code that would fail.
 */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.id) return ok({ coupons: [], signedIn: false });
    const coupons = await listMyCoupons(user.id);
    return ok({ coupons, signedIn: true });
  } catch (error) {
    return handleError(error);
  }
}
