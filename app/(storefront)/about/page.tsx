import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart, Leaf, Target, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { site } from "@/lib/site";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

/* Built-in copy is the fallback; the panel’s SEO screen can override it per route
   without a deploy (migration 0006). */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/about", {
    title: "আমাদের সম্পর্কে",
    description:
      "বিশ্বাস এগ্রো — ২০২১ সাল থেকে বাংলাদেশের কৃষকদের কাছ থেকে সরাসরি তাজা ও নিরাপদ খাবার পরিবারের কাছে পৌঁছে দিচ্ছে। আমাদের গল্প, মিশন ও মূল্যবোধ।",
    alternates: alternatesFor("/about"),
    openGraph: { title: "আমাদের সম্পর্কে | বিশ্বাস এগ্রো", url: "/about" },
  });
}

const values = [
  { icon: Leaf, title: "বিশুদ্ধতা", body: "যদি নিজের পরিবারকে খাওয়াতে না পারি, সেটি আমরা বিক্রি করি না।" },
  { icon: Heart, title: "সততা", body: "পণ্যের ঘাটতি থাকলে আগেই জানাই — লুকিয়ে বিক্রি করি না।" },
  { icon: Users, title: "কৃষকের পাশে", body: "ন্যায্য দাম, সময়মতো পেমেন্ট এবং কৃষি পরামর্শ — সব একসাথে।" },
  { icon: Target, title: "স্বচ্ছতা", body: "প্রতিটি পণ্যের উৎস, তারিখ ও ব্যাচ নম্বর প্রকাশ্যে থাকে।" },
];

const timeline = [
  { year: "২০২১", title: "শুরু", body: "ঢাকার ধানমন্ডিতে একটি ছোট গুদাম ও ৬ জন কৃষক নিয়ে যাত্রা শুরু।" },
  { year: "২০২২", title: "১,০০০ পরিবার", body: "প্রথম বছরের শেষে ১,০০০ পরিবার নিয়মিত গ্রাহক হয়ে ওঠে। মাসিক প্যাকেজ চালু।" },
  { year: "২০২৩", title: "ঢাকার বাইরে", body: "চট্টগ্রাম, সিলেট ও খুলনায় ডেলিভারি শুরু। কোল্ড-চেইন গুদাম স্থাপন।" },
  { year: "২০২৪", title: "কৃষক নেটওয়ার্ক", body: "২৩০+ কৃষক পরিবার, ১২ জেলা, প্রতি মাসে ৪,০০০+ অর্ডার।" },
  { year: "২০২৬", title: "আজ", body: "সারাদেশে ডেলিভারি, নিজস্ব অ্যাপ ও ট্রেসেবিলিটি সিস্টেম চালু।" },
];

export default function AboutPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 -z-10">
          <Image src="/images/cat/vegetables.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/70 to-ink-900" />
        </div>
        <div className="container-x py-14 sm:py-20">
          <span className="eyebrow mb-4">আমাদের গল্প</span>
          <h1 className="max-w-3xl text-[28px] font-bold leading-tight sm:text-[42px]">
            “{site.taglineBn}”
          </h1>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-sand-100/65">
            বিশ্বাস এগ্রো শুরু হয়েছিল একটি সহজ প্রশ্ন থেকে — ঢাকায় থাকা আমাদের পরিবারগুলোর
            কেন তাজা, নিরাপদ সবজি পাওয়া এত কঠিন? সুপারমার্কেটের প্লাস্টিক-মোড়া সবজি, বাজারের
            অজানা কেমিক্যাল আর মধ্যস্বত্বভোগীর দাপট — এর মধ্যে সত্যিই নিরাপদ খাবার কোথায়?
          </p>
        </div>
      </section>

      <section className="section container-x">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeader eyebrow="কেন আমরা" title="আমরা কী আলাদা করি" />
            <div className="space-y-3.5">
              {values.map(({ icon: Icon, title, body }) => (
                <div key={title} className="card flex gap-3.5 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold">{title}</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/55">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/[0.08]">
            <Image
              src="/images/hero/farm.jpg"
              alt="বিশ্বাস এগ্রোর খামার"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-transparent" />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-ink-950/70 p-4 backdrop-blur">
              <p className="text-[12px] leading-relaxed text-sand-100/80">
                “আমরা বিশ্বাস করি — ভালো খাবার কোনো বিলাসিতা নয়, এটি প্রতিটি পরিবারের অধিকার।”
              </p>
              <p className="mt-2 text-[11px] font-semibold text-leaf-300">— বিশ্বাস এগ্রো প্রতিষ্ঠাতা</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section container-x">
        <SectionHeader eyebrow="যাত্রা" title="আমাদের পথচলা" align="center" />
        <ol className="relative mx-auto max-w-2xl">
          <span className="absolute left-3 top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-leaf-500/60 to-transparent" aria-hidden />
          {timeline.map((t) => (
            <li key={t.year} className="relative flex gap-4 pb-5 last:pb-0">
              <span className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-600 text-[9px] font-bold text-white">
                ●
              </span>
              <div className="card flex-1 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-leaf-300">{t.year}</p>
                <h3 className="mt-0.5 text-[14px] font-semibold">{t.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/55">{t.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x pb-14">
        <div className="card grid gap-4 p-6 sm:grid-cols-4 sm:p-8">
          {[
            { v: "৪,০০০+", l: "মাসিক অর্ডার" },
            { v: "২,৪০০+", l: "সন্তুষ্ট পরিবার" },
            { v: "২৩০+", l: "কৃষক পরিবার" },
            { v: "৪.৯/৫", l: "গড় রেটিং" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-2xl font-bold text-leaf-200">{s.v}</p>
              <p className="mt-0.5 text-[11px] text-sand-100/50">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/farm" className="btn-primary">খামার দেখুন</Link>
          <Link href="/products" className="btn-ghost">পণ্য দেখুন</Link>
          <Link href="/contact" className="btn-ghost">যোগাযোগ</Link>
        </div>
      </section>
    </div>
  );
}
