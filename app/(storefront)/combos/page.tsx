import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Clock, Package, Truck } from "lucide-react";
import { getCombos } from "@/lib/data";
import { money } from "@/lib/format";
import { ComboAddButton } from "@/components/shop/combo-add-button";
import { alternatesFor } from "@/lib/seo";

export const revalidate = 180;

export const metadata: Metadata = {
  title: "ডেইলি ও উইকলি সবজি কম্বো",
  description:
    "রেডিমেড ডেইলি ও উইকলি সবজি কম্বো বক্স — বাজার দরের চেয়ে ২০% সাশ্রয়। কী কিনবেন ভাবতে হবে না, আমরা বেছে দিই।",
  alternates: alternatesFor("/combos"),
  openGraph: { title: "সবজি কম্বো বক্স | বিশ্বাস এগ্রো", url: "/combos" },
};

const perks = [
  { Icon: Clock, t: "সকাল ১০টার আগে অর্ডারে আজই ডেলিভারি", d: "ঢাকা সিটির ভেতরে" },
  { Icon: Truck, t: "সব বক্সে ফ্রি ডেলিভারি", d: "কম্বো কেনার ক্ষেত্রে প্রযোজ্য" },
  { Icon: Package, t: "পরিবর্তন করা যায়", d: "কোনো সবজি পছন্দ না হলে জানান" },
];

export default async function CombosPage() {
  const combos = await getCombos();
  const daily = combos.filter((c) => c.kind === "daily");
  const weekly = combos.filter((c) => c.kind === "weekly");

  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/80">কম্বো বক্স</span>
      </nav>

      <header className="max-w-3xl">
        <span className="eyebrow mb-3">রেডিমেড বক্স</span>
        <h1 className="text-[28px] font-bold sm:text-4xl">ডেইলি ও উইকলি সবজি কম্বো</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-sand-100/60">
          প্রতিদিন কোন সবজি কিনবেন, কতটুকু লাগবে — এই ভাবনা আমাদের উপর ছেড়ে দিন। আমাদের
          কিউরেটর টিম প্রতিদিন সকালে মৌসুমের সেরা সবজি বেছে বক্স তৈরি করে। বাজার দরের চেয়ে
          গড়ে ২০% কম দামে।
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {perks.map(({ Icon, t, d }) => (
          <div key={t} className="card flex items-start gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold">{t}</p>
              <p className="text-[11px] text-sand-100/45">{d}</p>
            </div>
          </div>
        ))}
      </div>

      {[
        { title: "ডেইলি কম্বো", subtitle: "প্রতিদিনের একবেলার রান্নার জন্য", list: daily },
        { title: "উইকলি কম্বো", subtitle: "সপ্তাহের বাজার একবারে", list: weekly },
      ].map((group) =>
        group.list.length ? (
          <section key={group.title} className="mt-12">
            <div className="mb-5">
              <h2 className="text-[22px] font-bold sm:text-2xl">{group.title}</h2>
              <p className="mt-1 text-[13px] text-sand-100/50">{group.subtitle}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {group.list.map((combo) => {
                const saving = combo.original_price
                  ? Math.round(((combo.original_price - combo.price) / combo.original_price) * 100)
                  : 0;

                return (
                  <article key={combo.id} className="card card-hover overflow-hidden">
                    <div className="grid sm:grid-cols-[180px_1fr]">
                      <div className="relative aspect-[16/10] sm:aspect-auto">
                        {combo.image ? (
                          <Image
                            src={combo.image}
                            alt={combo.name_bn}
                            fill
                            sizes="(max-width: 640px) 100vw, 200px"
                            className="object-cover"
                          />
                        ) : null}
                        {saving > 0 ? (
                          <span className="absolute left-2.5 top-2.5 badge bg-amber-400 text-ink-900">
                            {saving}% সাশ্রয়
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-col p-4">
                        <h3 className="text-[16px] font-bold leading-snug">
                          <Link href={`/combos/${combo.slug}`} className="link-underline">
                            {combo.name_bn}
                          </Link>
                        </h3>
                        <p className="mt-1 text-[12px] leading-relaxed text-sand-100/55">
                          {combo.description_bn}
                        </p>

                        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {combo.contents.map((c) => (
                            <li key={c.name} className="flex items-start gap-1.5 text-[11.5px] text-sand-100/70">
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-leaf-400" />
                              <span className="min-w-0">
                                <span className="truncate">{c.name}</span>
                                <span className="ml-1 text-sand-100/35">{c.qty}</span>
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                          <div>
                            <p className="text-[19px] font-bold text-leaf-200">{money(combo.price, true)}</p>
                            {combo.original_price ? (
                              <p className="text-[11px] text-sand-100/35 line-through">
                                {money(combo.original_price, true)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/combos/${combo.slug}`} className="btn-ghost btn-sm">
                              বিস্তারিত
                            </Link>
                            <ComboAddButton comboId={combo.id} comboSlug={combo.slug} label="যোগ করুন" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null
      )}

      <div className="card mt-12 flex flex-col items-start justify-between gap-4 border-leaf-600/30 bg-gradient-to-r from-leaf-800/40 to-ink-850 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold">প্রতি সপ্তাহে অটোমেটিক বক্স চান?</h2>
          <p className="mt-1 text-[13px] text-sand-100/60">
            মাসিক সাবস্ক্রিপশনে যুক্ত হন — প্রতি সপ্তাহে তাজা বক্স পৌঁছে যাবে, যেকোনো সময় পজ করুন।
          </p>
        </div>
        <Link href="/subscription" className="btn-mint shrink-0">
          ফ্যামিলি প্যাকেজ দেখুন <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
