import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { BadgeCheck, Eye, MapPin, Phone, ShieldCheck } from "lucide-react";
import { decodeRouteParam } from "@/lib/format";
import { currentUser } from "@/lib/api";
import { getSellerBySlug, sellerStatusLabelBn } from "@/lib/sellers";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";
import { breadcrumbLd, dynamicAlternates, jsonLdScript } from "@/lib/seo";
import { site } from "@/lib/site";

/**
 * Seller storefronts are DB-driven and their parent layout reads the session
 * cookie, so they must not be baked statically — prerendering them would flip
 * static → dynamic at request time.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const user = await currentUser().catch(() => null);
  const data =
    (await getSellerBySlug(slug).catch(() => null)) ??
    (user ? await getSellerBySlug(slug, { ownerUserId: user.id }).catch(() => null) : null);
  if (!data) return { title: "বিক্রেতা পাওয়া যায়নি" };

  const preview = data.seller.status !== "approved";
  return {
    title: preview ? `${data.seller.name_bn} — প্রিভিউ` : `${data.seller.name_bn} — মার্কেটপ্লেস`,
    description: `${data.seller.district} জেলার ${data.seller.name_bn}। বিশ্বাস এগ্রো মার্কেটপ্লেসে যাচাইকৃত বিক্রেতা।`,
    alternates: dynamicAlternates(`/market/${data.seller.slug}`),
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

const TYPES_BN: Record<string, string> = {
  vegetables: "শাকসবজি",
  dairy: "দুধ ও দুগ্ধ",
  poultry: "মুরগি ও ডিম",
  fish: "মাছ",
  fruits: "ফল",
  rice: "চাল ও ডাল",
  honey: "মধু",
  spices: "মসলা",
  agri: "কৃষি উপকরণ",
};

export default async function SellerStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);

  // Public first; if this is the seller's own store (any status) they still
  // get to see it — as a clearly marked preview, never a 404.
  const user = await currentUser().catch(() => null);
  const data =
    (await getSellerBySlug(slug).catch(() => null)) ??
    (user ? await getSellerBySlug(slug, { ownerUserId: user.id }).catch(() => null) : null);
  if (!data) notFound();

  const { seller, products } = data;
  const isPreview = seller.status !== "approved";
  // the banner the seller uploaded wins; older stores fall back to the first farm photo
  const cover = seller.banner || seller.farm_photos?.[0] || "/images/hero/farm.jpg";
  const logo = seller.logo ?? null;

  /* Storefront markup: a Store node (so Google can show the shop's name and
     location) plus a BreadcrumbList. Seller NID / bank / phone never appear —
     only the public marketplace fields. */
  const sellerLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        "@id": `${site.url}/market/${seller.slug}#store`,
        name: seller.name_bn,
        url: `${site.url}/market/${seller.slug}`,
        image: cover.startsWith("http") ? cover : `${site.url}${cover}`,
        ...(logo ? { logo: logo.startsWith("http") ? logo : `${site.url}${logo}` } : {}),
        description: seller.farm_address_bn ?? `${seller.district} জেলার যাচাইকৃত খামার ও বিক্রেতা।`,
        address: {
          "@type": "PostalAddress",
          addressLocality: seller.district,
          addressRegion: seller.division,
          addressCountry: "BD",
        },
        parentOrganization: { "@id": `${site.url}/#organization` },
        ...(products.length
          ? {
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "পণ্য",
                numberOfItems: products.length,
              },
            }
          : {}),
      },
      breadcrumbLd([
        { name: "হোম", href: "/" },
        { name: "মার্কেটপ্লেস", href: "/market" },
        { name: seller.name_bn },
      ]),
    ].map((node) => {
      const { "@context": _c, ...rest } = node as Record<string, unknown> & { "@context"?: string };
      return rest;
    }),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(sellerLd) }}
      />
      {isPreview && (
        <div className="border-b border-amber-500/30 bg-amber-500/10">
          <div className="container-x flex flex-col gap-2 py-3 text-[12.5px] text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                এটি <strong>আপনার নিজের স্টোরের প্রিভিউ</strong> — এখনো পাবলিক নয় (স্টেটাস:{" "}
                {sellerStatusLabelBn[seller.status] ?? seller.status})। অনুমোদিত হলে এই পৃষ্ঠাটিই গ্রাহকরা দেখবেন।
              </span>
            </p>
            <Link href="/seller" className="shrink-0 font-semibold underline underline-offset-2 hover:text-white">
              সেলার ড্যাশবোর্ড →
            </Link>
          </div>
        </div>
      )}

      {/* banner */}
      <section className="relative h-44 overflow-hidden sm:h-56">
        <Image src={cover} alt="" fill sizes="100vw" priority className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim via-scrim/70 to-scrim/20" />
        <div className="container-x absolute inset-x-0 bottom-0 pb-5">
          <nav className="mb-2 flex items-center gap-1.5 text-[11.5px] text-white/55">
            <Link href="/market" className="hover:text-[#7CE3B4]">মার্কেটপ্লেস</Link>
            <span>/</span>
            <span className="text-white/85">{seller.name_bn}</span>
          </nav>
          <div className="flex items-center gap-3">
            {logo ? (
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg ring-2 ring-white/70 sm:h-14 sm:w-14">
                <Image src={logo} alt={`${seller.name_bn} লোগো`} fill sizes="56px" className="object-contain p-0.5" />
              </span>
            ) : null}
            <h1 className="flex items-center gap-2 text-[24px] font-bold text-white sm:text-3xl">
              {seller.name_bn}
              {!isPreview && <BadgeCheck className="h-5 w-5 text-leaf-400" />}
            </h1>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/70">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {seller.district}
            </span>
            {seller.farm_address_bn && <span>{seller.farm_address_bn}</span>}
            {seller.phone && (
              <a href={`tel:${seller.phone}`} className="inline-flex items-center gap-1 text-leaf-400">
                <Phone className="h-3 w-3" /> {seller.phone}
              </a>
            )}
          </p>
        </div>
      </section>

      <div className="container-x py-8">
        <BackLink fallback="/market" label="মার্কেটপ্লেসে ফিরে যান" className="mb-4 !text-white/75 hover:!text-[#7CE3B4]" />
        <div className="mb-6 flex flex-wrap gap-1.5">
          {(seller.product_types ?? []).map((t) => (
            <span key={t} className="chip">
              {TYPES_BN[t] ?? t}
            </span>
          ))}
          {!isPreview && (
            <span className="chip chip-active">
              <ShieldCheck className="h-3 w-3" /> যাচাইকৃত
            </span>
          )}
        </div>

        <h2 className="mb-4 text-[16px] font-bold text-neu-ink">
          বিক্রেতার পণ্য{" "}
          <span className="text-[12px] font-normal text-sand-100/40">({products.length}টি)</span>
        </h2>

        {products.length === 0 ? (
          <p className="card p-10 text-center text-[13px] text-sand-100/50">
            এই বিক্রেতার কোনো পণ্য এখন তালিকায় নেই।
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id as string} product={p as unknown as Product} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
