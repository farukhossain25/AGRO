"use client";

import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   components/admin/admin-security-panel.tsx — প্যানেলের পাসওয়ার্ড ও 2FA
   --------------------------------------------------------------------------
   Reuses the existing endpoints rather than adding new ones:

     POST /api/auth/password   { currentPassword, newPassword }
     POST /api/auth/mfa        { action: "enroll" | "verify" | "disable", code }

   Both already re-check the session server-side and both are rate limited.
   Nothing here decides authorisation — it only collects input.

   Deliberate detail: after a password change the admin stays signed in. Every
   other device's session is unaffected too, because the app cookie is a signed
   JWT that does not embed the password. Boot other devices by using "সব ডিভাইস
   থেকে লগআউট" — that revokes the Supabase refresh tokens.
   ========================================================================== */

type MfaEnrollment = { secret: string; uri: string; qrSvg: string };

export function AdminSecurityPanel({
  email,
  mfaEnrolled,
  hasPassword,
}: {
  email: string | null;
  mfaEnrolled: boolean;
  hasPassword: boolean;
}) {
  const { success, error: errorToast } = useToast();

  /* ------------------------------------------------------------- password */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      errorToast("পাসওয়ার্ড ছোট", "কমপক্ষে ৮ অক্ষর দিন");
      return;
    }
    if (newPassword !== confirmPassword) {
      errorToast("দুটি পাসওয়ার্ড মিলছে না", "নতুন পাসওয়ার্ড দুবার একই লিখুন");
      return;
    }

    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        errorToast("পাসওয়ার্ড বদলানো যায়নি", json?.message);
        return;
      }

      success("পাসওয়ার্ড বদলেছে", "পরবর্তী লগইনে নতুন পাসওয়ার্ড ব্যবহার করুন");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setPwBusy(false);
    }
  }

  /* ------------------------------------------------------------------ 2FA */
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [enabled, setEnabled] = useState(mfaEnrolled);

  async function startEnroll() {
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        errorToast("2FA শুরু করা যায়নি", json?.message);
        return;
      }
      setEnrollment(json.data);
      setCode("");
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setMfaBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        errorToast("কোডটি মিলছে না", json?.message);
        return;
      }
      setEnabled(true);
      setEnrollment(null);
      setCode("");
      success("2FA চালু হয়েছে", "এখন প্রতিবার লগইনে অ্যাপ থেকে ৬ সংখ্যার কোড লাগবে");
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disable", code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        errorToast("2FA বন্ধ করা যায়নি", json?.message);
        return;
      }
      setEnabled(false);
      setCode("");
      success("2FA বন্ধ হয়েছে", "শুধু পাসওয়ার্ড দিয়েই লগইন হবে");
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------- password */}
      <section className="card overflow-hidden">
        <header className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="flex items-center gap-2 text-[13.5px] font-bold">
            <KeyRound className="h-4 w-4 text-leaf-300" /> পাসওয়ার্ড বদলান
          </h2>
          <p className="mt-0.5 text-[11.5px] text-sand-100/45">
            {email ? (
              <>
                লগইন ইমেইল: <span className="font-mono text-sand-100/70">{email}</span>
              </>
            ) : (
              "এই অ্যাকাউন্টের ইমেইল পাওয়া যায়নি"
            )}
          </p>
        </header>

        {!hasPassword ? (
          <p className="px-4 py-5 text-[12px] leading-relaxed text-sand-100/50">
            এই অ্যাকাউন্টটি Google দিয়ে তৈরি — এখানে বদলানোর মতো পাসওয়ার্ড নেই। Google
            অ্যাকাউন্টের পাসওয়ার্ড accounts.google.com থেকে বদলান।
          </p>
        ) : (
          <form onSubmit={changePassword} className="grid gap-3 px-4 py-4 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="label">বর্তমান পাসওয়ার্ড</span>
              <input
                className="inp min-h-[40px]"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="label">নতুন পাসওয়ার্ড</span>
              <input
                className="inp min-h-[40px]"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="label">আবার লিখুন</span>
              <input
                className="inp min-h-[40px]"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>

            <div className="sm:col-span-3">
              <button type="submit" disabled={pwBusy} className="btn-primary btn-sm">
                {pwBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                পাসওয়ার্ড সেভ করুন
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ------------------------------------------------------------ 2FA */}
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-[13.5px] font-bold">
              <ShieldCheck className="h-4 w-4 text-leaf-300" /> টু-স্টেপ যাচাই (2FA)
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-sand-100/45">
              পাসওয়ার্ড ছাড়াও ফোনের Google Authenticator/Authy অ্যাপ থেকে ৬ সংখ্যার কোড।
            </p>
          </div>
          <span
            className={`badge shrink-0 ${
              enabled ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.06] text-sand-100/50"
            }`}
          >
            {enabled ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" /> চালু
              </>
            ) : (
              "বন্ধ"
            )}
          </span>
        </header>

        <div className="px-4 py-4">
          {enabled ? (
            <form onSubmit={disableMfa} className="flex flex-wrap items-end gap-3">
              <label className="block space-y-1">
                <span className="label">বন্ধ করতে অ্যাপের কোড</span>
                <input
                  className="inp min-h-[40px] w-32 font-mono tracking-[0.2em]"
                  inputMode="numeric"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </label>
              <button type="submit" disabled={mfaBusy} className="btn-ghost btn-sm text-red-300">
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                2FA বন্ধ করুন
              </button>
            </form>
          ) : enrollment ? (
            <form onSubmit={confirmEnroll} className="space-y-3">
              <div className="flex flex-wrap items-start gap-4">
                <div
                  className="shrink-0 rounded-xl bg-white p-2 [&>svg]:h-40 [&>svg]:w-40"
                  /* The QR is rendered server-side from the otpauth:// URI. */
                  dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[12px] leading-relaxed text-sand-100/60">
                    অ্যাপে স্ক্যান না হলে এই কোডটি হাতে যোগ করুন:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(enrollment.secret);
                      success("কপি হয়েছে");
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5 font-mono text-[11.5px] tracking-wider text-leaf-200"
                  >
                    <Copy className="h-3 w-3" /> {enrollment.secret}
                  </button>
                  <label className="block space-y-1">
                    <span className="label">অ্যাপে দেখানো ৬ সংখ্যার কোড</span>
                    <input
                      className="inp min-h-[40px] w-32 font-mono tracking-[0.2em]"
                      inputMode="numeric"
                      maxLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </label>
                </div>
              </div>
              <button type="submit" disabled={mfaBusy} className="btn-primary btn-sm">
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                চালু করুন
              </button>
            </form>
          ) : (
            <button type="button" onClick={startEnroll} disabled={mfaBusy} className="btn-primary btn-sm">
              {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              2FA চালু করুন
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
