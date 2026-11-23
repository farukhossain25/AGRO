import Link from "next/link";
import type { Metadata } from "next";

/* Root 404 — reached when the URL does not belong to any segment (the
   storefront has its own, richer 404 with categories). No DB access here: a
   wrong address must never be able to fail because Supabase is down. */

export const metadata: Metadata = {
  title: "পাতাটি খুঁজে পাওয়া যায়নি",
  robots: { index: false, follow: true },
};

export default function RootNotFound() {
  return (
    <main className="container-x flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <span className="text-6xl" aria-hidden>
        🌾
      </span>
      <p className="mt-4 font-mono text-[12px] font-bold tracking-widest text-leaf-300">404</p>
      <h1 className="mt-2 text-[26px] font-bold sm:text-4xl">পাতাটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
        ঠিকানাটি ভুল হতে পারে, অথবা পৃষ্ঠাটি সরিয়ে ফেলা হয়েছে। নিচ থেকে আবার শুরু করুন।
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary btn-sm min-h-[44px]">
          হোমে ফিরুন
        </Link>
        <Link href="/products" className="btn-ghost btn-sm min-h-[44px]">
          সব পণ্য
        </Link>
        <Link href="/contact" className="btn-ghost btn-sm min-h-[44px]">
          যোগাযোগ
        </Link>
      </div>
    </main>
  );
}
