import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_BASE } from "@/lib/paths";
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
 * but with the "secure admin" framing, Google disabled, and a quieter version
 * of the same motion system: two drifting orbs, a rotating card edge and a
 * staggered entrance. No farm photo, no testimonial — an operator screen.
 */
export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#070a08] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="auth-orb absolute left-1/2 top-[-18%] h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-leaf-700/25 blur-[130px]"
          style={{ ["--dur" as string]: "30s" }}
        />
        <div
          className="auth-orb absolute bottom-[-22%] right-[-8%] h-[420px] w-[420px] rounded-full bg-emerald-600/15 blur-[120px]"
          style={{ ["--dur" as string]: "36s", ["--d" as string]: "-11s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 25%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 25%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-[462px]">
        <div className="auth-rise mb-4 flex items-center justify-between" style={{ ["--d" as string]: "40ms" }}>
          <Link
            href={ADMIN_BASE}
            className="group inline-flex items-center gap-2 text-[12px] text-sand-100/45 transition hover:text-sand-100"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" /> প্যানেল
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-500/25 bg-leaf-600/10 px-2.5 py-1 text-[10.5px] font-semibold text-leaf-200">
            <Lock className="h-3 w-3" /> এনক্রিপ্টেড সংযোগ
          </span>
        </div>

        <div
          className="auth-rise auth-frame rounded-[26px] border border-white/[0.07] bg-ink-900/80 p-5 shadow-[0_50px_120px_-55px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-7"
          style={{ ["--d" as string]: "80ms" }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="auth-pulse grid h-11 w-11 place-items-center rounded-2xl bg-leaf-600/20 text-leaf-200 ring-1 ring-leaf-500/30">
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

        <p className="auth-rise mt-4 text-center text-[11px] leading-relaxed text-sand-100/30" style={{ ["--d" as string]: "260ms" }}>
          এই পেজে সব লগইন ও ব্যর্থ চেষ্টা অডিট লগে থাকে। অনুমতি ছাড়া প্রবেশ নিষিদ্ধ।
        </p>
      </div>
    </div>
  );
}
