import type { Metadata } from "next";
import Link from "next/link";
import { Check, HelpCircle, Sparkles } from "lucide-react";
import { listPlans, intervalLabelBn, tierLabelBn, getPremiumSettings } from "@/lib/premium";
import { currentUser } from "@/lib/api";
import { PlanCheckout } from "@/components/live/plan-checkout";
import { RedeemCode } from "@/components/live/redeem-code";
import { alternatesFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "প্রিমিয়াম প্ল্যান ও দাম",
  description:
    "লাইভ খামার ক্যামেরার প্রিমিয়াম প্ল্যান — মাসিক ৳১৪৯ থেকে বাৎসরিক পর্যন্ত। bKash, Nagad, SSLCommerz বা অ্যাক্সেস কোড দিয়ে পেমেন্ট।",
  alternates: alternatesFor("/live/plans"),
};

const FAQ = [
  {
    q: "প্রিমিয়ামে ঠিক কী পাওয়া যায়?",
    a: "সব খামারের সব লাইভ ক্যামেরা, ২ডি ও ৩ডি ম্যাপ, ডেইরি উৎপাদন ড্যাশবোর্ড এবং অর্ডারের খামার-সোর্স ট্রেসেবিলিটি। বেসিক প্ল্যানে প্রতি খামারের প্রথম ক্যামেরা দেখা যায়।",
  },
  {
    q: "একসাথে কতটি ডিভাইসে চলবে?",
    a: "বেসিক ১টি, ফুল মাসিক ২টি, বাৎসরিক ৩টি। নতুন ডিভাইসে লগইন করলে সবচেয়ে পুরোনো ডিভাইস স্বয়ংক্রিয়ভাবে বাদ যায় না — অ্যাকাউন্ট সেটিংস থেকে সরাতে হবে।",
  },
  {
    q: "মেয়াদ শেষ হলে কী হয়?",
    a: "৩ দিনের গ্রেস পিরিয়ড থাকে, ততক্ষণ অ্যাক্সেস চালু থাকে এবং রিনিউ করার রিমাইন্ডার আসে। এরপর ক্যামেরা লক হয়ে যায়, তবে অর্ডার ও অ্যাকাউন্ট স্বাভাবিক থাকে।",
  },
  {
    q: "টাকা ফেরত পাওয়া যাবে?",
    a: "প্রথম ৭ দিনের মধ্যে ব্যবহার না করলে সম্পূর্ণ রিফান্ড — বিস্তারিত রিফান্ড পলিসিতে।",
  },
];

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string; failed?: string }>;
}) {
  const [plans, user, params, settings] = await Promise.all([
    listPlans(true),
    currentUser().catch(() => null),
    searchParams,
    getPremiumSettings(),
  ]);

  const monthly = plans.filter((p) => p.interval === "monthly");
  const longTerm = plans.filter((p) => p.interval !== "monthly");

  return (
    <div className="container-x py-10 sm:py-14">
      {params.activated && (
        <div className="mb-6 rounded-xl border border-mint/35 bg-leaf-900/35 p-4 text-center">
          <p className="text-[13.5px] font-bold text-mint">🎉 পেমেন্ট সফল — আপনার প্রিমিয়াম সক্রিয় হয়েছে</p>
          <Link href="/live/farms" className="mt-1 inline-block text-[12px] text-mint/80 hover:underline">
            এখনই লাইভ ক্যামেরা দেখুন →
          </Link>
        </div>
      )}
      {params.failed && (
        <div className="mb-6 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-center text-[13px] text-red-200">
          পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন বা সাপোর্টে কল করুন।
        </div>
      )}

      <header className="mb-8 text-center">
        <span className="eyebrow mb-3">
          <Sparkles className="h-3.5 w-3.5" /> প্রিমিয়াম
        </span>
        <h1 className="text-[26px] font-bold leading-tight sm:text-[36px]">আপনার প্ল্যান বেছে নিন</h1>
        <p className="mx-auto mt-3 max-w-xl text-[13.5px] leading-relaxed text-sand-100/60">
          যেকোনো সময় বাতিল করুন। {bn(settings.trial_minutes)} মিনিট ফ্রি ট্রায়াল আগেই নিতে পারেন —{" "}
          <Link href="/live/trial" className="text-mint hover:underline">
            এখানে
          </Link>
          ।
        </p>
      </header>

      {/* monthly tier cards */}
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        {monthly.map((plan) => (
          <article
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.is_popular
                ? "border-mint/50 bg-gradient-to-b from-leaf-900/40 to-ink-850 shadow-glow"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            {plan.is_popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-mint px-3 py-0.5 text-[10.5px] font-bold text-green-950">
                সবচেয়ে জনপ্রিয়
              </span>
            )}
            <p className="text-[11px] uppercase tracking-wide text-sand-100/40">{tierLabelBn[plan.tier]}</p>
            <h2 className="mt-1 text-lg font-bold text-white">{plan.name_bn}</h2>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-3xl font-bold text-mint">৳{plan.price}</span>
              {plan.compare_price ? (
                <span className="pb-1 text-[13px] text-sand-100/35 line-through">৳{plan.compare_price}</span>
              ) : null}
              <span className="pb-1 text-[12px] text-sand-100/40">/মাস</span>
            </div>

            <ul className="mt-5 flex-1 space-y-2">
              {(plan.features as string[]).map((feature) => (
                <li key={feature} className="flex gap-2 text-[12.5px] leading-relaxed text-sand-100/65">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-400" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <PlanCheckout plan={plan} signedIn={Boolean(user)} />
            </div>
          </article>
        ))}
      </div>

      {/* long-term savings */}
      <h2 className="mb-3 mt-12 text-center text-[15px] font-bold text-white">দীর্ঘমেয়াদে সাশ্রয় করুন</h2>
      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {longTerm.map((plan) => {
          const perMonth = Math.round(plan.price / (plan.duration_days / 30));
          const saving = plan.compare_price
            ? Math.round(((plan.compare_price - plan.price) / plan.compare_price) * 100)
            : 0;
          return (
            <div key={plan.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-sand-100/40">{intervalLabelBn[plan.interval]}</p>
                  <h3 className="text-[14px] font-bold text-white">{plan.name_bn}</h3>
                </div>
                {saving > 0 && (
                  <span className="rounded-full bg-leaf-600/20 px-2 py-0.5 text-[10.5px] font-bold text-leaf-200">
                    {bn(saving)}% সাশ্রয়
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl font-bold text-mint">
                ৳{plan.price}
                <span className="ml-1 text-[12px] font-medium text-sand-100/40">
                  (মাসে ৳{bn(perMonth)})
                </span>
              </p>
              <p className="mt-1 text-[11.5px] text-sand-100/45">
                {bn(plan.duration_days)} দিন · {bn(plan.max_devices)}টি ডিভাইস
              </p>
              <div className="mt-4">
                <PlanCheckout plan={plan} signedIn={Boolean(user)} compact />
              </div>
            </div>
          );
        })}
      </div>

      {/* redeem */}
      <div className="mx-auto mt-10 max-w-md">
        <RedeemCode signedIn={Boolean(user)} />
      </div>

      {/* faq */}
      <section className="mx-auto mt-14 max-w-2xl">
        <h2 className="mb-4 flex items-center justify-center gap-2 text-[16px] font-bold text-white">
          <HelpCircle className="h-4 w-4 text-mint" /> সাধারণ প্রশ্ন
        </h2>
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-white/8 bg-white/[0.02] p-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-[13px] font-semibold text-white">
                {item.q}
                <span className="text-mint transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[12.5px] leading-relaxed text-sand-100/60">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-[12px] text-sand-100/40">
          আরও প্রশ্ন?{" "}
          <Link href="/faq" className="text-mint hover:underline">
            পূর্ণ FAQ
          </Link>{" "}
          ·{" "}
          <Link href="/contact" className="text-mint hover:underline">
            যোগাযোগ
          </Link>
        </p>
      </section>
    </div>
  );
}

function bn(n: number): string {
  return String(n ?? 0).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
