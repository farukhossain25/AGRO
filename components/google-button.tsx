"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { oauthRedirectTo, supabaseBrowser, supabaseConfigured } from "@/lib/supabase-browser";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   Continue with Google
   --------------------------------------------------------------------------
   Renders nothing when Supabase Auth isn't configured, so a half-set-up
   deployment never shows a button that can only fail.
   ========================================================================== */

export function GoogleButton({
  next = "/account",
  label,
  disabled = false,
}: {
  next?: string;
  label?: string;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!supabaseConfigured) return null;

  async function signIn() {
    setLoading(true);
    try {
      const client = supabaseBrowser();
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectTo(next),
          // Always let the user pick the account — prevents silently reusing
          // a shared-device Google session.
          queryParams: { prompt: "select_account", access_type: "offline" },
        },
      });
      if (error) throw error;
      // Success = the browser is navigating to Google. Keep the spinner on.
    } catch (err) {
      setLoading(false);
      toast.error(
        t("Google লগইন শুরু করা যায়নি", "Could not start Google sign-in"),
        (err as Error).message
      );
    }
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
          />
        </svg>
      )}
      {label ?? t("Google দিয়ে চালিয়ে যান", "Continue with Google")}
    </button>
  );
}

/** "অথবা" divider used above/below the Google button. */
export function OrDivider() {
  const { t } = useLocale();
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-sand-100/35">
        {t("অথবা", "or")}
      </span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
