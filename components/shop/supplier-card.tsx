"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  MapPin,
  Package,
  ShieldCheck,
  Sprout,
  Star,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import { formatDateBn, toBn } from "@/lib/format";
import type { SupplierInfo } from "@/lib/supplier";

/* ==========================================================================
   SupplierCard — "সরবরাহকারীর তথ্য" on the product page (section D)
   --------------------------------------------------------------------------
   Public fields only. NID / bank / personal phone never leave the server.
   ========================================================================== */

const MAP_ZOOM = 13;

export function SupplierCard({ supplier }: { supplier: SupplierInfo }) {
  const { t } = useLocale();
  const [mapOpen, setMapOpen] = useState(false);

  const name = supplier.sellerNameBn ?? supplier.farmNameBn ?? "খামার";
  const district = supplier.district ?? "";
  const region = [supplier.upazila, district, supplier.division].filter(Boolean).join(", ");

  const osmLink =
    supplier.lat && supplier.lng
      ? `https://www.openstreetmap.org/?mlat=${supplier.lat}&mlon=${supplier.lng}#map=${MAP_ZOOM}/${supplier.lat}/${supplier.lng}`
      : null;

  const embedLink =
    supplier.lat && supplier.lng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${supplier.lng - 0.01}%2C${
          supplier.lat - 0.008
        }%2C${supplier.lng + 0.01}%2C${supplier.lat + 0.008}&layer=mapnik&marker=${supplier.lat}%2C${
          supplier.lng
        }`
      : null;

  return (
    <section aria-labelledby="supplier-heading" className="card overflow-hidden">
      {/* header strip */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-5">
        <h2 id="supplier-heading" className="flex items-center gap-2 text-[14px] font-bold">
          <Sprout className="h-4 w-4 text-leaf-300" />
          {t("সরবরাহকারীর তথ্য", "Supplier details")}
        </h2>
        {supplier.certifications.length ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-leaf-600/15 px-2 py-0.5 text-[10px] font-semibold text-leaf-700">
            <ShieldCheck className="h-3 w-3" />
            {t("যাচাইকৃত", "Verified")}
          </span>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-3.5">
          {/* photo */}
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-white/10 sm:h-20 sm:w-20">
            {supplier.photo ? (
              <Image
                src={supplier.photo}
                alt={name}
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-2xl">🌾</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-[14.5px] font-bold">{name}</h3>
              {supplier.sellerId ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-leaf-400" aria-label="Approved seller" />
              ) : null}
            </div>

            {supplier.farmNameBn && supplier.farmNameBn !== name ? (
              <p className="mt-0.5 truncate text-[11.5px] text-leaf-300">{supplier.farmNameBn}</p>
            ) : null}

            <p className="mt-1 flex items-start gap-1 text-[11.5px] text-sand-100/55">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{supplier.addressBn ?? region}</span>
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sand-100/45">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <strong className="text-sand-100/80">{toBn(supplier.rating.toFixed(1))}</strong>
                <span>({toBn(supplier.reviewCount)})</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Package className="h-3 w-3" />
                {t("মোট", "Total")} {toBn(supplier.productCount)} {t("পণ্য", "products")}
              </span>
              {supplier.establishedYear ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {t("প্রতিষ্ঠা", "Since")} {toBn(supplier.establishedYear)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* description */}
        {supplier.bioBn || supplier.descriptionBn ? (
          <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-sand-100/60">
            {supplier.bioBn ?? supplier.descriptionBn}
          </p>
        ) : null}

        {/* supplier quality — v_supplier_quality (migration 0005) */}
        {supplier.quality && supplier.quality.review_count > 0 ? (
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-sand-100/35">
                {t("সেলার কোয়ালিটি", "Seller quality")}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-leaf-200">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {toBn(Number(supplier.quality.avg_rating).toFixed(1))}
                <span className="font-normal text-sand-100/40">
                  ({toBn(supplier.quality.review_count)})
                </span>
              </span>
            </div>

            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[9.5px] text-sand-100/35">{t("অভিযোগ", "Complaints")}</dt>
                <dd className="text-[12px] font-semibold text-sand-100/80">
                  {toBn(Math.round(Number(supplier.quality.complaint_rate) * 100))}%
                </dd>
              </div>
              <div>
                <dt className="text-[9.5px] text-sand-100/35">{t("সময়মতো", "On time")}</dt>
                <dd className="text-[12px] font-semibold text-leaf-200">
                  {toBn(Math.round(Number(supplier.quality.on_time_rate) * 100))}%
                </dd>
              </div>
              <div>
                <dt className="text-[9.5px] text-sand-100/35">{t("স্কোর", "Score")}</dt>
                <dd className="text-[12px] font-semibold text-sand-100/80">
                  {toBn(Number(supplier.quality.quality_score).toFixed(0))}
                  <span className="text-[9px] text-sand-100/30">/100</span>
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {/* harvest + source */}
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-sand-100/35">
              {t("তোলার তারিখ", "Harvest date")}
            </dt>
            <dd className="mt-0.5 text-[12px] font-semibold text-sand-100/85">
              {supplier.harvestDate ? formatDateBn(supplier.harvestDate) : t("প্রতিদিন তাজা", "Fresh daily")}
            </dd>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-sand-100/35">
              {t("পণ্যের উৎস", "Product source")}
            </dt>
            <dd className="mt-0.5 truncate text-[12px] font-semibold text-sand-100/85">
              {supplier.farmSourceBn ?? supplier.farmNameBn ?? t("নিজস্ব খামার", "Own farm")}
            </dd>
          </div>
        </dl>

        {/* map */}
        <div className="mt-3">
          {embedLink ? (
            <>
              <button
                type="button"
                onClick={() => setMapOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2 text-[12px] font-medium text-sand-100/70 transition hover:border-leaf-500/40 hover:text-sand-100"
              >
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-leaf-300" />
                  {t("খামারের ম্যাপ দেখুন", "View farm on map")}
                </span>
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${mapOpen ? "rotate-90" : ""}`}
                />
              </button>

              {mapOpen ? (
                <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <iframe
                    title={t("খামারের অবস্থান", "Farm location")}
                    src={embedLink}
                    className="h-[200px] w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    href={osmLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-ink-850 px-3 py-1.5 text-center text-[11px] text-leaf-300 hover:underline"
                  >
                    {t("OpenStreetMap-এ খুলুন", "Open in OpenStreetMap")} ↗
                  </a>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11.5px] text-sand-100/40">
              {t("ম্যাপ লোকেশন এখনো যোগ করা হয়নি", "Map location not added yet")}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={supplier.storeHref}
            className="btn-ghost flex-1 !px-3 !py-2 !text-[12px]"
          >
            {t("এই সেলারের সব পণ্য দেখুন", "See all products from this seller")}
            <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
          {supplier.farmSlug ? (
            <Link
              href={`/live/farms/${supplier.farmSlug}`}
              className="btn-ghost !px-3 !py-2 !text-[12px]"
            >
              {t("খামার দেখুন", "Visit farm")}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
