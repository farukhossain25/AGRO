import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getApprovedReviews, getCategories, getProductBySlug, getProducts, getRelatedProducts } from "@/lib/data";
import { ProductDetail } from "@/components/shop/product-detail";
import { SupplierCard } from "@/components/shop/supplier-card";
import { ProductLiveBlock } from "@/components/live/product-live-block";
import { RecentlyViewed } from "@/components/shop/recently-viewed";
import { TrackView } from "@/components/shop/track-view";
import { currentUser } from "@/lib/api";
import { getProductSupplier, getSupplierCameras } from "@/lib/supplier";
import { resolvePremiumState } from "@/lib/premium";
import { getWishlistProductIds } from "@/lib/wishlist";
import { ProductGrid } from "@/components/product-card";
import { ReviewForm } from "@/components/review-form";
import { SectionHeader, StarRating } from "@/components/ui";
import { site } from "@/lib/site";
import { formatDateBn } from "@/lib/format";

export const revalidate = 120;

export async function generateStaticParams() {
  const products = await getProducts({}).catch(() => []);
  return products.slice(0, 40).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "পণ্য পাওয়া যায়নি" };

  const title = `${product.name_bn} — ${product.unit}`;
  const description =
    product.description_bn?.slice(0, 160) ??
    `${product.name_bn} — খামার থেকে সরাসরি তাজা পণ্য। সারা বাংলাদেশে ডেলিভারি।`;

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${title} | ${site.nameBn}`,
      description,
      images: product.image ? [{ url: product.image, alt: product.name_bn }] : undefined,
      url: `/products/${product.slug}`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [categories, related, reviews] = await Promise.all([
    getCategories(),
    getRelatedProducts(product, 4),
    getApprovedReviews(product.id, 5),
  ]);

  const category = categories.find((c) => c.id === product.category_id);

  // ── supplier + live footage (section D)
  const [supplier, session] = await Promise.all([
    getProductSupplier(product).catch(() => null),
    currentUser().catch(() => null),
  ]);

  const cameras = supplier?.farmId
    ? await getSupplierCameras(supplier.farmId).catch(() => [])
    : [];

  const premium = session
    ? await resolvePremiumState(session.id, session.role).catch(() => null)
    : null;

  const canWatch = Boolean(premium?.canWatch);

  // wishlist state for the heart button (guests get an empty list)
  const savedProductIds = session
    ? await getWishlistProductIds(session.id).catch(() => [])
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name_bn,
    alternateName: product.name_en,
    description: product.description_bn,
    image: product.image ? `${site.url}${product.image}` : undefined,
    sku: product.slug,
    brand: { "@type": "Brand", name: site.nameBn },
    offers: {
      "@type": "Offer",
      url: `${site.url}/products/${product.slug}`,
      priceCurrency: "BDT",
      price: product.price,
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: site.nameBn },
    },
    aggregateRating:
      product.review_count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.review_count,
          }
        : undefined,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "হোম", item: site.url },
      { "@type": "ListItem", position: 2, name: "সব পণ্য", item: `${site.url}/products` },
      ...(category
        ? [{ "@type": "ListItem", position: 3, name: category.name_bn, item: `${site.url}/categories/${category.slug}` }]
        : []),
      { "@type": "ListItem", position: 4, name: product.name_bn },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="container-x py-6 sm:py-10">
        <nav aria-label="ব্রেডক্রাম্ব" className="mb-5 flex flex-wrap items-center gap-1 text-[12px] text-sand-100/45">
          <Link href="/" className="hover:text-leaf-200">হোম</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/products" className="hover:text-leaf-200">সব পণ্য</Link>
          {category ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/categories/${category.slug}`} className="hover:text-leaf-200">{category.name_bn}</Link>
            </>
          ) : null}
          <ChevronRight className="h-3 w-3" />
          <span className="text-sand-100/80">{product.name_bn}</span>
        </nav>

        <ProductDetail
          product={product}
          categoryName={category?.name_bn ?? "পণ্য"}
          initialSaved={savedProductIds.includes(product.id)}
        />

        {/* ── supplier details + live farm footage */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {supplier ? <SupplierCard supplier={supplier} /> : null}
          <ProductLiveBlock
            cameras={cameras}
            farmSlug={supplier?.farmSlug ?? null}
            farmName={supplier?.farmNameBn ?? null}
            poster={supplier?.cover ?? supplier?.photo ?? null}
            loggedIn={Boolean(session)}
            canWatch={canWatch}
            reason={premium?.reason ?? "anonymous"}
          />
        </div>

        {/* ── recently viewed (section E) */}
        <RecentlyViewed excludeId={product.id} currentProduct={product} />
        <TrackView
          productId={product.id}
          item={{
            id: product.id,
            slug: product.slug,
            name_bn: product.name_bn,
            name_en: product.name_en,
            price: product.price,
            compare_price: product.compare_price,
            image: product.image,
            unit: product.unit,
            stock: product.stock,
            rating: product.rating,
            review_count: product.review_count,
          }}
        />

        {/* reviews */}
        <section className="mt-14" aria-labelledby="product-reviews">
          <SectionHeader
            eyebrow="গ্রাহক রিভিউ"
            title={<span id="product-reviews">এই পণ্য নিয়ে গ্রাহকেরা কী বলছেন</span>}
            subtitle={`${product.review_count} জনের রেটিং · গড় ${Number(product.rating).toFixed(1)}/৫`}
          />

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              {reviews.length ? (
                reviews.map((r) => (
                  <article key={r.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-600/20 text-xs font-bold text-leaf-200">
                          {r.name_bn.slice(0, 1)}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold">{r.name_bn}</p>
                          <p className="text-[10.5px] text-sand-100/40">{r.location_bn}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StarRating value={r.rating} size={12} />
                        <p className="mt-0.5 text-[10px] text-sand-100/35">{formatDateBn(r.created_at)}</p>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-sand-100/70">{r.comment}</p>
                  </article>
                ))
              ) : (
                <div className="card p-6 text-center text-[13px] text-sand-100/50">
                  এখনও কোনো অনুমোদিত রিভিউ নেই — তিনিই প্রথম হোন!
                </div>
              )}
            </div>
            <ReviewForm productId={product.id} />
          </div>
        </section>

        {related.length ? (
          <section className="mt-14">
            <SectionHeader
              eyebrow="আরও দেখুন"
              title="একই ক্যাটাগরির পণ্য"
              action={
                category ? (
                  <Link href={`/categories/${category.slug}`} className="btn-ghost btn-sm">
                    সব দেখুন
                  </Link>
                ) : null
              }
            />
            <ProductGrid products={related} priorityCount={0} />
          </section>
        ) : null}
      </div>
    </>
  );
}
