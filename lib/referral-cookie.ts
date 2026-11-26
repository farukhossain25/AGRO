/* Shared between the browser (components/referral-catcher.tsx) and the server
   (/api/referral, /auth/callback): the name of the cookie that parks a `?ref=`
   code until the visitor has an account. Kept in its own module because a
   "use client" file's exports must not be imported by a route handler. */
export const REF_COOKIE = "agro_ref";
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** The token from the last share link, kept so the checkout can pre-fill it if
 *  it turns out to be a coupon (an influencer link does both jobs). */
export const COUPON_COOKIE = "agro_ref_coupon";
