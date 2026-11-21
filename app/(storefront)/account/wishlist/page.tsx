import Link from "next/link";
import { getProducts } from "@/lib/data";
import { ProductGrid } from "@/components/product-card";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Wishlist is intentionally lightweight: favourites live in localStorage on the
 * client. For SSR we surface our most-loved products as recommendations and
 * explain how to save items.
 */
export default async function WishlistPage() {
  const recommended = await getProducts({ sort: "rating", limit: 4 });

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <h2 className="text-[14px] font-semibold">পছন্দের তালিকা</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-sand-100/50">
          পণ্যের পেজে <span className="text-leaf-300">♥</span> বাটনে চাপ দিয়ে পছন্দের পণ্য সংরক্ষণ করুন।
          আপনার ব্রাউজারে সংরক্ষিত থাকবে।
        </p>
      </div>

      {recommended.length ? (
        <>
          <h2 className="text-[15px] font-bold">আপনার পছন্দ হতে পারে</h2>
          <ProductGrid products={recommended} priorityCount={0} />
        </>
      ) : (
        <EmptyState
          title="তালিকা খালি"
          body="পছন্দের পণ্য খুঁজে বের করুন।"
          action={<Link href="/products" className="btn-primary">পণ্য দেখুন</Link>}
        />
      )}
    </div>
  );
}
