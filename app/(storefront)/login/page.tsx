import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth-panel";

export const metadata: Metadata = {
  title: "লগইন / সাইন আপ",
  description: "বিশ্বাস এগ্রো অ্যাকাউন্টে লগইন করুন — অর্ডার হিস্ট্রি, সেভ করা ঠিকানা ও সাবস্ক্রিপশন ম্যানেজ করুন।",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className="container-x flex min-h-[75vh] items-center justify-center py-10">
      <Suspense fallback={<div className="skeleton h-[420px] w-full max-w-md rounded-3xl" />}>
        <AuthPanel />
      </Suspense>
    </div>
  );
}
