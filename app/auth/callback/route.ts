import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessionCookie, signSession } from "@/lib/auth";
import { ensureLinkedUser, toSessionUser } from "@/lib/profile";
import { isSupabaseAuthConfigured, shapeAuthUser, supabaseAnonServer } from "@/lib/supabase-server";
import { ADMIN_BASE, ADMIN_LOGIN_PATH } from "@/lib/paths";
import { isStaffRole } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   GET /auth/callback — the PKCE return address for Google (and magic links)
   --------------------------------------------------------------------------
   Supabase redirects the browser here with `?code=…` after the provider
   round-trip. This route does the server-side half of the PKCE exchange and
   then mints the app's own httpOnly session cookie, so every other route keeps
   working exactly as before (they only ever read `ba_session`).

   Why a Route Handler and not a page:
     • `exchangeCodeForSession` must run with the *code verifier*, which
       @supabase/ssr keeps in the request cookies. That is a server job.
     • No JavaScript has to run before the user is signed in, so a slow phone
       or a blocked script tag still completes the login.
     • The browser never sees a token in the URL, so it cannot leak into
       history, a Referer header or a screenshot.

   Works on any hostname — https://<project>.vercel.app, a preview deployment
   or localhost — because the redirect target is derived from the request URL,
   never from a hard-coded domain. Google itself only ever redirects to
   https://<ref>.supabase.co/auth/v1/callback, so the vercel.app address does
   not need to be registered in the Google Console.

   Error handling: every failure lands back on /login with a short Bangla
   message in `?error=`, never a raw stack trace.
   ========================================================================== */

/** Short, safe-to-display reason codes. The login page maps them to Bangla. */
type FailReason =
  | "not_configured"
  | "no_code"
  | "exchange_failed"
  | "email_unverified"
  | "profile_failed"
  | "unexpected";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  /* `next` is our own page to land on afterwards. It is validated below so a
     crafted link cannot turn this into an open redirect. */
  const nextParam = url.searchParams.get("next") ?? "";
  const safeNext = safeRedirectPath(nextParam);

  /* Supabase reports provider-side problems as query params instead of a code
     (e.g. the user pressed "cancel" on Google's consent screen). */
  /* Android shell: the Supabase redirect target must be http(s), so the
     WebView comes here and then bounces to the app's custom scheme. */
  const nativeTargetRaw = url.searchParams.get("native");
  const nativeTarget = nativeTargetRaw?.startsWith("biswasagro://") ? nativeTargetRaw : "";

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return failTo(req, providerError === "access_denied" ? "no_code" : "exchange_failed");
  }

  if (!isSupabaseAuthConfigured()) return failTo(req, "not_configured");
  if (!code) return failTo(req, "no_code");

  try {
    /* ---- 1. PKCE exchange ------------------------------------------------
       @supabase/ssr's server client persists the session into response
       cookies. We only need the user object from it; the app's own cookie is
       minted in step 3, so the Supabase cookies ride along harmlessly (the
       browser client uses them for token refresh). */
    const cookieStore = await cookies();
    const { createServerClient } = await import("@supabase/ssr");

    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
          setAll: (toSet) => {
            for (const item of toSet) pendingCookies.push(item);
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.warn("[auth/callback] exchange failed:", error?.message);
      return failTo(req, "exchange_failed");
    }

    const authUser = shapeAuthUser(data.user);
    if (!authUser) return failTo(req, "exchange_failed");

    /* Google always returns a verified address, but an email/password signup
       that arrives here should still be refused until the inbox is confirmed. */
    if (!authUser.verified) return failTo(req, "email_unverified");

    /* ---- 2. link the Supabase identity to the app's users/profiles rows ---
       profile.role is the single source of truth and is NOT writable by the
       browser (migration 0008 revokes column-level UPDATE), so this value is
       trustworthy. */
    const linked = await ensureLinkedUser({
      id: authUser.id,
      email: authUser.email,
      meta: authUser.meta,
    });
    if (!linked) return failTo(req, "profile_failed");

    const { legacyUserId, profile } = linked;

    /* ---- 3. mint the app session cookie ----------------------------------
       Admins get the 12-hour admin cookie pair; everyone else gets the normal
       customer session. Mirrors /api/auth/supabase/exchange exactly, so a
       Google login and a password login produce the same session shape. */
    const sessionUser = toSessionUser(profile, legacyUserId, {
      email: authUser.email,
      name: profile.full_name,
    });

    const isStaff = isStaffRole(profile.role as UserRole);
    const token = await signSession(sessionUser);
    const maxAge = isStaff ? ADMIN_SESSION_SECONDS : sessionCookie.maxAge;
    const options = { ...sessionCookie.options, maxAge };

    const store = await cookies();
    store.set(sessionCookie.name, token, options);
    if (isStaff) store.set(sessionCookie.adminName, token, options);
    /* Any Supabase cookies captured during the exchange. */
    for (const item of pendingCookies) {
      try {
        store.set(item.name, item.value, item.options as never);
      } catch {
        /* a header already sent for another cookie — safe to skip */
      }
    }

    /* ---- 4. audit + last-seen (best effort; never block the redirect) --- */
    await Promise.allSettled([
      db().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", authUser.id),
      db().from("audit_logs").insert({
        actor_id: legacyUserId,
        action: isStaff ? "admin.login" : "auth.login",
        entity: "profiles",
        entity_id: authUser.id,
        meta: { provider: authUser.provider, via: "pkce-callback" },
      }),
    ]);

    /* ---- 5. land somewhere useful ----------------------------------------
       Staff go to the panel unless they asked for a specific page; customers
       go back to whatever they were reading. */
    const destination =
      safeNext || (profile.role === "admin" ? ADMIN_BASE : "/account");

    /* Native shell: hand off to /auth/native, which fires the deep link. The
       cookies set above are on the response, and the browser follows the
       redirect with them, but the app reads its session from the deep link
       rather than from this WebView — so the landing page is a plain notice. */
    const finalUrl = nativeTarget
      ? new URL(`/auth/native?to=${encodeURIComponent(nativeTarget)}`, url.origin)
      : new URL(destination, url.origin);

    const res = NextResponse.redirect(finalUrl);
    /* This response sets cookies — never let a CDN keep it. */
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    return res;
  } catch (error) {
    console.error("[auth/callback] unexpected:", error);
    return failTo(req, "unexpected");
  }
}

const ADMIN_SESSION_SECONDS = 60 * 60 * 12; // 12h — same as the admin login route

/**
 * Only same-origin, path-shaped values are allowed as a redirect target.
 * `//evil.com`, `https://evil.com` and `/\evil.com` are all rejected, which
 * closes the classic open-redirect via `?next=`.
 */
function safeRedirectPath(value: string): string {
  if (!value) return "";
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//") || value.startsWith("/\\")) return "";
  /* Never bounce a login straight back into another auth screen. */
  if (/^\/(login|register|auth|forbidden)/.test(value)) return "";
  return value;
}

function failTo(req: Request, reason: FailReason): NextResponse {
  const url = new URL("/login", new URL(req.url).origin);
  url.searchParams.set("error", reason);
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  /* Belt and braces: if the failure happened because a broken session cookie
     was present, clear the admin cookie so the user is not stuck in a loop. */
  res.headers.append("Set-Cookie", `${sessionCookie.adminName}=; Path=${ADMIN_LOGIN_PATH}; Max-Age=0`);
  return res;
}
