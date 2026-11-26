"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  CalendarDays,
  Check,
  Leaf,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
  Zap,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { discountPercent, formatDateBn, money } from "@/lib/format";
import { Badge, StarRating } from "@/components/ui";
import { WishlistButton } from "@/components/shop/recently-viewed";
import { ShareLink } from "@/components/share-link";
import type { Product } from "@/lib/types";

export function ProductDetail({
  product,
  categoryName,
  initialSaved = false,
}: {
  product: Product;
  categoryName: string;
  initialSaved?: boolean;
}) {
  const { t, isBn } = useLocale();
  const cart = useCart();
  const toast = useToast();

  const gallery = [product.image, ...(product.images ?? [])].filter(Boolean) as string[];
  const images = gallery.length ? Array.from(new Set(gallery)) : [];
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "source" | "delivery">("desc");

  const off = discountPercent(product.price, product.compare_price);
  const soldOut = product.stock <= 0;

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

  function add() {
    cart.add(line, qty);
    toast.success(
      t(`${qty}টি কার্টে যোগ হয়েছে`, `${qty} added to cart`),
      t(product.name_bn, product.name_en)
    );
  }

  function buyNow() {
    cart.add(line, qty);
    window.location.href = "/checkout";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      {/* gallery */}
      <div>
        <div className="card relative aspect-square overflow-hidden rounded-[1.75rem] sm:aspect-[4/3]">
          {images[active] ? (
            <Image
              src={images[active]}
              alt={product.name_bn}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-6xl">🌿</div>
          )}

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {product.badge_bn ? <Badge>{product.badge_bn}</Badge> : null}
            {off > 0 ? (
              <span className="badge bg-amber-400 text-ink-900">{off}% {t("ছাড়", "off")}</span>
            ) : null}
          </div>

          {/* Shares `<page>?ref=<my code>` — a friend who opens it and signs up
              becomes this customer's referral, and every one of their delivered
              orders pays commission. */}
          <ShareLink
            path={`/products/${product.slug}`}
            title={product.name_bn}
            variant="icon"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink-950/70 text-white/80 backdrop-blur transition hover:bg-ink-950 hover:text-white"
          />
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={`${img}-${i}`}
                onClick={() => setActive(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  i === active ? "border-leaf-400" : "border-white/10 opacity-60 hover:opacity-100"
                }`}
                aria-label={`ছবি ${i + 1}`}
              >
                <Image src={img} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* info */}
      <div>
        <div className="flex items-center gap-2 text-[11.5px] text-sand-100/45">
          <Link href="/categories" className="hover:text-leaf-200">{categoryName}</Link>
          <span>/</span>
          <span className="truncate">{product.name_en}</span>
        </div>

        <h1 className="mt-2 text-[24px] font-bold leading-tight sm:text-[30px]">{product.name_bn}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <StarRating value={Number(product.rating)} size={14} />
            <span className="text-[12px] text-sand-100/50">
              {Number(product.rating).toFixed(1)} ({product.review_count} {t("রিভিউ", "reviews")})
            </span>
          </span>
          <span className="text-[11.5px] text-sand-100/35">SKU: {product.slug.slice(0, 12).toUpperCase()}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <span className="text-[30px] font-bold leading-none text-leaf-200">
            {money(product.price, isBn)}
          </span>
          <span className="pb-1 text-[12.5px] text-sand-100/45">/ {product.unit}</span>
          {product.compare_price ? (
            <span className="pb-1.5 text-[13px] text-sand-100/35 line-through">
              {money(product.compare_price, isBn)}
            </span>
          ) : null}
        </div>

        {/* meta */}
        <dl className="mt-5 grid gap-2.5 rounded-2xl border border-white/[0.07] bg-ink-850/70 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{t("খামার", "Farm source")}</dt>
              <dd className="text-[12.5px] font-medium">{product.farm_source_bn ?? "—"}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{t("তোলার তারিখ", "Harvest date")}</dt>
              <dd className="text-[12.5px] font-medium">{formatDateBn(product.harvest_date, isBn)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{t("স্টক", "Stock")}</dt>
              <dd className={`text-[12.5px] font-medium ${soldOut ? "text-red-300" : ""}`}>
                {soldOut ? t("স্টকে নেই", "Out of stock") : `${product.stock} ${product.unit} ${t("বাকি", "left")}`}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
            <div>
              <dt className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{t("ইউনিট", "Unit")}</dt>
              <dd className="text-[12.5px] font-medium">{product.unit} ({product.unit_en})</dd>
            </div>
          </div>
        </dl>

        {/* quantity + actions — the two buttons share one shape and height;
            on phones they drop to their own full-width row so neither is
            squeezed into a blob by the stepper next to it. */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-ink-800 p-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-8 w-8 place-items-center rounded-full text-sand-100/70 transition hover:bg-white/10"
              aria-label={t("কমান", "Decrease")}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-8 text-center text-sm font-bold">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(product.stock || 1, q + 1))}
              className="grid h-8 w-8 place-items-center rounded-full text-sand-100/70 transition hover:bg-white/10 disabled:opacity-30"
              disabled={qty >= product.stock}
              aria-label={t("বাড়ান", "Increase")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <WishlistButton productId={product.id} initial={initialSaved} />

          <div className="flex w-full gap-3 sm:w-auto sm:flex-1">
            <button
              onClick={add}
              disabled={soldOut}
              className="btn-ghost min-h-[48px] flex-1 whitespace-nowrap px-3 text-[13px] sm:px-6 sm:text-sm"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              {t("কার্টে যোগ করুন", "Add to cart")}
            </button>
            <button
              onClick={buyNow}
              disabled={soldOut}
              className="btn-primary min-h-[48px] flex-1 whitespace-nowrap px-3 text-[13px] sm:px-6 sm:text-sm"
            >
              <Zap className="h-4 w-4 shrink-0" />
              {t("এখনই অর্ডার", "Buy now")}
            </button>
          </div>
        </div>

        {/* assurances */}
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { Icon: Truck, t: t("ঢাকায় আজ ডেলিভারি", "Same-day in Dhaka") },
            { Icon: Undo2, t: t("২৪ ঘণ্টায় রিটার্ন", "24h easy returns") },
            { Icon: ShieldCheck, t: t("কেমিক্যাল মুক্ত", "Chemical-free") },
          ].map(({ Icon, t: label }) => (
            <li key={label} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <Icon className="h-4 w-4 shrink-0 text-leaf-400" />
              <span className="text-[11.5px] text-sand-100/65">{label}</span>
            </li>
          ))}
        </ul>

        {/* tabs */}
        <div className="mt-7">
          <div className="flex gap-1 rounded-full border border-white/[0.07] bg-ink-850/70 p-1">
            {[
              { key: "desc", label: t("বিবরণ", "Description") },
              { key: "source", label: t("খামার", "Farm source") },
              { key: "delivery", label: t("ডেলিভারি", "Delivery") },
            ].map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key as typeof tab)}
                className={`flex-1 rounded-full px-3 py-2 text-[12.5px] font-medium transition ${
                  tab === tb.key ? "bg-leaf-600 text-white" : "text-sand-100/60 hover:text-sand-100"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          <div className="mt-4 text-[13.5px] leading-[1.9] text-sand-100/70">
            {tab === "desc" ? (
              <>
                <p>{product.description_bn}</p>
                <ul className="mt-3 space-y-1.5">
                  {[
                    "প্রতিদিন ভোরে সংগ্রহ করা হয় — ফ্রেশত্ব নিশ্চিত",
                    "কোনো ক্ষতিকর কীটনাশক বা রাসায়নিক ব্যবহার নেই",
                    "পরিষ্কার করে প্যাকিং, কোল্ড-চেইন ডেলিভারি",
                  ].map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-leaf-400" />
                      {b}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {tab === "source" ? (
              <p>
                এই পণ্যটি সংগ্রহ করা হয়েছে <strong className="text-leaf-200">{product.farm_source_bn ?? "নির্বাচিত খামার"}</strong>{" "}
                থেকে। তোলার তারিখ <strong className="text-leaf-200">{formatDateBn(product.harvest_date, isBn)}</strong>।
                খামারি পরিবারকে বাজার দরের চেয়ে বেশি দাম পরিশোধ করা হয়েছে।
              </p>
            ) : null}

            {tab === "delivery" ? (
              <ul className="space-y-2">
                <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-leaf-400" /> ঢাকা সিটিতে: একই দিনে (সকাল ১০টার আগে অর্ডার করলে)।</li>
                <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-leaf-400" /> ঢাকার বাইরে: ২–৩ কর্মদিবস।</li>
                <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-leaf-400" /> ৳১,২০০+ অর্ডারে ঢাকায় ফ্রি ডেলিভারি।</li>
                <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-leaf-400" /> পণ্য নষ্ট বা পছন্দ না হলে ২৪ ঘণ্টায় রিটার্ন করুন।</li>
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
