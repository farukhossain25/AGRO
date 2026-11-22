"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Play, Sprout, Star, Truck } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { site } from "@/lib/site";

/** Tiny inline blur-up placeholder (a 4×3 gradient JPEG, ~120 bytes). */
const BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjMiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzE4NjE0MCIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBkMzYyNSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjMiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=";

export function Hero({ categories }: { categories: { slug: string; name_bn: string; icon: string | null }[] }) {
  const { t, isBn } = useLocale();

  return (
    <section className="relative overflow-hidden">
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-leaf-radial" />
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-leaf-600/20 blur-[100px]" />
        <div className="absolute -right-20 top-40 h-80 w-80 rounded-full bg-leaf-400/10 blur-[110px]" />
      </div>

      <div className="container-x pb-10 pt-8 sm:pb-16 sm:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
          {/* copy */}
          <div className="animate-fade-up">
            <span className="eyebrow">
              <Sprout className="h-3.5 w-3.5" />
              {t("খামার থেকে সরাসরি", "Straight from the farm")}
            </span>

            <h1 className="mt-5 text-[30px] font-bold leading-[1.22] tracking-tight sm:text-[42px] lg:text-[52px]">
              {t("বিশুদ্ধতার আস্থায়,", "Trust in purity,")}
              <br />
              <span className="bg-gradient-to-r from-leaf-200 via-leaf-300 to-leaf-500 bg-clip-text text-transparent">
                {t("খামার থেকে আপনার ঘরে", "from our farm to your home")}
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[14.5px] leading-[1.85] text-sand-100/65 sm:text-[15.5px]">
              {t(
                "প্রতিদিন ভোরে বাংলাদেশের নির্বাচিত খামার থেকে তোলা তাজা শাকসবজি, ফল, দেশি ডিম, মাছ, মাংস ও দুধ — কোনো ক্ষতিকর কেমিক্যাল ছাড়াই আপনার পরিবারের টেবিলে।",
                "Farm-fresh vegetables, fruits, country eggs, fish, meat and dairy — harvested every dawn and delivered to your family's table, free of harmful chemicals."
              )}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary group">
                {t("পণ্য দেখুন", "Shop products")}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/subscription" className="btn-ghost">
                {t("মাসিক প্যাকেজ", "Monthly package")}
              </Link>
            </div>

            {/* social proof */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {["🇧🇩", "🌿", "🥬", "🐟"].map((emoji, i) => (
                    <span
                      key={i}
                      className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink-900 bg-ink-700 text-xs"
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
                <div className="text-[11.5px] leading-tight">
                  <p className="flex items-center gap-1 font-semibold text-sand-100">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ৪.৯/৫
                  </p>
                  <p className="text-sand-100/45">
                    {t("২,৪০০+ পরিবারের বিশ্বাস", "Trusted by 2,400+ families")}
                  </p>
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div className="flex items-center gap-2 text-[11.5px] leading-tight">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-leaf-600/15 text-leaf-300">
                  <Truck className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">{t("সারা দেশে ডেলিভারি", "Nationwide delivery")}</p>
                  <p className="text-sand-100/45">{t("ঢাকায় ৮ ঘণ্টা", "8 hours inside Dhaka")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* visual */}
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="relative aspect-[4/3.4] overflow-hidden rounded-[2rem] border border-white/10 shadow-soft sm:aspect-[4/3]">
              <Image
                src="/images/cat/vegetables.jpg"
                alt={t(
                  "খামার থেকে তোলা তাজা শাকসবজি",
                  "Fresh vegetables harvested from the farm"
                )}
                fill
                /* LCP element on the homepage: highest priority, and sized so a
                   360–414px phone downloads a ~420px AVIF rather than a 1080px one. */
                priority
                fetchPriority="high"
                sizes="(max-width: 640px) 92vw, (max-width: 1024px) 100vw, 50vw"
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />

              {/* floating harvest card */}
              <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center gap-3 rounded-2xl border border-white/12 bg-ink-950/75 p-3 backdrop-blur-md">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-500/25 text-leaf-200">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">
                    {t("আজ ভোর ৫টায় তোলা", "Harvested today at 5 AM")}
                  </p>
                  <p className="truncate text-[10.5px] text-sand-100/50">
                    {t("সাভার · মধুপুর · যশোর", "Savar · Madhupur · Jashore")}
                  </p>
                </div>
                <span className="ml-auto hidden shrink-0 rounded-full bg-leaf-500/20 px-2 py-1 text-[10px] font-bold text-leaf-200 sm:block">
                  100% {t("তাজা", "fresh")}
                </span>
              </div>
            </div>

            {/* floating price chip */}
            <div className="absolute -left-2 top-5 hidden animate-float rounded-2xl border border-white/12 bg-ink-850/95 px-3.5 py-2.5 shadow-soft backdrop-blur sm:block">
              <p className="text-[10px] uppercase tracking-wider text-sand-100/45">
                {t("আজকের বাজার", "Today's market")}
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-leaf-200">
                {isBn ? "৳২৫ থেকে শুরু" : "From ৳25"}
              </p>
            </div>

            <div className="absolute -right-2 bottom-20 hidden animate-float items-center gap-2 rounded-2xl border border-white/12 bg-ink-850/95 px-3 py-2 shadow-soft backdrop-blur [animation-delay:1.2s] sm:flex">
              <Play className="h-3.5 w-3.5 fill-leaf-300 text-leaf-300" />
              <span className="text-[11px] font-semibold">{t("আমাদের গল্প দেখুন", "Watch our story")}</span>
            </div>
          </div>
        </div>

        {/* category quick chips */}
        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1 sm:mt-10">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="chip shrink-0 !px-3.5 !py-2 text-[12px]"
            >
              <span aria-hidden>{c.icon}</span>
              {c.name_bn}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
