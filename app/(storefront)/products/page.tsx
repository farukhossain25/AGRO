import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCategories, getProducts } from "@/lib/data";
import { ProductBrowser } from "@/components/shop/product-browser";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

export const revalidate = 60;

/* Built-in copy is the fallback; the panel’s SEO screen can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/products", {
    title: "সব পণ্য",
    description:
      "বিশ্বাস এগ্রোর সব তাজা ও অর্গানিক পণ্য — শাকসবজি, ফল, ডিম, মাংস, মাছ, দুধ, চাল-ডাল-তেল-মসলা ও মধু। সারা বাংলাদেশে হোম ডেলিভারি।",
    alternates: alternatesFor("/products"),
    openGraph: {
      title: "সব পণ্য | বিশ্বাস এগ্রো",
      description: "খামার থেকে সরাসরি তাজা পণ্য — সারা বাংলাদেশে ডেলিভারি।",
      url: "/products",
    },
  });
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;

  /* THE HEADING MUST NOT WAIT FOR THE CATALOGUE
     This page used to await both queries before returning anything, so the
     whole route sat behind `(storefront)/loading.tsx` — title, breadcrumb and
     all. Split the same way as the home page: everything that needs no data is
     rendered now, the product grid streams in behind it. `products.length`
     moves into the grid, which is the only place that knows the count. */
  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/80">সব পণ্য</span>
      </nav>

      <header className="mb-7">
        <h1 className="text-[26px] font-bold sm:text-4xl">সব পণ্য</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-sand-100/55">
          খামার থেকে সরাসরি সংগ্রহ করা তাজা পণ্য। প্রতিটি পণ্যের সাথে আছে খামারের নাম ও তোলার তারিখ।
        </p>
      </header>

      <Suspense fallback={<ProductGridFallback />}>
        <ProductsBody q={params.q ?? ""} category={params.category ?? ""} />
      </Suspense>
    </div>
  );
}

/** The grid, streamed. This is the only part that reads the catalogue. */
async function ProductsBody({ q, category }: { q: string; category: string }) {
  const [products, categories] = await Promise.all([getProducts({}), getCategories()]);

  if (!products.length) {
    return (
      <p className="rounded-xl border border-dashed border-neu-line p-10 text-center text-[14px] text-neu-muted">
        এখনো কোনো পণ্য যোগ করা হয়নি।
      </p>
    );
  }

  return (
    <>
      <p className="mb-5 text-[13px] text-sand-100/50">{products.length}টি পণ্য</p>
      <ProductBrowser
        products={products}
        categories={categories}
        initialQuery={q}
        initialCategory={category}
      />
    </>
  );
}

/** Matches the real grid's shape so the swap does not reflow the page. */
function ProductGridFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neu-line/60 bg-neu-surface p-2.5">
          <div className="skeleton aspect-square w-full rounded-lg" />
          <div className="skeleton mt-3 h-3.5 w-3/4" />
          <div className="skeleton mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
