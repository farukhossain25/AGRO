"use client";

import { useLocale } from "@/lib/locale";
import { SectionHeader } from "@/components/ui";

type Item = { icon: string; titleBn: string; titleEn: string; bodyBn: string; bodyEn: string };

export function WhyChooseUs({ items }: { items: Item[] }) {
  const { t } = useLocale();

  return (
    <section className="section container-x" aria-labelledby="why-heading">
      <SectionHeader
        eyebrow="কেন বিশ্বাস এগ্রো"
        align="center"
        title={<span id="why-heading">পাঁচটি কারণ, যেগুলো আমাদের আলাদা করে</span>}
        subtitle="আমরা শুধু পণ্য বিক্রি করি না — প্রতিটি খাবারের পেছনের কৃষক, মাঠ ও প্রক্রিয়ার দায়িত্ব নিই।"
      />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <article
            key={item.titleBn}
            className={`card card-hover p-5 sm:p-6 ${
              i === 0 ? "sm:col-span-2 lg:col-span-1" : ""
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-600/15 text-xl" aria-hidden>
              {item.icon}
            </span>
            <h3 className="mt-4 text-[15.5px] font-semibold">{t(item.titleBn, item.titleEn)}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-sand-100/55">
              {t(item.bodyBn, item.bodyEn)}
            </p>
          </article>
        ))}

        <article className="card flex flex-col justify-between gap-4 border-neu-accent/25 bg-gradient-to-br from-neu-accent-soft to-neu-raised p-5 sm:p-6">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-500/25 text-xl" aria-hidden>
              🌾
            </span>
            <h3 className="mt-4 text-[15.5px] font-semibold">
              {t("২৩০+ কৃষক পরিবার", "230+ farm families")}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-sand-100/60">
              {t(
                "প্রতিটি অর্ডারের একটি অংশ সরাসরি কৃষকের পরিবারে পৌঁছায়।",
                "A share of every order goes straight back to the grower's family."
              )}
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-leaf-200">২৩০+</span>
            <span className="text-[11.5px] text-sand-100/45">
              {t("খামার পরিবার", "farm families")}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
