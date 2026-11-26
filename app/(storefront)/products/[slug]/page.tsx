import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { decodeRouteParam } from "@/lib/format";
import { getApprovedReviews, getCategories, getProducts, getRelatedProducts, lookupProductBySlug } from "@/lib/data";
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
import { ReviewList } from "@/components/shop/review-list";
import { getProductReviews } from "@/lib/reviews";
import { SectionHeader, StarRating } from "@/components/ui";
import { site } from "@/lib/site";
import { dynamicAlternates, jsonLdScript } from "@/lib/seo";

/* The page reads the session cookie (wishlist + premium state) on every
   request, so it cannot be served from the static shell: in Next 15 a cached
   ISR render that touches `cookies()` aborts with DYNAMIC_SERVER_USAGE and
   answers 500 for every slug outside the prerendered set. */
export const dynamic = "force-dynamic";

export const revalidate = 120;

export async function generateStaticParams() {
  const products = await getProducts({}).catch(() => []);
  return products.slice(0, 40).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  // Metadata must not cache a 404 title because of a hiccup either.
  const found = await lookupProductBySlug(slug);
  const product = found.state === "ok" ? found.value : null;
  if (!product) return { title: "পণ্য" };

  const title = `${product.name_bn} — ${product.unit}`;
  const description =
    product.description_bn?.slice(0, 160) ??
    `${product.name_bn} — খামার থেকে সরাসরি তাজা পণ্য। সারা বাংলাদেশে ডেলিভারি।`;

  return {
    title,
    description,
    alternates: dynamicAlternates(`/products/${product.slug}`),
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

const REVIEW_SORTS = ["newest", "highest", "lowest"] as const;
type ReviewSortParam = (typeof REVIEW_SORTS)[number];

function normaliseSort(value: string | string[] | undefined): ReviewSortParam {
  const first = Array.isArray(value) ? value[0] : value;
  return (REVIEW_SORTS as readonly string[]).includes(first ?? "")
    ? (first as ReviewSortParam)
    : "newest";
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rsort?: string | string[] }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const sort = normaliseSort((await searchParams).rsort);

  /* Only a genuine "no such row" may answer 404. A failed read used to look
     identical, so one bad minute at Supabase turned every product link into
     "পণ্য পাওয়া যায়নি" until the serverless instance was recycled. */
  const found = await lookupProductBySlug(slug);
  if (found.state === "error") {
    throw new Error(`product lookup failed for "${slug}" — retry instead of 404`);
  }
  const product = found.value;
  if (!product) notFound();

  const [categories, related, reviews, verified] = await Promise.all([
    getCategories(),
    getRelatedProducts(product, 4),
    getApprovedReviews(product.id, 5),
    getProductReviews(product.id, { sort: "newest", limit: 5 }).catch(() => []),
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
            ratingValue: Number(product.rating),
            reviewCount: product.review_count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    review: verified.length
      ? verified.slice(0, 5).map((r) => ({
          "@type": "Review",
          reviewRating: {
            "@type": "Rating",
            ratingValue: r.rating,
            bestRating: 5,
            worstRating: 1,
          },
          author: {
            "@type": "Person",
            name: r.reviewer?.full_name?.trim() || "Verified customer",
          },
          datePublished: r.created_at.slice(0, 10),
          ...(r.comment ? { reviewBody: r.comment } : {}),
          ...(r.is_verified_purchase
            ? {
                publisher: { "@type": "Organization", name: site.nameBn },
              }
            : {}),
        }))
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
      {/* jsonLdScript() escapes "<" as \u003c. A bare JSON.stringify made any
          seller-controlled name or description able to close this tag and open
          a <script> of its own — stored XSS on a public product page. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }}
      />

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

        {/* reviews — verified purchases first, legacy testimonials below */}
        <section className="mt-14" aria-labelledby="product-reviews">
          <SectionHeader
            eyebrow="গ্রাহক রিভিউ"
            title={<span id="product-reviews">এই পণ্য নিয়ে গ্রাহকেরা কী বলছেন</span>}
            subtitle={`${product.review_count} জনের ভেরিফাইড রেটিং · গড় ${Number(product.rating).toFixed(1)}/৫`}
          />

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0">
              <ReviewList
                productId={product.id}
                sort={sort}
                limit={8}
                href={`/products/${product.slug}`}
              />
            </div>

            <div className="space-y-4">
              <ReviewForm productId={product.id} />

              {reviews.length ? (
                <div className="card p-4">
                  <p className="text-[11px] uppercase tracking-wide text-sand-100/35">
                    পুরোনো সাইটের মতামত
                  </p>
                  <ul className="mt-2 space-y-2.5">
                    {reviews.slice(0, 3).map((r) => (
                      <li key={r.id} className="border-t border-white/[0.07] pt-2.5 first:border-0 first:pt-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-sand-50">{r.name_bn}</p>
                          <StarRating value={r.rating} size={11} />
                        </div>
                        <p className="mt-1 line-clamp-3 text-[11.5px] leading-5 text-sand-100/55">
                          {r.comment}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
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
