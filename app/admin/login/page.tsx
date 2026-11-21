"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/icon-logo";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   /admin/login — Gmail + password ONLY
   --------------------------------------------------------------------------
   Deliberately no Google button. Google sign-in on the customer surface would
   let a personal Gmail account reach the admin panel if it were ever granted
   the role by mistake; the admin door stays on a password this project owns
   (+ optional TOTP as a second factor).
   ========================================================================== */

function AdminLoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = params.get("next") || "/admin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(totp ? { "x-totp-code": totp } : {}),
        },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        // 401 with mfa_required → the password was right, ask for the 6-digit code
        if (res.status === 401 && json?.errors?.mfa_required) {
          setNeedsTotp(true);
          throw new Error("Google Authenticator অ্যাপে দেখানো ৬ ডিজিটের কোড দিন");
        }
        throw new Error(json.message ?? "লগইন ব্যর্থ");
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo size={44} href={null} />
        </div>

        <div className="card p-6">
          <div className="text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <h1 className="mt-3 text-lg font-bold">অ্যাডমিন প্যানেল</h1>
            <p className="mt-1 text-[12px] text-sand-100/45">শুধুমাত্র অনুমোদিত কর্মীদের জন্য</p>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <label className="block">
              <span className="label">জিমেইল (Gmail)</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input !pl-10"
                  placeholder="admin@gmail.com"
                  autoComplete="username"
                  autoFocus
                  disabled={needsTotp}
                />
              </div>
            </label>

            <label className="block">
              <span className="label">পাসওয়ার্ড</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input !pl-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={needsTotp}
                />
              </div>
            </label>

            {needsTotp ? (
              <label className="block">
                <span className="label">টু-স্টেপ কোড (TOTP)</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/30" />
                  <input
                    required
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input !pl-10 text-center font-mono text-lg tracking-[0.4em]"
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <p className="mt-1 text-[11px] text-sand-100/40">
                  Google Authenticator / Authy অ্যাপে দেখানো কোড
                </p>
              </label>
            ) : null}

            {error ? (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-200">{error}</p>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
              {needsTotp ? "কোড যাচাই করুন" : "লগইন করুন"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            <Link
              href="/admin/forgot-password"
              className="block text-center text-[11.5px] text-sand-100/45 hover:text-leaf-200"
            >
              পাসওয়ার্ড ভুলে গেছেন?
            </Link>

            <p className="rounded-xl bg-white/[0.03] px-3 py-2 text-[10.5px] leading-relaxed text-sand-100/40">
              প্রথমবার ব্যবহারে Vercel-এ{" "}
              <span className="font-mono text-leaf-300">SEED_SECRET</span> সেট করে একবার{" "}
              <span className="font-mono text-leaf-300">POST /api/setup/seed-admin</span> ডাকুন।
              তারপর <span className="font-mono">SEED_SECRET</span> মুছে দিন।
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-sand-100/25">
          <Link href="/" className="hover:text-sand-100/50">
            ← দোকানে ফিরে যান
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-ink-950">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}
