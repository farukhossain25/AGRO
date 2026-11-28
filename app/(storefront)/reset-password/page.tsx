import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Sprout } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "নতুন পাসওয়ার্ড",
  robots: { index: false, follow: false },
};

/** /reset-password — same brand shell as /login, one job: set a new password. */
export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-[calc(100dvh-64px)] items-center justify-center overflow-hidden bg-neu-bg px-4 py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="auth-orb absolute -left-20 -top-24 h-[380px] w-[380px] rounded-full bg-leaf-700/25 blur-[110px]"
          style={{ ["--dur" as string]: "28s" }}
        />
        <div
          className="auth-orb absolute -bottom-32 right-0 h-[400px] w-[400px] rounded-full bg-emerald-600/15 blur-[120px]"
          style={{ ["--dur" as string]: "34s", ["--d" as string]: "-9s" }}
        />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="auth-rise mb-4 flex items-center justify-center gap-2.5" style={{ ["--d" as string]: "30ms" }}>
          <span className="auth-pulse grid h-10 w-10 place-items-center rounded-2xl bg-leaf-600/20 text-leaf-700 ring-1 ring-leaf-500/30">
            <Sprout className="h-5 w-5" />
          </span>
          <span className="text-[16px] font-bold tracking-tight text-neu-ink">বিশ্বাস এগ্রো</span>
        </Link>

        <div
          className="auth-rise auth-frame rounded-2xl border border-white/[0.07] bg-ink-900/85 p-6 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-8"
          style={{ ["--d" as string]: "90ms" }}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-600/15 text-leaf-700 ring-1 ring-leaf-500/25">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-3 text-[20px] font-bold text-neu-ink">নতুন পাসওয়ার্ড দিন</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/50">
            কমপক্ষে ৮ অক্ষরের একটি পাসওয়ার্ড দিন। এই পাসওয়ার্ড দিয়েই পরেরবার লগইন করবেন।
          </p>
          <div className="mt-5">
            <ResetPasswordForm />
          </div>
        </div>

        <p className="auth-rise mt-4 text-center text-[11px] text-sand-100/30" style={{ ["--d" as string]: "200ms" }}>
          লিঙ্কটির মেয়াদ শেষ?{" "}
          <Link href="/login" className="font-semibold text-leaf-300 hover:underline">
            আবার রিসেট লিঙ্ক নিন
          </Link>
        </p>
      </div>
    </div>
  );
}
