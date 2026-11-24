import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { decodeRouteParam } from "@/lib/format";
import { getCategories, getProducts, lookupCategoryBySlug } from "@/lib/data";
import { ProductBrowser } from "@/components/shop/product-browser";
import { breadcrumbLd, dynamicAlternates, jsonLdScript } from "@/lib/seo";
import { site } from "@/lib/site";

/* Session-aware components on this page (wishlist, review form) read the
   session cookie per request. In Next 15 an ISR render that touches
   `cookies()` aborts with DYNAMIC_SERVER_USAGE, so any slug outside the
   prerendered set answered 500. Rendering per request is the correct mode. */
export const dynamic = "force-dynamic";

export const revalidate = 120;

export async function generateStaticParams() {
  const categories = await getCategories().catch(() => []);
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const found = await lookupCategoryBySlug(slug);
  const category = found.state === "ok" ? found.value : null;
  if (!category) return { title: "ক্যাটাগরি" };

  return {
    title: category.name_bn,
    description: category.description_bn ?? `${category.name_bn} — খামার থেকে সরাসরি তাজা পণ্য।`,
    alternates: dynamicAlternates(`/categories/${category.slug}`),
    openGraph: {
      title: `${category.name_bn} | বিশ্বাস এগ্রো`,
      description: category.description_bn ?? "",
      images: category.image ? [{ url: category.image }] : undefined,
      url: `/categories/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  /* An outage must not masquerade as "this category is gone". */
  const found = await lookupCategoryBySlug(slug);
  if (found.state === "error") {
    throw new Error(`category lookup failed for "${slug}" — retry instead of 404`);
  }
  const category = found.value;
  if (!category) notFound();

  const [products, categories] = await Promise.all([
    getProducts({ categorySlug: slug }),
    getCategories(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${site.url}/categories/${category.slug}#collection`,
        name: category.name_bn,
        description: category.description_bn ?? undefined,
        url: `${site.url}/categories/${category.slug}`,
        inLanguage: "bn-BD",
        isPartOf: { "@id": `${site.url}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.slice(0, 20).map((prod, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: prod.name_bn,
            url: `${site.url}/products/${prod.slug}`,
            image: prod.image
              ? prod.image.startsWith("http") ? prod.image : `${site.url}${prod.image}`
              : undefined,
          })),
        },
      },
      breadcrumbLd([
        { name: "হোম", href: "/" },
        { name: "ক্যাটাগরি", href: "/categories" },
        { name: category.name_bn },
      ]),
    ].map((node) => {
      const { "@context": _c, ...rest } = node as Record<string, unknown> & { "@context"?: string };
      return rest;
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      {/* category hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 -z-10">
          {category.image ? (
            <Image src={category.image} alt="" fill sizes="100vw" className="object-cover opacity-25" priority />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-scrim/70 via-scrim/85 to-scrim" />
        </div>

        <div className="container-x py-10 sm:py-14">
          <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 flex items-center gap-1 text-[12px] text-white/55">
            <Link href="/" className="hover:text-[#7CE3B4]">হোম</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/categories" className="hover:text-[#7CE3B4]">ক্যাটাগরি</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/85">{category.name_bn}</span>
          </nav>

          <span className="eyebrow mb-3">
            <span aria-hidden>{category.icon}</span> {category.name_en}
          </span>
          <h1 className="text-[28px] font-bold text-white sm:text-4xl">{category.name_bn}</h1>
          {category.description_bn ? (
            <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-white/70">
              {category.description_bn}
            </p>
          ) : null}
          <p className="mt-3 text-[12.5px] text-[#7CE3B4]/90">{products.length} টি পণ্য পাওয়া যাচ্ছে</p>
        </div>
      </section>

      <div className="container-x py-8">
        <ProductBrowser
          products={products}
          categories={categories}
          initialCategory={slug}
          showCategoryFilter={false}
        />
      </div>
    </>
  );
}
