import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "অ্যাডমিন লগইন",
  description: "বিশ্বাস এগ্রো অ্যাডমিন প্যানেল — অনুমোদিত অ্যাডমিনদের জন্য।",
  robots: { index: false, follow: false },
};

/**
 * /foisal/login — the admin door.
 *
 * Same components as /login (so the security behaviour can never drift apart)
 * but with the "secure admin" framing and Google disabled: a Google account
 * that happens to be an admin is fine, yet an admin who signed in with Google
 * should use /login — this page is deliberately password-only.
 */
export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#070a08] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0 auth-aurora" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-leaf-700/25 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      <div className="relative w-full max-w-[460px]">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/foisal" className="inline-flex items-center gap-2 text-[12px] text-sand-100/45 transition hover:text-sand-100">
            <ArrowLeft className="h-3.5 w-3.5" /> প্যানেল
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-500/25 bg-leaf-600/10 px-2.5 py-1 text-[10.5px] font-semibold text-leaf-200">
            <Lock className="h-3 w-3" /> এনক্রিপ্টেড সংযোগ
          </span>
        </div>

        <div className="rounded-[26px] border border-white/[0.07] bg-ink-900/80 p-5 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-7">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-600/20 text-leaf-200 ring-1 ring-leaf-500/30">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight text-white">বিশ্বাস এগ্রো · অ্যাডমিন</p>
              <p className="text-[11px] text-sand-100/45">অর্ডার, পেমেন্ট ও কনটেন্ট ম্যানেজমেন্ট</p>
            </div>
          </div>

          <Suspense fallback={<div className="h-[320px] w-full animate-pulse rounded-2xl bg-white/[0.04]" />}>
            <LoginForm admin />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-sand-100/30">
          এই পেজে সব লগইন ও ব্যর্থ চেষ্টা অডিট লগে থাকে। অনুমতি ছাড়া প্রবেশ নিষিদ্ধ।
        </p>
      </div>
    </div>
  );
}
