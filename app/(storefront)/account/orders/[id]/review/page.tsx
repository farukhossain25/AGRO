import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/api";
import { getReviewableItems, getReviewTags } from "@/lib/reviews";
import { SupplierReviewForm, type ReviewItemSeed } from "@/components/shop/supplier-review-form";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "রিভিউ দিন",
  description: "আপনার অর্ডারের প্রতিটি পণ্য ও সেলারকে আলাদাভাবে রেটিং দিন।",
  robots: { index: false, follow: false },
};

type Ctx = { params: Promise<{ id: string }> };

/* ==========================================================================
   /account/orders/:id/review — per-supplier review screen
   --------------------------------------------------------------------------
   Combo orders split into per-seller sub-orders, so the page groups the
   delivered lines by seller and renders one form block per supplier. A review
   can never cover the whole combo — every product is rated on its own.
   ========================================================================== */

export default async function OrderReviewPage({ params }: Ctx) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) notFound();

  const [{ delivered, items }, tags] = await Promise.all([
    getReviewableItems(id, user.id),
    getReviewTags(),
  ]);

  if (!items.length) {
    return (
      <EmptyState
        icon="🕒"
        title={delivered ? "এই অর্ডারে রিভিউ করার মতো পণ্য নেই" : "অর্ডারটি এখনো ডেলিভারি হয়নি"}
        body={
          delivered
            ? "সব পণ্যের রিভিউ ইতিমধ্যে দেওয়া হয়েছে — সম্পাদনার সময় থাকলে অর্ডার তালিকা থেকে ঢুকুন।"
            : "ডেলিভারি সম্পন্ন হলে আপনি একটি নোটিফিকেশন ও “রিভিউ দিন” বাটন পাবেন।"
        }
        action={
          <Link href="/account/orders" className="btn-primary">
            আমার অর্ডার
          </Link>
        }
      />
    );
  }

  // group lines by supplier so each block is one sub-order
  type Group = {
    key: string;
    sellerNameBn: string;
    items: ReviewItemSeed[];
  };

  const groups = new Map<string, Group>();

  for (const item of items) {
    const key = item.sellerId ?? "agro";
    const group =
      groups.get(key) ??
      ({
        key,
        sellerNameBn: item.sellerNameBn ?? "বিশ্বাস এগ্রো",
        items: [],
      } satisfies Group);

    group.items.push({
      productId: item.productId,
      productNameBn: item.productNameBn,
      productImage: item.productImage,
      quantity: item.quantity,
      canEdit: item.canEdit,
      existingReview: item.existingReview
        ? {
            id: item.existingReview.id,
            rating: item.existingReview.rating,
            seller_rating: item.existingReview.seller_rating ?? null,
            comment: item.existingReview.comment ?? null,
            photos: item.existingReview.photos ?? null,
            tags: item.existingReview.tags ?? null,
          }
        : null,
    });

    groups.set(key, group);
  }

  const list = Array.from(groups.values());
  const pending = items.filter((i) => !i.existingReview).length;

  return (
    <div className="space-y-5">
      <nav aria-label="ব্রেডক্রাম্ব" className="text-[11.5px] text-sand-100/40">
        <Link href="/account/orders" className="hover:text-leaf-200">
          অর্ডার
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-sand-100/60">রিভিউ</span>
      </nav>

      <header>
        <h2 className="text-[20px] font-bold text-sand-50 sm:text-[22px]">আপনার মতামত দিন</h2>
        <p className="mt-1 text-[12.5px] leading-6 text-sand-100/55">
          প্রতিটি সেলার ও পণ্যের জন্য আলাদা রিভিউ দিন।{" "}
          {pending > 0 ? (
            <span className="text-leaf-200">{pending}টি পণ্য বাকি আছে।</span>
          ) : (
            <span className="text-leaf-200">সব পণ্যের রিভিউ দেওয়া হয়েছে।</span>
          )}
        </p>
      </header>

      <div className="space-y-4">
        {list.map((group) => (
          <SupplierReviewForm
            key={group.key}
            orderId={id}
            sellerNameBn={group.sellerNameBn}
            items={group.items}
            tags={tags}
          />
        ))}
      </div>

      <p className="text-[11px] leading-5 text-sand-100/35">
        রিভিউ শুধুমাত্র প্রকৃত ক্রেতারা দিতে পারেন — তাই আপনার রিভিউতে “ভেরিফাইড ক্রয়” ব্যাজ
        যুক্ত হবে। জমা দেওয়ার ৭ দিনের মধ্যে সম্পাদনা করা যাবে; মুছে ফেলা যাবে না।
      </p>
    </div>
  );
}
