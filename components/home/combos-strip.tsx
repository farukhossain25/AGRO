"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Plus, ShoppingBasket } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";
import { SectionHeader, ViewAll } from "@/components/ui";
import type { Combo } from "@/lib/types";

export function CombosStrip({ combos }: { combos: Combo[] }) {
  const { t, isBn } = useLocale();
  const cart = useCart();
  const toast = useToast();

  function addCombo(combo: Combo) {
    cart.add(
      {
        id: combo.id,
        kind: "combo",
        slug: combo.slug,
        nameBn: combo.name_bn,
        nameEn: combo.name_en ?? combo.name_bn,
        price: combo.price,
        unit: t("বক্স", "box"),
        image: combo.image,
        stock: 99,
      },
      1
    );
    toast.success(t("কম্বো কার্টে যোগ হয়েছে", "Combo added to cart"), combo.name_bn);
  }

  if (!combos.length) return null;

  return (
    <section className="section relative overflow-hidden" aria-labelledby="combos-heading">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/50 via-transparent to-transparent" />
      <div className="container-x">
        <SectionHeader
          eyebrow="রেডিমেড কম্বো"
          title={<span id="combos-heading">ডেইলি ও উইকলি সবজি কম্বো</span>}
          subtitle="কী কিনবেন ভাবতে হবে না — আমরা বেছে নিই, আপনি শুধু রান্না করেন। বাজার দরের চেয়ে ২০% সাশ্রয়।"
          action={<ViewAll href="/combos" label="সব কম্বো" />}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {combos.slice(0, 4).map((combo) => {
            const saving = combo.original_price
              ? Math.round(((combo.original_price - combo.price) / combo.original_price) * 100)
              : 0;

            return (
              <article key={combo.id} className="card card-hover flex flex-col overflow-hidden sm:flex-row">
                <div className="relative aspect-[16/10] shrink-0 sm:aspect-auto sm:w-40">
                  {combo.image ? (
                    <Image
                      src={combo.image}
                      alt={combo.name_bn}
                      fill
                      sizes="(max-width: 768px) 100vw, 200px"
                      className="object-cover"
                    />
                  ) : null}
                  <span className="absolute left-2.5 top-2.5 badge bg-ink-950/80 text-leaf-200 backdrop-blur">
                    {combo.kind === "daily" ? t("ডেইলি", "Daily") : t("উইকলি", "Weekly")}
                  </span>
                  {saving > 0 ? (
                    <span className="absolute bottom-2.5 left-2.5 badge bg-amber-400 text-ink-900">
                      {saving}% {t("সাশ্রয়", "off")}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-[15px] font-semibold leading-snug">
                    <Link href={`/combos/${combo.slug}`} className="link-underline">
                      {t(combo.name_bn, combo.name_en ?? combo.name_bn)}
                    </Link>
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-sand-100/50">
                    {combo.description_bn}
                  </p>

                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                    {combo.contents.slice(0, 6).map((c) => (
                      <li key={c.name} className="flex items-center gap-1.5 text-[11.5px] text-sand-100/65">
                        <Check className="h-3 w-3 shrink-0 text-leaf-400" />
                        <span className="truncate">{c.name}</span>
                        <span className="shrink-0 text-sand-100/35">{c.qty}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div>
                      <p className="text-[17px] font-bold text-leaf-200">{money(combo.price, isBn)}</p>
                      {combo.original_price ? (
                        <p className="text-[11px] text-sand-100/35 line-through">
                          {money(combo.original_price, isBn)}
                        </p>
                      ) : null}
                    </div>
                    <button onClick={() => addCombo(combo)} className="btn-primary btn-sm">
                      <Plus className="h-4 w-4" /> {t("যোগ করুন", "Add")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-ink-850/60 px-5 py-4 sm:flex-row">
          <p className="flex items-center gap-2 text-[12.5px] text-sand-100/60">
            <CalendarDays className="h-4 w-4 text-leaf-300" />
            {t(
              "প্রতিদিন সকাল ১০টার আগে অর্ডার করলে সেদিনই ডেলিভারি (ঢাকা সিটিতে)।",
              "Order before 10 AM for same-day delivery inside Dhaka city."
            )}
          </p>
          <Link href="/combos" className="text-[12.5px] font-semibold text-leaf-300 hover:text-leaf-200">
            <ShoppingBasket className="mr-1 inline h-4 w-4" />
            {t("সব কম্বো দেখুন →", "See all combos →")}
          </Link>
        </div>
      </div>
    </section>
  );
}
