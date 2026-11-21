"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { discountPercent, money } from "@/lib/format";
import { StockBadge, StarRating } from "./ui";
import type { Product } from "@/lib/types";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { isBn, t } = useLocale();
  const cart = useCart();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const qty = cart.qtyOf(product.id);
  const soldOut = product.stock <= 0;
  const off = discountPercent(product.price, product.compare_price);

  const line = {
    id: product.id,
    kind: "product" as const,
    slug: product.slug,
    nameBn: product.name_bn,
    nameEn: product.name_en,
    price: product.price,
    unit: product.unit,
    image: product.image,
    stock: product.stock,
  };

  function addToCart() {
    if (soldOut) return;
    setAdding(true);
    cart.add(line, 1);
    toast.success(
      t("কার্টে যোগ হয়েছে", "Added to cart"),
      t(product.name_bn, product.name_en)
    );
    window.setTimeout(() => setAdding(false), 700);
  }

  return (
    <article className="card card-hover group relative flex h-full flex-col overflow-hidden">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden rounded-t-3xl bg-ink-800"
        aria-label={t(product.name_bn, product.name_en)}
      >
        {product.image ? (
          <Image
            src={product.image}
            alt={t(product.name_bn, product.name_en)}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-4xl">🌿</div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <div className="flex flex-col items-start gap-1.5">
            {product.badge_bn ? (
              <span className="badge bg-leaf-600/90 text-white shadow-sm backdrop-blur">
                {product.badge_bn}
              </span>
            ) : null}
            {off > 0 ? (
              <span className="badge bg-amber-400 text-ink-900 shadow-sm">
                {isBn ? `${off}% ছাড়` : `${off}% off`}
              </span>
            ) : null}
          </div>
          {soldOut ? (
            <span className="badge bg-ink-950/85 text-red-300 backdrop-blur">
              {t("শেষ", "Sold out")}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <StarRating value={Number(product.rating)} size={11} />
          <span className="text-[10.5px] text-sand-100/40">
            ({product.review_count})
          </span>
        </div>

        <h3 className="text-[14.5px] font-semibold leading-snug">
          <Link href={`/products/${product.slug}`} className="link-underline">
            {t(product.name_bn, product.name_en)}
          </Link>
        </h3>

        {product.farm_source_bn ? (
          <p className="mt-1 line-clamp-1 text-[11.5px] text-sand-100/40">
            📍 {product.farm_source_bn}
          </p>
        ) : null}

        <div className="mt-2">
          <StockBadge stock={product.stock} />
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <div className="leading-tight">
              <p className="text-[17px] font-bold text-leaf-200">
                {money(product.price, isBn)}
                <span className="ml-1 text-[11px] font-medium text-sand-100/45">
                  /{product.unit}
                </span>
              </p>
              {product.compare_price && product.compare_price > product.price ? (
                <p className="text-[11px] text-sand-100/35 line-through">
                  {money(product.compare_price, isBn)}
                </p>
              ) : null}
            </div>

            {qty > 0 ? (
              <div className="flex items-center gap-1 rounded-full border border-leaf-500/40 bg-leaf-600/10 p-0.5">
                <button
                  onClick={() => cart.setQty(product.id, qty - 1)}
                  className="grid h-7 w-7 place-items-center rounded-full text-leaf-200 transition hover:bg-leaf-600/25"
                  aria-label={t("কমান", "Decrease")}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-5 text-center text-xs font-bold text-leaf-100">{qty}</span>
                <button
                  onClick={() => cart.setQty(product.id, qty + 1)}
                  disabled={qty >= product.stock}
                  className="grid h-7 w-7 place-items-center rounded-full text-leaf-200 transition hover:bg-leaf-600/25 disabled:opacity-30"
                  aria-label={t("বাড়ান", "Increase")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={addToCart}
                disabled={soldOut || adding}
                className="btn-primary btn-sm !px-3.5 !py-2.5 whitespace-nowrap"
                aria-label={t("অর্ডার করুন", "Order now")}
              >
                {adding ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{t("অর্ডার", "Order")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  priorityCount = 4,
}: {
  products: Product[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
