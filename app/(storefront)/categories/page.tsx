import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getProducts } from "@/lib/data";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

export const revalidate = 300;

/* Built-in copy is the fallback; the panel’s SEO screen can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/categories", {
    title: "ক্যাটাগরি",
    description:
      "তাজা শাকসবজি, ফলমূল, দেশি ডিম, মাংস, মাছ, দুধ, চাল-ডাল-তেল-মসলা, মধু ও কৃষি উপকরণ — সব ক্যাটাগরিতে খামার থেকে সরাসরি পণ্য।",
    alternates: alternatesFor("/categories"),
  });
}

export default function CategoriesPage() {
  /* Same split as /products and /market: the title needs no database read, so
     it is sent now and the category grid streams behind it. */
  return (
    <div className="container-x py-8 sm:py-12">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/80">ক্যাটাগরি</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-[26px] font-bold sm:text-4xl">সব ক্যাটাগরি</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-sand-100/55">
          আমাদের সম্পূর্ণ সংগ্রহ ক্যাটাগরি অনুযায়ী সাজানো। যেটা দরকার, সেটা বেছে নিন।
        </p>
      </header>

      <Suspense fallback={<CategoryGridFallback />}>
        <CategoryGrid />
      </Suspense>
    </div>
  );
}

async function CategoryGrid() {
  const [categories, products] = await Promise.all([getCategories(), getProducts({})]);

  const counts = products.reduce<Record<string, number>>((acc, p) => {
    if (p.category_id) acc[p.category_id] = (acc[p.category_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="card card-hover group relative overflow-hidden"
          >
            <div className="relative aspect-[16/9] overflow-hidden">
              {c.image ? (
                <Image
                  src={c.image}
                  alt={c.name_bn}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full place-items-center bg-ink-800 text-4xl">{c.icon}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/50 to-transparent" />
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-leaf-300">
                    <span aria-hidden>{c.icon}</span>
                    {c.name_en}
                  </p>
                  <h2 className="mt-1 text-[17px] font-bold">{c.name_bn}</h2>
                  <p className="mt-1 line-clamp-2 text-[12px] text-sand-100/55">{c.description_bn}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf-600/90 text-white transition group-hover:bg-leaf-500">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-[11.5px] text-sand-100/40">
                {counts[c.id] ?? 0} টি পণ্য
              </p>
            </div>
          </Link>
        ))}
      </div>
  );
}

/** Six tiles of the same proportions — the swap does not move the footer. */
function CategoryGridFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton aspect-[16/9] w-full rounded-xl" />
      ))}
    </div>
  );
}
