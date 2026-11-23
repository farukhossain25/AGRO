import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Camera, Leaf, ShieldCheck, Sprout, Truck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "লগইন / সাইন আপ",
  description:
    "বিশ্বাস এগ্রো অ্যাকাউন্টে লগইন করুন — অর্ডার হিস্ট্রি, সেভ করা ঠিকানা ও প্রিমিয়াম স্ট্যাটাস এক জায়গায়। ইমেইল/পাসওয়ার্ড বা Google দিয়ে সাইন ইন করুন।",
  robots: { index: false, follow: true },
};

/**
 * /login — split screen.
 *   ≥lg  : brand panel (farm photo + tagline + trust points) | form card
 *   <lg  : single column, compact brand header above the card
 * The photo is our own farm asset in /public (no third-party placeholders);
 * swap in a Supabase Storage URL by changing `heroSrc` once uploaded.
 */
const heroSrc = "/images/auth/farm-hero.jpg";

const trustPoints = [
  { Icon: Truck, title: "খামার থেকে সরাসরি", body: "মাঝখানে কোনো হাত নেই — সকালে তোলা, সন্ধ্যায় আপনার রান্নাঘরে।" },
  { Icon: Camera, title: "লাইভ ক্যামেরায় যাচাই", body: "প্রতিটি খামারের লাইভ ফুটেজ দেখে নিশ্চিত হয়ে কিনুন।" },
  { Icon: ShieldCheck, title: "নিরাপদ পেমেন্ট", body: "bKash, Nagad বা হাতে হাতে — প্রতিটি লেনদেনের রেকর্ড থাকে।" },
];

export default function LoginPage() {
  return (
    <div className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-[#080b09]">
      {/* animated brand gradient (CSS only, disabled under reduced motion) */}
      <div className="pointer-events-none absolute inset-0 auth-aurora" aria-hidden>
        <div className="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-leaf-700/25 blur-[110px]" />
        <div className="absolute -bottom-40 right-0 h-[460px] w-[460px] rounded-full bg-emerald-600/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-7xl items-stretch justify-center px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-10">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/[0.07] bg-ink-900/70 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
          {/* ── brand panel (desktop) ─────────────────────────────────── */}
          <aside className="relative hidden overflow-hidden lg:block">
            <Image
              src={heroSrc}
              alt="বিশ্বাস এগ্রোর খামারে টাটকা শাকসবজি"
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
            {/* dark-green wash so white type always passes AA */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#04120a] via-[#04120a]/80 to-[#04120a]/35" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(31,122,77,0.35),transparent_55%)]" />

            <div className="relative flex h-full flex-col justify-between gap-10 p-10">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-600/25 text-leaf-100 ring-1 ring-leaf-400/30 backdrop-blur">
                  <Sprout className="h-5 w-5" />
                </span>
                <span className="text-[17px] font-bold tracking-tight text-white">বিশ্বাস এগ্রো</span>
              </Link>

              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-400/30 bg-leaf-600/20 px-3 py-1 text-[11px] font-semibold text-leaf-100 backdrop-blur">
                  <Leaf className="h-3.5 w-3.5" /> ১০০% খাঁটি · ল্যাব টেস্টেড
                </span>
                <p className="mt-5 max-w-[22ch] text-[30px] font-bold leading-[1.35] text-white drop-shadow-sm">
                  বিশুদ্ধতার আস্থায়,
                  <br />
                  খামার থেকে আপনার ঘরে
                </p>

                <ul className="mt-7 space-y-4">
                  {trustPoints.map(({ Icon, title, body }) => (
                    <li key={title} className="flex gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-leaf-200 ring-1 ring-white/10 backdrop-blur">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-[13.5px] font-semibold text-white">{title}</span>
                        <span className="mt-0.5 block max-w-[38ch] text-[12px] leading-relaxed text-sand-100/60">{body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] text-sand-100/40">
                ঢাকার সাভার থেকে সারা বাংলাদেশে · ২৪–৪৮ ঘণ্টায় ডেলিভারি
              </p>
            </div>
          </aside>

          {/* ── form panel ────────────────────────────────────────────── */}
          <section className="flex items-center justify-center p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8">
            <Suspense
              fallback={<div className="h-[560px] w-full max-w-[484px] animate-pulse rounded-3xl bg-white/[0.04]" />}
            >
              <LoginForm />
            </Suspense>
          </section>
        </div>
      </div>
    </div>
  );
}
