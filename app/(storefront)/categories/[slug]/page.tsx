import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getCategories, getCategoryBySlug, getProducts } from "@/lib/data";
import { ProductBrowser } from "@/components/shop/product-browser";

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
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "ক্যাটাগরি পাওয়া যায়নি" };

  return {
    title: category.name_bn,
    description: category.description_bn ?? `${category.name_bn} — খামার থেকে সরাসরি তাজা পণ্য।`,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: {
      title: `${category.name_bn} | বিশ্বাস এগ্রো`,
      description: category.description_bn ?? "",
      images: category.image ? [{ url: category.image }] : undefined,
      url: `/categories/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [products, categories] = await Promise.all([
    getProducts({ categorySlug: slug }),
    getCategories(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name_bn,
    description: category.description_bn,
    url: `https://bishwasagro.com/categories/${category.slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name_bn,
        url: `https://bishwasagro.com/products/${p.slug}`,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* category hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 -z-10">
          {category.image ? (
            <Image src={category.image} alt="" fill sizes="100vw" className="object-cover opacity-25" priority />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/70 via-ink-900/85 to-ink-900" />
        </div>

        <div className="container-x py-10 sm:py-14">
          <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 flex items-center gap-1 text-[12px] text-sand-100/45">
            <Link href="/" className="hover:text-leaf-200">হোম</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/categories" className="hover:text-leaf-200">ক্যাটাগরি</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-sand-100/80">{category.name_bn}</span>
          </nav>

          <span className="eyebrow mb-3">
            <span aria-hidden>{category.icon}</span> {category.name_en}
          </span>
          <h1 className="text-[28px] font-bold sm:text-4xl">{category.name_bn}</h1>
          {category.description_bn ? (
            <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-sand-100/60">
              {category.description_bn}
            </p>
          ) : null}
          <p className="mt-3 text-[12.5px] text-leaf-300/80">{products.length} টি পণ্য পাওয়া যাচ্ছে</p>
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
