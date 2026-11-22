import type { Metadata } from "next";
import Link from "next/link";
import { listPlans } from "@/lib/premium";
import { TrialStarter } from "@/components/live/trial-starter";
import { alternatesFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "১০ মিনিট ফ্রি ট্রায়াল — লাইভ খামার",
  description: "কার্ড ছাড়াই ১০ মিনিটের ফ্রি ট্রায়ালে সব লাইভ ক্যামেরা দেখুন।",
  alternates: alternatesFor("/live/trial"),
  robots: { index: false, follow: true },
};

export default async function TrialPage() {
  const plans = await listPlans(true);
  const cheapest = plans.reduce((min, p) => (p.price < min.price ? p : min), plans[0]);

  return (
    <div className="container-x max-w-3xl py-12 sm:py-16">
      <div className="mb-6 text-center">
        <span className="eyebrow mb-3">ফ্রি ট্রায়াল</span>
        <h1 className="text-[26px] font-bold leading-tight sm:text-[34px]">
          ১০ মিনিট — নিজের চোখে দেখুন
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[13.5px] leading-relaxed text-sand-100/60">
          কোনো কার্ড, কোনো সাইন-আপ নেই। বাটনে চাপ দিলেই সব খামারের লাইভ ক্যামেরা ১০ মিনিটের জন্য খুলে যাবে।
        </p>
      </div>

      <TrialStarter />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: "🎥", title: "সব ক্যামেরা", body: "ট্রায়ালেও সব খামারের ক্যামেরা দেখা যায়" },
          { icon: "⏱️", title: "১০ মিনিট", body: "স্বয়ংক্রিয়ভাবে শেষ হবে, চার্জ নেই" },
          { icon: "🔁", title: "একবারই", body: "প্রতি ডিভাইসে একবার ফ্রি ট্রায়াল" },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center">
            <span className="text-lg">{item.icon}</span>
            <p className="mt-1.5 text-[12.5px] font-bold text-white">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-sand-100/50">{item.body}</p>
          </div>
        ))}
      </div>

      {cheapest && (
        <p className="mt-8 text-center text-[12px] text-sand-100/45">
          ট্রায়াল শেষ হলে চালিয়ে যেতে চান?{" "}
          <Link href="/live/plans" className="font-semibold text-mint hover:underline">
            ৳{cheapest.price} থেকে প্রিমিয়াম নিন →
          </Link>
        </p>
      )}
    </div>
  );
}
