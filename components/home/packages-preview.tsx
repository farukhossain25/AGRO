"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { money } from "@/lib/format";
import { SectionHeader, ViewAll } from "@/components/ui";
import type { Package } from "@/lib/types";

export function PackagesPreview({ packages }: { packages: Package[] }) {
  const { t, isBn } = useLocale();
  if (!packages.length) return null;

  return (
    <section className="section container-x" aria-labelledby="pkg-heading">
      <SectionHeader
        eyebrow="মাসিক ফুড সাবস্ক্রিপশন"
        title={<span id="pkg-heading">পরিবারের আকার অনুযায়ী ফ্যামিলি প্যাকেজ</span>}
        subtitle="মাসে একবার পেমেন্ট, পুরো মাস তাজা খাবার। যেকোনো সময় পজ বা বাতিল করুন — কোনো লুকানো চার্জ নেই।"
        action={<ViewAll href="/subscription" label="বিস্তারিত" />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((pkg) => (
          <article
            key={pkg.id}
            className={`card relative flex flex-col p-6 ${
              pkg.is_popular
                ? "border-leaf-500/50 bg-gradient-to-b from-leaf-800/35 to-ink-850 shadow-glow"
                : ""
            }`}
          >
            {pkg.is_popular ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-leaf-400 px-3 py-1 text-[10.5px] font-bold text-ink-900">
                <Sparkles className="mr-1 inline h-3 w-3" />
                {t("সবচেয়ে জনপ্রিয়", "Most popular")}
              </span>
            ) : null}

            <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-leaf-300/80">
              {t(pkg.members_label, `${pkg.members_min}–${pkg.members_max} members`)}
            </p>
            <h3 className="mt-2 text-xl font-bold">{t(pkg.name_bn, pkg.name_en ?? pkg.name_bn)}</h3>

            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-leaf-200">{money(pkg.price_monthly, isBn)}</span>
              <span className="text-[12px] text-sand-100/45">/ {t("মাস", "month")}</span>
            </p>
            {pkg.saving_label ? (
              <p className="mt-1 text-[11.5px] font-medium text-amber-300/90">{pkg.saving_label}</p>
            ) : null}

            <ul className="mt-5 flex-1 space-y-2.5">
              {pkg.features.map((f) => (
                <li key={f} className="flex gap-2 text-[12.5px] leading-relaxed text-sand-100/65">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-400" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={`/subscription?package=${pkg.slug}`}
              className={`mt-6 w-full ${pkg.is_popular ? "btn-mint" : "btn-ghost"}`}
            >
              {t("সাবস্ক্রাইব করুন", "Subscribe now")}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
