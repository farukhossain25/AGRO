import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Package, Store } from "lucide-react";
import { getApprovedSellers } from "@/lib/sellers";
import { SectionHeader } from "@/components/ui";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

export const dynamic = "force-dynamic";

/* Built-in copy is the fallback; /admin/seo can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/market", {
    title: "মার্কেটপ্লেস — স্থানীয় খামার ও বিক্রেতা",
    description:
      "বিশ্বাস এগ্রো মার্কেটপ্লেসে যুক্ত দেশের বিভিন্ন প্রান্তের খামার ও বিক্রেতাদের পণ্য — সরাসরি কৃষকের কাছ থেকে।",
    alternates: alternatesFor("/market"),
  });
}

const TYPES_BN: Record<string, string> = {
  vegetables: "শাকসবজি",
  dairy: "দুধ ও দুগ্ধ",
  poultry: "মুরগি ও ডিম",
  fish: "মাছ",
  fruits: "ফল",
  rice: "চাল ও ডাল",
  honey: "মধু",
  spices: "মসলা",
  agri: "কৃষি উপকরণ",
};

export default async function MarketPage() {
  const sellers = await getApprovedSellers();

  return (
    <div className="container-x py-10 sm:py-14">
      <SectionHeader
        eyebrow="মাল্টি-ভেন্ডর"
        title="মার্কেটপ্লেস"
        subtitle="একই ছাদের নিচে দেশের নানা প্রান্তের খামার ও বিক্রেতা। প্রত্যেককে আমরা যাচাই করি — তারপরই পণ্য তালিকায় আসে।"
        action={
          <Link href="/seller/apply" className="btn-primary btn-sm">
            <Store className="h-3.5 w-3.5" /> বিক্রেতা হোন
          </Link>
        }
      />

      {sellers.length === 0 ? (
        <div className="card border-dashed p-12 text-center">
          <Store className="mx-auto h-8 w-8 text-sand-100/25" />
          <p className="mt-3 text-[14px] font-semibold text-white">এখনো কোনো বিক্রেতা অনুমোদিত হয়নি</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-sand-100/50">
            আপনি কি খামারি বা ক্ষুদ্র ব্যবসায়ী? প্রথম ব্যাচের সেলার হিসেবে যোগ দিন — ০% কমিশনে প্রথম ৩ মাস।
          </p>
          <Link href="/seller/apply" className="btn-mint btn-sm mt-5">
            আবেদন করুন
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <article key={seller.id} className="card overflow-hidden transition hover:border-leaf-600/40">
              <div className="relative aspect-[16/9] overflow-hidden bg-ink-800">
                {seller.farm_photos?.[0] ? (
                  <Image
                    src={seller.farm_photos[0]}
                    alt={seller.name_bn}
                    fill
                    sizes="(max-width:768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-3xl">🏡</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[14.5px] font-bold text-white">{seller.name_bn}</h2>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-leaf-400" />
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11.5px] text-sand-100/45">
                  <MapPin className="h-3 w-3" /> {seller.district}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(seller.product_types ?? []).slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-white/6 px-2 py-0.5 text-[10.5px] text-sand-100/60">
                      {TYPES_BN[t] ?? t}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[11.5px]">
                  <span className="flex items-center gap-1 text-sand-100/45">
                    <Package className="h-3 w-3" /> {seller.product_count} পণ্য
                  </span>
                  <Link href={`/market/${seller.slug}`} className="font-semibold text-mint hover:underline">
                    দেখুন →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-mint/20 bg-leaf-900/20 p-6 text-center">
        <p className="text-[14px] font-bold text-white">আপনার খামারের পণ্য অনলাইনে বিক্রি করতে চান?</p>
        <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-sand-100/55">
          লাইভ ক্যামেরা + QR ট্রেসেবিলিটি সহ আপনার নিজের স্টোর — কমিশন মাত্র ১০%।
        </p>
        <Link href="/seller/apply" className="btn-primary btn-sm mt-4">
          সেলার হোন
        </Link>
      </div>
    </div>
  );
}
