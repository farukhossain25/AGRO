import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSessionUser } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/session";
import { isSupabasePublicConfigured } from "@/lib/env";

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

    const res = NextResponse.redirect(new URL(next, url.origin), 303);
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error("[auth/callback] unexpected failure:", message);
    return fail(message);
  }
}
