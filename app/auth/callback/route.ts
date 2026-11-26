import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSessionUser } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/session";
import { isSupabasePublicConfigured } from "@/lib/env";
import { REF_COOKIE } from "@/lib/referral-cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   GET /auth/callback — the PKCE return address for Google and email links
   --------------------------------------------------------------------------
   Supabase sends the browser here with `?code=…`. The code verifier lives in
   an httpOnly cookie, so the exchange MUST happen on the server. After it
   succeeds the Supabase session cookies are written by @supabase/ssr and we
   redirect to a same-site path only.

   Failures never show a stack trace: they land on /login with
   `error=callback_failed` and a short encoded reason.
   ========================================================================== */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/");

  const fail = (reason: string, status = 307) => {
    const target = new URL("/login", url.origin);
    target.searchParams.set("error", "callback_failed");
    target.searchParams.set("reason", reason.slice(0, 180));
    const res = NextResponse.redirect(target, status);
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    return res;
  };

  // The provider (or Supabase) reported a problem instead of a code.
  const providerError = url.searchParams.get("error");
  if (providerError) {
    const description = url.searchParams.get("error_description") ?? providerError;
    console.error("[auth/callback] provider error:", description);
    return fail(providerError);
  }

  if (!isSupabasePublicConfigured) {
    console.error("[auth/callback] Supabase is not configured (missing env names)");
    return fail("not_configured");
  }

  if (!code) {
    console.error("[auth/callback] no code in the request");
    return fail("no_code");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      const message = error?.message ?? "no user returned";
      console.error("[auth/callback] exchangeCodeForSession failed:", message);
      return fail(message);
    }

    // Make sure the profile row exists (the DB trigger normally does this).
    await getSessionUser();

    /* A referral link is clicked days before signup, so the code waits in a
       cookie (see components/referral-catcher.tsx). This is the first moment
       there is a profile to attach it to. Failure is logged, never shown: the
       account exists either way and the code can still be entered by hand on
       /account/wallet. */
    try {
      const ref = (await cookies()).get(REF_COOKIE)?.value;
      if (ref) {
        const { db } = await import("@/lib/db");
        const code = decodeURIComponent(ref);
        // Influencer promo token first, then a normal profile code.
        const { data: viaToken } = await db().rpc("referrer_for_token", {
          p_code: code,
          p_user: data.user.id,
        });
        if (viaToken) {
          await db()
            .from("profiles")
            .update({ referred_by: viaToken as string, referred_at: new Date().toISOString() })
            .eq("id", data.user.id)
            .is("referred_by", null);
        } else {
          const { error: refError } = await db().rpc("apply_referral", {
            p_user: data.user.id,
            p_code: code,
          });
          if (refError) console.warn("[auth/callback] referral not applied:", refError.message);
        }
      }
    } catch (refProblem) {
      console.warn("[auth/callback] referral step skipped:", (refProblem as Error).message);
    }

    const res = NextResponse.redirect(new URL(next, url.origin), 303);
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    // The code has been claimed; leaving it would re-claim on the next login.
    res.cookies.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[auth/callback] unexpected failure:", message);
    return fail(message);
  }
}
