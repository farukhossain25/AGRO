import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Camera, Leaf, ShieldCheck, Sprout, Truck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthQuote, AuthStats } from "@/components/auth/auth-showcase";

export const metadata: Metadata = {
  title: "লগইন / সাইন আপ",
  description:
    "বিশ্বাস এগ্রো অ্যাকাউন্টে লগইন করুন — অর্ডার হিস্ট্রি, সেভ করা ঠিকানা ও প্রিমিয়াম স্ট্যাটাস এক জায়গায়। ইমেইল/পাসওয়ার্ড বা Google দিয়ে সাইন ইন করুন।",
  robots: { index: false, follow: true },
};

/**
 * /login — split screen, premium build.
 *
 *   ≥lg : brand panel (farm photo that breathes, live stats, rotating quote,
 *         trust points, floating leaves) | form card with a rotating edge
 *   <lg : single column — compact brand header + the same card
 *
 * Every animation is CSS (transform/opacity only) and stops under
 * prefers-reduced-motion; the page is fully usable with JS disabled.
 */
const heroSrc = "/images/auth/farm-hero.jpg";

const trustPoints = [
  {
    Icon: Truck,
    title: "খামার থেকে সরাসরি",
    body: "মাঝখানে কোনো হাত নেই — সকালে তোলা, সন্ধ্যায় আপনার রান্নাঘরে।",
  },
  {
    Icon: Camera,
    title: "লাইভ ক্যামেরায় যাচাই",
    body: "প্রতিটি খামারের লাইভ ফুটেজ দেখে নিশ্চিত হয়ে কিনুন।",
  },
  {
    Icon: ShieldCheck,
    title: "নিরাপদ পেমেন্ট",
    body: "bKash, Nagad বা হাতে হাতে — প্রতিটি লেনদেনের রেকর্ড থাকে।",
  },
];

/** six leaves, deterministic positions so the server and client markup match */
const leaves = [
  { left: "12%", bottom: "-6%", size: 14, dur: "17s", delay: "0s", dx: "34px", rot: "160deg", o: 0.45 },
  { left: "26%", bottom: "-14%", size: 10, dur: "21s", delay: "3.2s", dx: "-26px", rot: "-120deg", o: 0.35 },
  { left: "44%", bottom: "-8%", size: 16, dur: "19s", delay: "1.4s", dx: "18px", rot: "200deg", o: 0.3 },
  { left: "61%", bottom: "-16%", size: 12, dur: "23s", delay: "5.5s", dx: "-40px", rot: "-180deg", o: 0.4 },
  { left: "78%", bottom: "-4%", size: 15, dur: "18s", delay: "2.6s", dx: "28px", rot: "150deg", o: 0.32 },
  { left: "89%", bottom: "-12%", size: 9, dur: "24s", delay: "7.1s", dx: "-18px", rot: "-210deg", o: 0.28 },
];

export default function LoginPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-neu-bg">
      {/* ── ambience: three drifting orbs + grid + vignette ────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="auth-orb absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-neu-accent/15 blur-[120px]"
          style={{ ["--dur" as string]: "26s" }}
        />
        <div
          className="auth-orb absolute -bottom-52 right-[-10%] h-[560px] w-[560px] rounded-full bg-[#c7ceda]/50 blur-[130px]"
          style={{ ["--dur" as string]: "32s", ["--d" as string]: "-8s" }}
        />
        <div
          className="auth-orb absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-white/70 blur-[110px]"
          style={{ ["--dur" as string]: "38s", ["--d" as string]: "-16s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(48,57,67,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(48,57,67,.06) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 78%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(255,255,255,.9),transparent_60%)]" />
      </div>

      {/* Full-bleed on purpose: this page is the only thing on screen, so it
          fills the viewport instead of floating inside a bordered card. On
          phones the form gets the whole column; on ≥lg the brand panel takes
          the left half. `dvh` (not `vh`) so mobile browser chrome does not push
          the submit button below the fold. */}
      <div className="relative grid min-h-dvh w-full lg:grid-cols-[1.06fr_0.94fr]">
        <div className="auth-rise grid w-full lg:min-h-dvh">
          {/* ── brand panel (desktop) ─────────────────────────────────── */}
          <aside className="relative hidden overflow-hidden lg:block">
            <Image
              src={heroSrc}
              alt="বিশ্বাস এগ্রোর খামারে টাটকা শাকসবজি"
              fill
              priority
              sizes="(min-width: 1024px) 54vw, 100vw"
              className="auth-kenburns object-cover"
            />

            {/* dark-green wash → white type always passes AA */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#04120a] via-[#04120a]/78 to-[#04120a]/30" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(47,143,102,0.5),transparent_58%)]" />

            {/* travelling highlight across the photo */}
            <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent auth-sweep" />

            {/* floating leaves */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {leaves.map((leaf, i) => (
                <span
                  key={i}
                  className="auth-leaf absolute"
                  style={{
                    left: leaf.left,
                    bottom: leaf.bottom,
                    width: leaf.size,
                    height: leaf.size * 1.5,
                    borderRadius: "60% 0 60% 0",
                    background: "linear-gradient(140deg, rgba(134,239,172,0.65), rgba(31,122,77,0.35))",
                    boxShadow: "0 0 12px rgba(95,206,150,0.25)",
                    ["--dur" as string]: leaf.dur,
                    ["--d" as string]: leaf.delay,
                    ["--dx" as string]: leaf.dx,
                    ["--rot" as string]: leaf.rot,
                    ["--o" as string]: String(leaf.o),
                  }}
                />
              ))}
            </div>

            <div className="relative flex h-full flex-col justify-between gap-8 p-9 xl:p-11">
              <Link href="/" className="auth-rise group inline-flex items-center gap-2.5" style={{ ["--d" as string]: "40ms" }}>
                <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition-transform duration-300 group-hover:-rotate-6">
                  <Sprout className="h-5 w-5" />
                </span>
                <span className="text-[17px] font-bold tracking-tight text-white">বিশ্বাস এগ্রো</span>
              </Link>

              <div>
                <span
                  className="auth-rise inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur"
                  style={{ ["--d" as string]: "90ms" }}
                >
                  <Leaf className="h-3.5 w-3.5" /> ১০০% খাঁটি · ল্যাব টেস্টেড
                </span>

                <p
                  className="auth-rise mt-5 max-w-[20ch] text-[30px] font-bold leading-[1.32] tracking-tight text-white drop-shadow-sm xl:text-[34px]"
                  style={{ ["--d" as string]: "140ms" }}
                >
                  বিশুদ্ধতার আস্থায়,
                  <br />
                  খামার থেকে আপনার ঘরে
                </p>

                <div className="mt-6">
                  <AuthStats />
                </div>

                <ul className="mt-6 space-y-3.5">
                  {trustPoints.map(({ Icon, title, body }, i) => (
                    <li
                      key={title}
                      className="auth-rise group flex gap-3"
                      style={{ ["--d" as string]: `${600 + i * 110}ms` }}
                    >
                      <span className="auth-pulse mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/12 text-emerald-200 ring-1 ring-white/15 backdrop-blur transition-colors duration-300 group-hover:bg-white/20 group-hover:text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-[13.5px] font-semibold text-white">{title}</span>
                        <span className="mt-0.5 block max-w-[38ch] text-[12px] leading-relaxed text-white/60">
                          {body}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <AuthQuote />
                </div>
              </div>

              <p className="auth-rise flex items-center gap-2 text-[11px] text-white/45" style={{ ["--d" as string]: "980ms" }}>
                <span className="auth-pulse h-1.5 w-1.5 rounded-full bg-leaf-400" aria-hidden />
                ঢাকার সাভার থেকে সারা বাংলাদেশে · ২৪–৪৮ ঘণ্টায় ডেলিভারি
              </p>
            </div>
          </aside>

          {/* ── form panel ────────────────────────────────────────────── */}
          {/* items-start, not items-center: centring a taller-than-viewport
              form pushes its top above the fold, so a phone opened the page
              mid-card. `justify-center` still centres it horizontally. */}
          <section className="relative flex items-start justify-center bg-neu-surface/60 px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 lg:items-center lg:py-10">
            {/* soft glow behind the form, visible on mobile too */}
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(31,122,77,0.16),transparent_65%)]"
              aria-hidden
            />
            <Suspense
              fallback={<div className="h-[560px] w-full max-w-[440px] animate-pulse rounded-xl bg-neu-sunken" />}
            >
              <LoginForm />
            </Suspense>
          </section>
        </div>
      </div>
    </div>
  );
}
