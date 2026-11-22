import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { sessionCookie, signSession } from "@/lib/auth";
import { toSessionUser, type Profile } from "@/lib/profile";
import { authErrorBn, clientIp, isLockedOut, recordAttempt } from "@/lib/auth-attempts";
import { isSupabaseAuthConfigured, shapeAuthUser } from "@/lib/supabase-server";
import { verifyTotp } from "@/lib/totp";
import { isStaffRole } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
  password: z.string().min(1, "পাসওয়ার্ড দিন").max(200),
});

const ADMIN_SESSION_SECONDS = 60 * 60 * 12; // 12-hour admin session timeout

/**
 * POST /api/foisal/auth/login  —  admin-only, Gmail + password
 * ---------------------------------------------------------------------------
 * Order of checks (each one can only *reduce* access):
 *   1. in-memory rate limit  (fast, per instance)
 *   2. durable lockout       (login_attempts table — across instances)
 *   3. Supabase password grant
 *   4. profiles.role === 'admin'  ← the single source of truth
 *   5. optional TOTP second factor (x-totp-code header)
 *   6. mint a 12-hour admin cookie
 */
export async function POST(req: Request) {
  const ip = clientIp(req);

  try {
    const limited = rateLimit(clientKey(req, "admin-login"), 5, 15 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { email, password } = schema.parse(await req.json());

    if (await isLockedOut(email, "admin-login")) {
      return fail("অনেকবার ভুল চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।", 429);
    }

    if (!isSupabaseAuthConfigured()) {
      return fail(
        "অ্যাডমিন লগইন এখনো কনফিগার করা হয়নি — NEXT_PUBLIC_SUPABASE_URL ও NEXT_PUBLIC_SUPABASE_ANON_KEY সেট করুন।",
        503
      );
    }

    /* ---- 1. credential check -------------------------------------------
       The @supabase/ssr server client persists the session into cookies, which
       middleware.ts needs: the admin gate validates the Supabase session and
       the current profiles.role on every request. The app's own ba_admin JWT
       is still minted below for the layout and API routes. */
    const cookieStore = await cookies();
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];
    const { createServerClient } = await import("@supabase/ssr");
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

    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signIn?.user) {
      await recordAttempt({ identifier: email, scope: "admin-login", ok: false, ip });
      const remaining = await remainingHint(email);
      return fail(authErrorBn(signInError?.message, signInError?.status), 401, remaining);
    }

    const authUser = shapeAuthUser(signIn.user);

    // ---- 2. role gate (RLS-equivalent check on the server)
    const { data: profileRow, error: profileError } = await db()
      .from("profiles")
      .select("id, role, full_name, phone, avatar_url, language, legacy_user_id, onboarded")
      .eq("id", signIn.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    // staff / manager / admin all sign in here; the scoped permission checks
    // inside each route decide what they may actually do (section F)
    if (!profileRow || !isStaffRole(profileRow.role as UserRole)) {
      await recordAttempt({ identifier: email, scope: "admin-login", ok: false, ip });
      return fail("প্রবেশাধিকার নেই (Access denied) — এই অ্যাকাউন্টের টিম অনুমতি নেই", 403);
    }

    const legacyUserId = profileRow.legacy_user_id;

    // ---- 3. TOTP second factor
    if (await adminMfaRequired()) {
      const { data: mfa } = await db()
        .from("admin_mfa")
        .select("secret, enabled")
        .eq("user_id", legacyUserId)
        .maybeSingle();

      if (mfa?.enabled) {
        const code = req.headers.get("x-totp-code")?.trim() ?? "";
        if (!code) {
          return fail("টু-স্টেপ যাচাই প্রয়োজন — Google Authenticator কোড দিন", 401, {
            mfa_required: "1",
          });
        }
        if (!verifyTotp(mfa.secret, code)) {
          await recordAttempt({ identifier: email, scope: "mfa", ok: false, ip });
          return fail("টু-স্টেপ কোড সঠিক নয়", 401, { mfa_required: "1" });
        }
      }
    }

    await recordAttempt({ identifier: email, scope: "admin-login", ok: true, ip });

    // ---- 4. cookie
    const profile: Profile = {
      id: profileRow.id,
      legacy_user_id: legacyUserId,
      full_name: profileRow.full_name,
      phone: profileRow.phone,
      avatar_url: profileRow.avatar_url,
      bio: null,
      role: profileRow.role as UserRole,
      language: (profileRow.language as "bn" | "en") ?? "bn",
      theme: "dark",
      notifications: { email: true, push: true, sms: false },
      onboarded: Boolean(profileRow.onboarded),
      mfa_enrolled: false,
      last_seen_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const token = await signSession(
      toSessionUser(profile, legacyUserId ?? profileRow.id, { email: authUser?.email ?? email })
    );

    const store = await cookies();
    const options = { ...sessionCookie.options, maxAge: ADMIN_SESSION_SECONDS };
    store.set(sessionCookie.adminName, token, options);
    store.set(sessionCookie.name, token, options);
    /* The Supabase session cookies captured during sign-in. middleware.ts
       validates this session (and the fresh profiles.role) on every admin
       request, so it must be present or the admin is bounced to /login. */
    for (const item of pendingCookies) {
      try {
        store.set(item.name, item.value, item.options as never);
      } catch {
        /* a header already sent for another cookie — safe to skip */
      }
    }

    await Promise.allSettled([
      db()
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", signIn.user.id),

      /* Section D: tell the team + this account about every new admin sign-in.
         An unexpected login is the earliest signal of a compromised password,
         and it costs nothing to raise. The device/IP go in the body so the
         owner can judge it at a glance. */
      (async () => {
        const ua = (req.headers.get("user-agent") ?? "unknown device").slice(0, 120);
        const body = `${profileRow.full_name ?? email} · ${ip} · ${ua}`;
        const { notify, notifyAdmins } = await import("@/lib/notify");
        await Promise.allSettled([
          notify({
            userId: legacyUserId,
            kind: "system",
            title: "নতুন অ্যাডমিন লগইন",
            body,
            link: `${ADMIN_BASE}/audit`,
          }),
          notifyAdmins({
            kind: "system",
            title: `অ্যাডমিন লগইন — ${profileRow.full_name ?? email}`,
            body,
            link: `${ADMIN_BASE}/audit`,
          }),
        ]);
      })(),
      db().from("audit_logs").insert({
        actor_id: legacyUserId,
        action: "admin.login",
        entity: "profiles",
        entity_id: signIn.user.id,
        meta: { via: "supabase-password", ip },
      }),
    ]);

    return ok({
      id: legacyUserId,
      name: profileRow.full_name,
      email,
      sessionExpiresIn: ADMIN_SESSION_SECONDS,
    });
  } catch (error) {
    return handleError(error);
  }
}

async function adminMfaRequired(): Promise<boolean> {
  try {
    const { data } = await db().from("settings").select("value").eq("key", "auth").maybeSingle();
    return Boolean((data?.value as { require_admin_mfa?: boolean } | null)?.require_admin_mfa);
  } catch {
    return false;
  }
}

/** Friendly "আর ২ বার চেষ্টা বাকি" hint without leaking account existence. */
async function remainingHint(email: string): Promise<Record<string, string> | undefined> {
  try {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await db()
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", email)
      .eq("scope", "admin-login")
      .eq("ok", false)
      .gte("created_at", since);

    const left = Math.max(0, 5 - (count ?? 0));
    return left <= 2 ? { hint: `আর ${left} বার চেষ্টা করা যাবে` } : undefined;
  } catch {
    return undefined;
  }
}
