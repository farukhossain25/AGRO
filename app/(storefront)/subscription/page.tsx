import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CreditCard, PauseCircle, Sparkles, Truck, XCircle } from "lucide-react";
import { getPackages } from "@/lib/data";
import { Accordion, SectionHeader } from "@/components/ui";
import { SubscriptionForm } from "@/components/subscription-form";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

export const revalidate = 300;

/* Built-in copy is the fallback; /admin/seo can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/subscription", {
    title: "মাসিক ফুড সাবস্ক্রিপশন",
    description:
      "২–৩, ৪–৫ ও ৬+ সদস্যের পরিবারের জন্য মাসিক ফুড প্যাকেজ। সপ্তাহে তাজা সবজি, ডিম, মাছ ও দুধ আপনার দরজায়। যেকোনো সময় পজ বা বাতিল করুন।",
    alternates: alternatesFor("/subscription"),
    openGraph: { title: "মাসিক ফুড সাবস্ক্রিপশন | বিশ্বাস এগ্রো", url: "/subscription" },
  });
}

const benefits = [
  { Icon: CalendarClock, t: "নিজের সুবিধামতো শুরুর তারিখ", d: "আজ থেকে ৩০ দিনের মধ্যে যেকোনো দিন বেছে নিন" },
  { Icon: PauseCircle, t: "যেকোনো সময় পজ", d: "বাড়ি ছেড়ে গেলে এক ক্লিকে পজ করুন" },
  { Icon: CreditCard, t: "মাসে একবার পেমেন্ট", d: "ক্যাশ, বিকাশ বা কার্ডে সুবিধামতো" },
  { Icon: Truck, t: "ফ্রি ডেলিভারি", d: "সব ডেলিভারিতে কোনো চার্জ নেই" },
  { Icon: XCircle, t: "কোনো লক-ইন নেই", d: "যখন খুশি বাতিল করুন, কোনো জরিমানা নেই" },
];

const faqs = [
  {
    q: "সাবস্ক্রিপশন কীভাবে কাজ করে?",
    a: "আপনি প্যাকেজ বেছে নিয়ে শুরুর তারিখ ও ডেলিভারির ফ্রিকোয়েন্সি ঠিক করবেন। এরপর প্রতি সপ্তাহ/পক্ষে আপনার ঠিকানায় নির্দিষ্ট দিনে বক্স পৌঁছে যাবে। পেমেন্ট মাসিক ভিত্তিতে।",
  },
  {
    q: "এক সপ্তাহের জন্য বন্ধ রাখতে চাইলে কী করব?",
    a: "আপনার অ্যাকাউন্ট ড্যাশবোর্ড থেকে “পজ” বাটনে চাপ দিলে পরবর্তী ডেলিভারি স্থগিত হবে। আমরা সেই সপ্তাহের চার্জ কাটব না।",
  },
  {
    q: "পছন্দ না হলে বাতিল করা যাবে?",
    a: "অবশ্যই। যেকোনো সময় বাতিল করা যাবে। চলতি মাসের ইতিমধ্যে ডেলিভারি হওয়া বক্সের টাকা ফেরত হয় না, কিন্তু পরবর্তী কোনো চার্জ হবে না।",
  },
  {
    q: "প্যাকেজে কোনো সবজি অ্যালার্জি থাকলে?",
    a: "সাবস্ক্রিপশন নোটে লিখুন — আমরা সেই পণ্যটি বাদ দিয়ে সমপরিমাণ অন্য সবজি যোগ করে দেব।",
  },
  {
    q: "ঢাকার বাইরে কি সাবস্ক্রিপশন পাওয়া যায়?",
    a: "হ্যাঁ, সব জেলায় পাওয়া যায় — তবে ডেলিভারি ফ্রিকোয়েন্সি সপ্তাহে ১–২ বার হতে পারে (ঢাকায় সপ্তাহে ৩ দিন)।",
  },
];

export default async function SubscriptionPage() {
  const packages = await getPackages();

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-leaf-radial" />
        <div className="container-x py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow mb-4">
              <Sparkles className="h-3.5 w-3.5" /> মাসিক ফুড সাবস্ক্রিপশন
            </span>
            <h1 className="text-[28px] font-bold leading-tight sm:text-[42px]">
              পুরো মাসের তাজা খাবার,
              <br />
              <span className="bg-gradient-to-r from-leaf-200 to-leaf-500 bg-clip-text text-transparent">
                একবার সিদ্ধান্তেই
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[14.5px] leading-relaxed text-sand-100/60">
              বাজার করার ঝামেলা ভুলে যান। আপনার পরিবারের আকার অনুযায়ী প্যাকেজ বেছে নিন — প্রতি
              সপ্তাহে তাজা সবজি, ডিম, মাছ ও দুধ পৌঁছে যাবে আপনার রান্নাঘরে। যেকোনো সময় পজ বা বাতিল।
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {benefits.map(({ Icon, t, d }) => (
              <div key={t} className="card flex flex-col gap-2 p-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf-600/15 text-leaf-300">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-[12px] font-semibold leading-snug">{t}</p>
                <p className="text-[10.5px] leading-relaxed text-sand-100/45">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container-x">
        <SubscriptionForm packages={packages} />

        <section className="section">
          <SectionHeader
            eyebrow="সাধারণ প্রশ্ন"
            title="সাবস্ক্রিপশন নিয়ে প্রশ্ন আছে?"
            subtitle="নিচের প্রশ্নগুলোর উত্তর না পেলে আমাদের হোয়াটসঅ্যাপে মেসেজ করুন — ৫ মিনিটে উত্তর পাবেন।"
          />
          <Accordion items={faqs.map((f) => ({ q: f.q, a: f.a }))} />
          <div className="mt-6 text-center">
            <Link href="/contact" className="btn-ghost">আরও সাহায্য দরকার?</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
