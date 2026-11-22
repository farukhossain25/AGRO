import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts } from "@/lib/data";
import { ProductBrowser } from "@/components/shop/product-browser";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

export const revalidate = 60;

/* Built-in copy is the fallback; /admin/seo can override it per route
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
  const [products, categories] = await Promise.all([getProducts({}), getCategories()]);

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
          খামার থেকে সরাসরি সংগ্রহ করা {products.length}টি তাজা পণ্য। প্রতিটি পণ্যের সাথে আছে
          খামারের নাম ও তোলার তারিখ।
        </p>
      </header>

      <ProductBrowser
        products={products}
        categories={categories}
        initialQuery={params.q ?? ""}
        initialCategory={params.category ?? ""}
      />
    </div>
  );
}
