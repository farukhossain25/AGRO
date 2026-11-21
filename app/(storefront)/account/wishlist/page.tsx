import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { currentUser } from "@/lib/api";
import { getWishlistProducts } from "@/lib/wishlist";
import { getProducts } from "@/lib/data";
import { ProductGrid } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import { RecentlyViewedStrip } from "@/components/shop/recently-viewed-strip";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await currentUser();

  // A real, persisted wishlist needs an account.
  if (!user) redirect("/login?next=/account/wishlist");

  const [saved, recommended] = await Promise.all([
    getWishlistProducts(user.id),
    getProducts({ sort: "rating", limit: 4 }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="card flex items-start justify-between gap-3 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Heart className="h-4 w-4 text-red-400" />
            পছন্দের তালিকা
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-sand-100/50">
            পণ্যের পেজে <span className="text-red-300">♥</span> বাটনে চাপ দিলে পণ্যটি এখানে সংরক্ষিত
            থাকবে এবং যেকোনো ডিভাইস থেকে দেখা যাবে।
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-sand-100/60">
          {saved.length}টি
        </span>
      </div>

      {saved.length ? (
        <>
          <h2 className="text-[15px] font-bold">সংরক্ষিত পণ্য</h2>
          <ProductGrid products={saved} priorityCount={0} />
        </>
      ) : (
        <EmptyState
          title="তালিকা খালি"
          body="পছন্দের পণ্য খুঁজে বের করে ♥ চাপুন — এখানে জমা হবে।"
          action={
            <Link href="/products" className="btn-primary">
              পণ্য দেখুন
            </Link>
          }
        />
      )}

      <RecentlyViewedStrip />

      {recommended.length ? (
        <>
          <h2 className="text-[15px] font-bold">আপনার পছন্দ হতে পারে</h2>
          <ProductGrid products={recommended} priorityCount={0} />
        </>
      ) : null}
    </div>
  );
}
