import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "নতুন পাসওয়ার্ড",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-[#090c0a]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-leaf-900/25 via-ink-900 to-[#050806]" />
        <div className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full bg-leaf-600/20 blur-[90px]" />
      </div>

      <div className="container-x relative flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[26px] border border-white/[0.07] bg-ink-900/85 p-6 shadow-card backdrop-blur-xl sm:p-8">
          <h1 className="text-[20px] font-bold text-white">নতুন পাসওয়ার্ড দিন</h1>
          <p className="mt-1 text-[12.5px] text-sand-100/50">
            কমপক্ষে ৮ অক্ষরের একটি পাসওয়ার্ড দিন। এই পাসওয়ার্ড দিয়েই পরেরবার লগইন করবেন।
          </p>
          <div className="mt-5">
            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
