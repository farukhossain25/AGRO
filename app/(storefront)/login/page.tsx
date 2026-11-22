import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth-panel";

export const metadata: Metadata = {
  title: "লগইন / সাইন আপ | বিশ্বাস এগ্রো",
  description: "বিশ্বাস এগ্রো অ্যাকাউন্টে লগইন করুন — অর্ডার হিস্ট্রি, সেভ করা ঠিকানা ও সাবস্ক্রিপশন ম্যানেজ করুন। Google, ইমেইল বা OTP যেকোনোটা দিয়ে সাইন ইন করুন।",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-[#090c0a]">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-leaf-900/30 via-ink-900 to-[#050806]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-24 -left-24 h-[380px] w-[380px] rounded-full bg-leaf-600/20 blur-[90px]" />
        <div className="absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full bg-emerald-700/15 blur-[100px]" />
      </div>

      <div className="container-x relative flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="h-[620px] w-full max-w-[1080px] animate-pulse rounded-[28px] bg-white/5" />
          }
        >
          <AuthPanel />
        </Suspense>
      </div>
    </div>
  );
}
