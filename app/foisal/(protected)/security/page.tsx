import { cookies } from "next/headers";
import { db, isDbConfigured } from "@/lib/db";
import { verifySession, sessionCookie } from "@/lib/auth";
import { supabaseService, isSupabaseAuthConfigured } from "@/lib/supabase-server";
import { AdminSecurityPanel } from "@/components/admin/admin-security-panel";

export const dynamic = "force-dynamic";

/* ==========================================================================
   /foisal/security — the admin's own password + 2FA
   --------------------------------------------------------------------------
   The brief asks for a change-password page and optional TOTP on the admin
   side. The customer version (/account/security) already exists, but an admin
   should not have to leave the panel — and, more importantly, the admin
   password is the single credential that opens every order, every payout and
   the payment-verification queue.

   Both fields are read from the Supabase user record:
     • `mfaEnrolled` — a verified TOTP factor exists
     • `provider`    — an account created with Google has no password to change
   ========================================================================== */
export default async function AdminSecurityPage() {
  const store = await cookies();
  const token = store.get(sessionCookie.adminName)?.value ?? store.get(sessionCookie.name)?.value;
  const session = await verifySession(token);

  let mfaEnrolled = false;
  let hasPassword = true;
  let email: string | null = null;

  if (isSupabaseAuthConfigured() && session) {
    try {
      /* The profile row holds the Supabase auth id (profiles.id); the app's own
         user id lives in legacy_user_id. Look up the auth side directly. */
      const { data: profile } = await db()
        .from("profiles")
        .select("id, mfa_enrolled")
        .eq("legacy_user_id", session.id)
        .maybeSingle();

      const authId = (profile?.id as string | undefined) ?? session.id;

      /* auth.admin is a SERVICE-ROLE endpoint: the anon client cannot list or
         read another user's record. This is a server component, so the key
         never reaches the browser. */
      const { data } = await supabaseService().auth.admin.getUserById(authId);

      const user = data?.user;
      if (user) {
        email = user.email ?? null;
        mfaEnrolled = Boolean(
          user.factors?.some((f) => f.status === "verified" && f.factor_type === "totp")
        );
        if (profile?.mfa_enrolled) mfaEnrolled = true;
        /* Google-only accounts have no password identity to change; showing the
           form would just produce a confusing error from Supabase. */
        const providers = (user.app_metadata?.providers as string[] | undefined) ?? [
          (user.app_metadata?.provider as string | undefined) ?? "email",
        ];
        hasPassword = providers.includes("email");
      }
    } catch {
      /* A failed lookup must not block the page — show the form and let the
         API produce the real error message. */
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[20px] font-bold sm:text-2xl">নিরাপত্তা</h1>
        <p className="mt-1 text-[12.5px] text-sand-100/50">
          প্যানেলের পাসওয়ার্ড বদলান ও টু-স্টেপ যাচাই (2FA) চালু করুন।
        </p>
      </header>

      {!isDbConfigured() ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-[12px] text-red-200/80">
          ডেটাবেজে সংযোগ হচ্ছে না — এখন পরিবর্তন করলে কাজ হবে না।
        </div>
      ) : null}

      <AdminSecurityPanel
        email={email}
        mfaEnrolled={mfaEnrolled}
        hasPassword={hasPassword}
      />
    </div>
  );
}
