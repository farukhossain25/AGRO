import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { sessionCookie, signSession } from "@/lib/auth";
import { ensureLinkedUser, toSessionUser } from "@/lib/profile";
import { isSupabaseAuthConfigured, shapeAuthUser, supabaseAnonServer } from "@/lib/supabase-server";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/supabase/exchange
 * ---------------------------------------------------------------------------
 * The single hand-off point between Supabase Auth and the app's session.
 *
 *   1. the browser authenticates with Supabase (password, Google, signup)
 *   2. it POSTs the Supabase access token here
 *   3. we verify that token SERVER-SIDE against Supabase (never trust the body)
 *   4. we link/create the matching `users` row and `profiles` row
 *   5. we mint the existing httpOnly `ba_session` cookie (12h admin / 30d user)
 *   6. every existing route keeps working unchanged
 *
 * Body: { accessToken: string, remember?: boolean }
 */
const REQUIRED_ENVS = [
  "JWT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export async function POST(req: Request) {
  try {
    const missing = REQUIRED_ENVS.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error("[auth/supabase/exchange] Missing env vars:", missing.join(", "));
      return NextResponse.json(
        {
          ok: false,
          error: `সার্ভার কনফিগারেশন অসম্পূর্ণ (${missing.join(", ")}) — অ্যাডমিনকে জানান`,
          code: "MISSING_ENV",
        },
        { status: 500 }
      );
    }

    const limited = rateLimit(clientKey(req, "exchange"), 20, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    if (!isSupabaseAuthConfigured()) {
      return fail("Supabase Auth কনফিগার করা নেই — অ্যাডমিনকে জানান", 503);
    }

    const body = (await req.json().catch(() => ({}))) as { accessToken?: string; remember?: boolean };
    if (!body.accessToken) return fail("লগইন টোকেন পাওয়া যায়নি — আবার চেষ্টা করুন", 400);

    // ---- verify the token with Supabase itself (authoritative)
    const { data, error } = await supabaseAnonServer().auth.getUser(body.accessToken);
    if (error || !data.user) return fail("লগইন সেশন মেয়াদোত্তীর্ণ — আবার লগইন করুন", 401);

    const authUser = shapeAuthUser(data.user);
    if (!authUser) return fail("ব্যবহারকারী পাওয়া যায়নি", 401);
    if (!authUser.verified) {
      return fail(
        "ইমেইল এখনো যাচাই হয়নি — ইনবক্সে পাঠানো লিঙ্কে ক্লিক করুন, তারপর আবার লগইন করুন",
        403
      );
    }

    // ---- link to the app's users/profiles
    const linked = await ensureLinkedUser({
      id: authUser.id,
      email: authUser.email,
      meta: authUser.meta,
    });

    if (!linked) {
      return fail("প্রোফাইল তৈরি করা যায়নি — কিছুক্ষণ পর আবার চেষ্টা করুন", 500);
    }

    const { legacyUserId, profile } = linked;

    // ---- admin MFA gate (optional, toggled in settings.auth.require_admin_mfa)
    if (profile.role === "admin" && !authUser.mfa) {
      const required = await adminMfaRequired();
      if (required) {
        return fail("অ্যাডমিন লগইনে টু-স্টেপ যাচাই প্রয়োজন — TOTP কোড দিন", 403);
      }
    }

    // ---- mint the existing cookie
    const sessionUser = toSessionUser(profile, legacyUserId, {
      email: authUser.email,
      name: profile.full_name,
    });
    const token = await signSession(sessionUser);

    const store = await cookies();
    const isAdmin = profile.role === "admin";
    const maxAge = isAdmin
      ? ADMIN_SESSION_SECONDS
      : body.remember === false
        ? SESSION_SHORT_SECONDS
        : sessionCookie.maxAge;

    const options = { ...sessionCookie.options, maxAge };
    store.set(sessionCookie.name, token, options);
    if (isAdmin) store.set(sessionCookie.adminName, token, options);

    // ---- mirror last-seen + audit
    await Promise.allSettled([
      db().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", authUser.id),
      db()
        .from("audit_logs")
        .insert({
          actor_id: legacyUserId,
          action: isAdmin ? "admin.login" : "auth.login",
          entity: "profiles",
          entity_id: authUser.id,
          meta: { provider: authUser.provider, mfa: authUser.mfa },
        }),
    ]);

    return ok({
      user: {
        id: legacyUserId,
        authId: authUser.id,
        name: profile.full_name,
        email: authUser.email,
        role: profile.role,
        provider: authUser.provider,
        onboarded: profile.onboarded,
        avatar: profile.avatar_url,
      },
      redirect: isAdmin ? ADMIN_BASE : "/account",
      sessionExpiresIn: maxAge,
    });
  } catch (error) {
    console.error("[auth/supabase/exchange] Unhandled error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `লগইন এক্সচেঞ্জ এরর: ${msg}`, code: "EXCHANGE_ERROR" },
      { status: 500 }
    );
  }
}

const ADMIN_SESSION_SECONDS = 60 * 60 * 12; // 12h admin session timeout
const SESSION_SHORT_SECONDS = 60 * 60 * 24; // "remember me" unchecked

async function adminMfaRequired(): Promise<boolean> {
  try {
    const { data } = await db().from("settings").select("value").eq("key", "auth").maybeSingle();
    const value = (data?.value ?? {}) as { require_admin_mfa?: boolean };
    return Boolean(value.require_admin_mfa);
  } catch {
    return false;
  }
}
