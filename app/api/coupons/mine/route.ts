import { cookies } from "next/headers";
import { currentUser, ok, handleError } from "@/lib/api";
import { db } from "@/lib/db";
import { listMyCoupons, listPublicCoupons } from "@/lib/referral";
import { COUPON_COOKIE } from "@/lib/referral-cookie";

export const dynamic = "force-dynamic";

/**
 * GET /api/coupons/mine
 *
 * The coupons this account may still use — the checkout field and
 * /account/coupons both read this. A coupon disappears from the list the
 * moment this account has used it up (per_user_limit), so a customer never
 * sees a code that would fail.
 *
 * `suggested` is the coupon behind the share link the visitor arrived with.
 * It is a *separate* answer from the referral: one link can hand out a
 * discount AND credit the influencer who shared it.
 */
export async function GET() {
  try {
    const user = await currentUser();
    const parked = (await cookies()).get(COUPON_COOKIE)?.value;

    let suggested: string | null = null;
    let referralCoupon: string | null = null;

    if (parked) {
      const token = decodeURIComponent(parked);
      // resolve_ref answers both questions: is this a coupon, and is this a
      // person's referral link?
      const { data } = await db().rpc("resolve_ref", {
        p_code: token,
        p_user: user?.id ?? null,
      });
      const info = (data ?? {}) as { coupon?: string | null; referrer?: string | null };
      referralCoupon = info.coupon ?? null;
      if (user?.id) suggested = info.coupon ?? null;
    }

    if (!user?.id) {
      /* A guest still deserves to see the shop's public offers: an `all` code
         has no per-account rules, and place_order accepts it without a session.
         Restricted codes stay out — listPublicCoupons() only returns `all`. */
      return ok({
        coupons: await listPublicCoupons(),
        suggested: referralCoupon,
        signedIn: false,
      });
    }

    const coupons = await listMyCoupons(user.id);
    /* Only suggest a code that is actually usable by this account — a
       suggestion that fails at checkout is worse than no suggestion. */
    const usable = coupons.some((c) => c.code === suggested);
    return ok({ coupons, suggested: usable ? suggested : referralCoupon, signedIn: true });
  } catch (error) {
    return handleError(error);
  }
}
