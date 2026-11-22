"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/ui";



export default function CartPage() {
  const cart = useCart();
  const { t, isBn } = useLocale();

  const freeOver = 1200;
  const delivery = cart.subtotal >= freeOver || cart.subtotal === 0 ? 0 : 60;
  const total = cart.subtotal + delivery;

  if (!cart.ready) {
    return (
      <div className="container-x py-16">
        <div className="skeleton h-8 w-40" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <h1 className="text-[26px] font-bold sm:text-3xl">{t("শপিং কার্ট", "Shopping cart")}</h1>
      <p className="mt-1.5 text-[13px] text-sand-100/50">
        {cart.count} {t("টি পণ্য", "items")} · {t("কার্ট স্বয়ংক্রিয়ভাবে সেভ হয়", "Your cart saves automatically")}
      </p>

      {cart.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🛒"
            title={t("আপনার কার্ট খালি", "Your cart is empty")}
            body={t("খামার থেকে তাজা পণ্য বেছে নিয়ে শুরু করুন।", "Start by picking something fresh from our farms.")}
            action={<Link href="/products" className="btn-primary">পণ্য দেখুন</Link>}
          />
        </div>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <ul className="space-y-3">
            {cart.items.map((line) => (
              <li key={line.id} className="card flex gap-3 p-3 sm:p-4">
                <Link
                  href={line.kind === "combo" ? `/combos/${line.slug}` : `/products/${line.slug}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-800 sm:h-24 sm:w-24"
                >
                  {line.image ? (
                    <Image src={line.image} alt="" fill sizes="96px" className="object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-2xl">🌿</span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10.5px] uppercase tracking-wider text-leaf-300/70">
                        {line.kind === "combo" ? t("কম্বো", "Combo") : t("পণ্য", "Product")}
                      </p>
                      <h2 className="line-clamp-2 text-[14px] font-semibold leading-snug">
                        <Link href={line.kind === "combo" ? `/combos/${line.slug}` : `/products/${line.slug}`} className="hover:text-leaf-200">
                          {t(line.nameBn, line.nameEn)}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-[12px] text-sand-100/45">
                        {money(line.price, isBn)} / {line.unit}
                      </p>
                    </div>
                    <button
                      onClick={() => cart.remove(line.id)}
                      className="rounded-full p-2 text-sand-100/35 transition hover:bg-red-500/15 hover:text-red-300"
                      aria-label={t("সরান", "Remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-2">
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-ink-800 p-0.5">
                      <button
                        onClick={() => cart.setQty(line.id, line.quantity - 1)}
                        className="grid h-7 w-7 place-items-center rounded-full text-sand-100/70 hover:bg-white/10"
                        aria-label={t("কমান", "Decrease")}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-6 text-center text-[13px] font-bold">{line.quantity}</span>
                      <button
                        onClick={() => cart.setQty(line.id, line.quantity + 1)}
                        disabled={line.quantity >= line.stock}
                        className="grid h-7 w-7 place-items-center rounded-full text-sand-100/70 hover:bg-white/10 disabled:opacity-30"
                        aria-label={t("বাড়ান", "Increase")}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[15px] font-bold text-leaf-200">
                      {money(line.price * line.quantity, isBn)}
                    </p>
                  </div>
                </div>
              </li>
            ))}

            <li>
              <button onClick={cart.clear} className="btn-ghost btn-sm">
                <Trash2 className="h-3.5 w-3.5" /> {t("কার্ট খালি করুন", "Clear cart")}
              </button>
            </li>
          </ul>

          {/* summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <h2 className="text-[15px] font-bold">{t("অর্ডার সারাংশ", "Order summary")}</h2>

              <dl className="mt-4 space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-sand-100/55">{t("সাবটোটাল", "Subtotal")}</dt>
                  <dd className="font-medium">{money(cart.subtotal, isBn)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sand-100/55">{t("ডেলিভারি চার্জ", "Delivery")}</dt>
                  <dd className="font-medium">
                    {delivery === 0 ? (
                      <span className="text-leaf-300">{t("ফ্রি", "Free")}</span>
                    ) : (
                      money(delivery, isBn)
                    )}
                  </dd>
                </div>
                {cart.subtotal < freeOver ? (
                  <p className="rounded-xl bg-leaf-600/10 px-3 py-2 text-[11.5px] text-leaf-200">
                    {t(
                      `আর ${money(freeOver - cart.subtotal, isBn)} কিনলে ডেলিভারি ফ্রি!`,
                      `Add ${money(freeOver - cart.subtotal, false)} more for free delivery!`
                    )}
                  </p>
                ) : null}
              </dl>

              <div className="my-4 divider" />

              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-semibold">{t("মোট", "Total")}</span>
                <span className="text-2xl font-bold text-leaf-200">{money(total, isBn)}</span>
              </div>

              <Link href="/checkout" className="btn-primary mt-4 w-full">
                <ShoppingBag className="h-4 w-4" />
                {t("চেকআউট করুন", "Checkout")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/products" className="mt-2 block text-center text-[12.5px] text-sand-100/50 hover:text-sand-100">
                {t("আরও কিনুন", "Continue shopping")}
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
