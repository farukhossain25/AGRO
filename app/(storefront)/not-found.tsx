import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Search } from "lucide-react";
import { getCategories } from "@/lib/data";

/* ==========================================================================
   404 — section D
   --------------------------------------------------------------------------
   A dead end costs a session. This page:
     • is explicitly noindex (a 404 status is enough for Google, but the meta
       tag stops soft-404 warnings in Search Console)
     • offers the nine categories plus the four most likely destinations, so
       the visitor — and the crawler following internal links — can recover
   ========================================================================== */

export const metadata: Metadata = {
  title: "পাতাটি খুঁজে পাওয়া যায়নি",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const categories = await getCategories().catch(() => []);

  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center sm:py-20">
      <span className="text-6xl" aria-hidden>
        🌾
      </span>
      <p className="mt-4 font-mono text-[12px] font-bold tracking-widest text-leaf-300">
        404
      </p>
      <h1 className="mt-2 text-[26px] font-bold sm:text-4xl">পাতাটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
        আপনি যে পৃষ্ঠাটি খুঁজছেন সেটি সরানো হয়েছে বা ঠিকানাটি ভুল হতে পারে। নিচ থেকে তাজা পণ্য
        দেখে নিন।
      </p>

      {/* search */}
      <form action="/products" method="get" className="mt-6 flex w-full max-w-sm gap-2" role="search">
        <label htmlFor="nf-q" className="sr-only">
          পণ্য খুঁজুন
        </label>
        <input
          id="nf-q"
          name="q"
          type="search"
          placeholder="পণ্য খুঁজুন — যেমন: টমেটো, মধু"
          className="input text-[16px] sm:text-[13.5px]"
        />
        <button type="submit" className="btn-primary shrink-0 px-4" aria-label="খুঁজুন">
          <Search className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary btn-sm min-h-[44px]">
          হোমে ফিরুন
        </Link>
        <Link href="/products" className="btn-ghost btn-sm min-h-[44px]">
          সব পণ্য
        </Link>
        <Link href="/combos" className="btn-ghost btn-sm min-h-[44px]">
          কম্বো বক্স
        </Link>
        <Link href="/contact" className="btn-ghost btn-sm min-h-[44px]">
          যোগাযোগ
        </Link>
      </div>

      {categories.length ? (
        <nav aria-label="ক্যাটাগরি" className="mt-8 w-full max-w-2xl">
          <p className="mb-2.5 text-[11px] uppercase tracking-wide text-sand-100/35">
            অথবা একটি ক্যাটাগরি থেকে শুরু করুন
          </p>
          <ul className="flex flex-wrap justify-center gap-1.5">
            {categories.slice(0, 9).map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="chip min-h-[44px] text-[12px]"
                >
                  {category.icon ? <span aria-hidden>{category.icon}</span> : null}
                  {category.name_bn}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
