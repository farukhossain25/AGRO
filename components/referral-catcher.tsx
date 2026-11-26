"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { COUPON_COOKIE, REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referral-cookie";

/* ==========================================================================
   ReferralCatcher
   --------------------------------------------------------------------------
   The invitee arrives at a share link — `https://site/?ref=ABCD2345` — long
   before they have an account. Nothing can be written to their profile yet, so
   the code is parked in a first-party cookie for 30 days; /auth/callback (and
   /api/referral) claim it once they actually sign up.

   Kept deliberately tiny: it runs on every page, does nothing unless `ref` is
   in the URL, and never blocks rendering.
   ========================================================================== */

export function ReferralCatcher() {
  const params = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const code = params.get("ref");
    if (!code) return;

    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
    if (clean.length < 4) return;

    // 30 days, whole site, lax — the code is not a secret, but the visitor
    // should not have to click the link twice.
    document.cookie = `${REF_COOKIE}=${encodeURIComponent(clean)}; path=/; max-age=${REF_COOKIE_MAX_AGE}; samesite=lax`;

    /* The same token is ALSO parked as the coupon to pre-fill. A referral link
       belongs to a person (no coupon), an influencer link carries a discount
       coupon as well — /api/coupons/mine tells the checkout which is which. */
    document.cookie = `${COUPON_COOKIE}=${encodeURIComponent(clean)}; path=/; max-age=${REF_COOKIE_MAX_AGE}; samesite=lax`;

    // Drop `ref` from the address bar so a refresh or a shared screenshot does
    // not keep re-announcing it. route:replace keeps the history clean.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next !== `${pathname}${window.location.search}`) {
        window.history.replaceState(window.history.state, "", next);
      }
    }
  }, [params, pathname]);

  return null;
}
