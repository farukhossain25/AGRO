"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { money } from "@/lib/format";
import { EmptyState } from "./ui";

/** Slide-over mini cart. Controlled by the shell via context-free props. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const { isBn, t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const freeDeliveryTarget = 1200;
  const progress = Math.min(100, (cart.subtotal / freeDeliveryTarget) * 100);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t("শপিং কার্ট", "Shopping cart")}>
      <button
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-label={t("বন্ধ করুন", "Close")}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-ink-900 shadow-2xl animate-[fade-up_.3s_ease]">
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-leaf-300" />
            <h2 className="text-base font-bold">{t("আপনার কার্ট", "Your cart")}</h2>
            <span className="badge bg-leaf-600/20 text-leaf-200">{cart.count}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-sand-100/60 transition hover:bg-white/10 hover:text-sand-100"
            aria-label={t("বন্ধ করুন", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon="🛒"
              title={t("কার্ট এখন খালি", "Your cart is empty")}
              body={t(
                "খামার থেকে তাজা পণ্য বেছে নিয়ে কার্টে যোগ করুন।",
                "Pick something fresh from our farms to get started."
              )}
              action={
                <Link href="/products" onClick={onClose} className="btn-primary btn-sm">
                  {t("পণ্য দেখুন", "Browse products")}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="border-b border-white/[0.06] px-5 py-3">
              <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                <span className="text-sand-100/55">
                  {cart.subtotal >= freeDeliveryTarget
                    ? t("🎉 ফ্রি ডেলিভারি পেয়েছেন!", "🎉 You unlocked free delivery!")
                    : t(
                        `ফ্রি ডেলিভারির জন্য আরও ${money(freeDeliveryTarget - cart.subtotal, true)}`,
                        `${money(freeDeliveryTarget - cart.subtotal, false)} more for free delivery`
                      )}
                </span>
                <span className="font-semibold text-leaf-300">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-leaf-600 to-leaf-300 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {cart.items.map((line) => (
                <li key={line.id} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-ink-850/70 p-2.5">
                  <Link
                    href={line.kind === "combo" ? `/combos/${line.slug}` : `/products/${line.slug}`}
                    onClick={onClose}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-800"
                  >
                    {line.image ? (
                      <Image src={line.image} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center">🌿</span>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug">
                      {t(line.nameBn, line.nameEn)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-sand-100/45">
                      {money(line.price, isBn)} / {line.unit}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-ink-800 p-0.5">
                        <button
                          onClick={() => cart.setQty(line.id, line.quantity - 1)}
                          className="grid h-6 w-6 place-items-center rounded-full text-sand-100/70 hover:bg-white/10"
                          aria-label={t("কমান", "Decrease")}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-5 text-center text-xs font-bold">{line.quantity}</span>
                        <button
                          onClick={() => cart.setQty(line.id, line.quantity + 1)}
                          className="grid h-6 w-6 place-items-center rounded-full text-sand-100/70 hover:bg-white/10"
                          aria-label={t("বাড়ান", "Increase")}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-leaf-200">
                          {money(line.price * line.quantity, isBn)}
                        </span>
                        <button
                          onClick={() => cart.remove(line.id)}
                          className="rounded-full p-1 text-sand-100/35 transition hover:bg-red-500/15 hover:text-red-300"
                          aria-label={t("সরান", "Remove")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-white/[0.06] bg-ink-850/60 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-sand-100/60">{t("সাবটোটাল", "Subtotal")}</span>
                <span className="text-lg font-bold text-leaf-200">{money(cart.subtotal, isBn)}</span>
              </div>
              <Link href="/checkout" onClick={onClose} className="btn-primary w-full">
                {t("চেকআউট করুন", "Proceed to checkout")}
              </Link>
              <button onClick={onClose} className="mt-2 w-full text-center text-[12.5px] text-sand-100/50 hover:text-sand-100">
                {t("আরও কিনুন", "Continue shopping")}
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
