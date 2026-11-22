"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   SecurityPanel — password + TOTP 2FA (section A extras)
   ========================================================================== */

type MfaStatus = {
  enrolled: boolean;
  pending: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
  enforced: boolean;
};

type EnrollData = {
  secret: string;
  uri: string;
  qrSvg: string;
  account: string;
};

export function SecurityPanel({
  isAdmin,
  mfaEnrolled,
}: {
  isAdmin: boolean;
  mfaEnrolled: boolean;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const router = useRouter();

  /* ------------------------------------------------------------- password */
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (next !== confirm) {
      setErrors({ confirm: "নতুন পাসওয়ার্ড দুইবার একই দিতে হবে" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.errors) setErrors(json.errors);
        throw new Error(json?.message ?? "পরিবর্তন ব্যর্থ");
      }
      toast.success(t("পাসওয়ার্ড পরিবর্তন হয়েছে", "Password changed"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(t("পরিবর্তন ব্যর্থ", "Change failed"), (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------ 2FA */
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/mfa", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setStatus(json.data as MfaStatus);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadStatus();
  }, [isAdmin, loadStatus]);

  async function startEnroll() {
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "সেটআপ শুরু করা যায়নি");
      setEnroll(json.data as EnrollData);
    } catch (err) {
      toast.error(t("২FA সেটআপ ব্যর্থ", "2FA setup failed"), (err as Error).message);
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "কোড যাচাই ব্যর্থ");
      setRecovery(json.data.recoveryCodes as string[]);
      setEnroll(null);
      setCode("");
      await loadStatus();
      toast.success(t("২FA চালু হয়েছে", "2FA enabled"));
      router.refresh();
    } catch (err) {
      toast.error(t("যাচাই ব্যর্থ", "Verification failed"), (err as Error).message);
    } finally {
      setMfaBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "বন্ধ করা যায়নি");
      setCode("");
      await loadStatus();
      toast.success(t("২FA বন্ধ হয়েছে", "2FA disabled"));
      router.refresh();
    } catch (err) {
      toast.error(t("ব্যর্থ", "Failed"), (err as Error).message);
    } finally {
      setMfaBusy(false);
    }
  }

  async function signOutEverywhere() {
    try {
      await Promise.allSettled([
        fetch("/api/auth/logout", { method: "POST" }),
        (async () => {
          const { supabaseBrowser, supabaseConfigured } = await import("@/lib/supabase-browser");
          if (supabaseConfigured) await supabaseBrowser().auth.signOut({ scope: "global" });
        })(),
      ]);
      router.push("/login");
      router.refresh();
    } catch {
      toast.error(t("লগআউট ব্যর্থ", "Sign-out failed"));
    }
  }

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------- password */}
      <form onSubmit={changePassword} className="card space-y-3.5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-leaf-300" />
          <h3 className="text-[13.5px] font-semibold">{t("পাসওয়ার্ড", "Password")}</h3>
        </div>

        <label className="block">
          <span className="label">{t("বর্তমান পাসওয়ার্ড", "Current password")}</span>
          <input
            required
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input"
            autoComplete="current-password"
          />
          {errors.currentPassword ? (
            <p className="mt-1 text-[11px] text-red-300">{errors.currentPassword}</p>
          ) : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t("নতুন পাসওয়ার্ড", "New password")}</span>
            <input
              required
              type="password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="input"
              autoComplete="new-password"
            />
            {errors.newPassword ? (
              <p className="mt-1 text-[11px] text-red-300">{errors.newPassword}</p>
            ) : null}
          </label>
          <label className="block">
            <span className="label">{t("আবার লিখুন", "Confirm")}</span>
            <input
              required
              type="password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              autoComplete="new-password"
            />
            {errors.confirm ? <p className="mt-1 text-[11px] text-red-300">{errors.confirm}</p> : null}
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Spinner /> : <Save className="h-4 w-4" />}
          {t("পাসওয়ার্ড পরিবর্তন করুন", "Change password")}
        </button>
      </form>

      {/* -------------------------------------------------------------- 2FA */}
      {isAdmin ? (
        <div className="card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-leaf-300" />
              <div>
                <h3 className="text-[13.5px] font-semibold">
                  {t("টু-স্টেপ যাচাই (2FA)", "Two-factor authentication")}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-sand-100/45">
                  {t(
                    "Google Authenticator দিয়ে অ্যাডমিন অ্যাকাউন্ট সুরক্ষিত রাখুন",
                    "Protect the admin account with Google Authenticator"
                  )}
                </p>
              </div>
            </div>
            {status?.enrolled || mfaEnrolled ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-leaf-600/20 px-2 py-0.5 text-[10.5px] font-bold text-leaf-200">
                <CheckCircle2 className="h-3 w-3" /> চালু
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-sand-100/50">
                বন্ধ
              </span>
            )}
          </div>

          {status?.enforced ? (
            <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-100">
              নীতিমালা অনুযায়ী ২FA বাধ্যতামূলক — বন্ধ করা যাবে না।
            </p>
          ) : null}

          {/* enrol flow */}
          {enroll ? (
            <form onSubmit={verifyEnroll} className="mt-4 space-y-3 rounded-xl border border-white/10 p-3">
              <p className="text-[12px] text-sand-100/60">
                ১. ফোনে <strong>Google Authenticator</strong> / Authy খুলুন
                <br />
                ২. QR স্ক্যান করুন (অথবা সিক্রেট কপি করুন)
                <br />
                ৩. অ্যাপে দেখানো ৬ ডিজিটের কোড নিচে দিন
              </p>

              <div
                className="mx-auto w-[220px] overflow-hidden rounded-xl bg-white p-1"
                // QR is generated server-side from the otpauth:// URI
                dangerouslySetInnerHTML={{ __html: enroll.qrSvg }}
              />

              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-2 py-1.5 font-mono text-[11px] text-leaf-200">
                  {enroll.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(enroll.secret);
                    toast.success(t("সিক্রেট কপি হয়েছে", "Secret copied"));
                  }}
                  className="btn-ghost !px-2 !py-1.5"
                  aria-label={t("কপি করুন", "Copy")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              <label className="block">
                <span className="label">{t("৬ ডিজিটের কোড", "6-digit code")}</span>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="input text-center font-mono text-lg tracking-[0.4em]"
                  placeholder="••••••"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>

              <div className="flex gap-2">
                <button type="submit" disabled={mfaBusy} className="btn-primary flex-1">
                  {mfaBusy ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
                  {t("চালু করুন", "Enable 2FA")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnroll(null);
                    setCode("");
                  }}
                  className="btn-ghost"
                >
                  {t("বাতিল", "Cancel")}
                </button>
              </div>
            </form>
          ) : null}

          {/* recovery codes */}
          {recovery ? (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-3">
              <p className="text-[12px] font-semibold text-amber-100">
                রিকভারি কোড — নিরাপদে সংরক্ষণ করুন (শুধু একবার দেখানো হচ্ছে)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {recovery.map((c) => (
                  <code key={c} className="rounded bg-black/35 px-2 py-1 font-mono text-[11px] text-amber-100">
                    {c}
                  </code>
                ))}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(recovery.join("\n"));
                  toast.success(t("সব কোড কপি হয়েছে", "All codes copied"));
                }}
                className="btn-ghost mt-2 !px-3 !py-1.5 !text-[11.5px]"
              >
                <Copy className="mr-1 inline h-3 w-3" /> সব কপি করুন
              </button>
            </div>
          ) : null}

          {/* actions */}
          {!enroll && !status?.enrolled ? (
            <button onClick={startEnroll} disabled={mfaBusy} className="btn-primary mt-3">
              {mfaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t("২FA সেটআপ করুন", "Set up 2FA")}
            </button>
          ) : null}

          {!enroll && status?.enrolled ? (
            <form onSubmit={disable} className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block flex-1">
                <span className="label">{t("বন্ধ করতে বর্তমান কোড দিন", "Code to disable")}</span>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="input text-center font-mono tracking-[0.3em]"
                  placeholder="••••••"
                  inputMode="numeric"
                  disabled={status.enforced}
                />
              </label>
              <button
                type="submit"
                disabled={mfaBusy || status.enforced}
                className="btn-ghost !px-3 !py-2.5 !text-[12px]"
              >
                {t("২FA বন্ধ করুন", "Disable 2FA")}
              </button>
              {status.recoveryCodesLeft ? (
                <p className="w-full text-[11px] text-sand-100/40">
                  {status.recoveryCodesLeft}টি রিকভারি কোড বাকি
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {/* --------------------------------------------------------- sessions */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-red-300" />
          <h3 className="text-[13.5px] font-semibold">{t("সেশন", "Sessions")}</h3>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-sand-100/45">
          সব ডিভাইস থেকে লগআউট করলে বর্তমান ব্রাউজার ও অ্যাপেও সেশন শেষ হবে। অ্যাডমিন সেশনের মেয়াদ ১২
          ঘণ্টা।
        </p>
        <button onClick={signOutEverywhere} className="btn-ghost mt-3 !px-3 !py-2 !text-[12px]">
          {t("সব ডিভাইস থেকে লগআউট", "Sign out everywhere")}
        </button>
      </div>
    </div>
  );
}
