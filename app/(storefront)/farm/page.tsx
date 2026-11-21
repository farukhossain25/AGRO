import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, Leaf, MapPin, ShieldCheck, Sprout, Truck, Users } from "lucide-react";
import { getFarmers } from "@/lib/data";
import { SectionHeader } from "@/components/ui";
import { site } from "@/lib/site";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "আমাদের খামার ও কৃষক",
  description:
    "বিশ্বাস এগ্রো ২৩০+ কৃষক পরিবারের সাথে সরাসরি কাজ করে। জানুন আমাদের খামার, সংগ্রহ প্রক্রিয়া, গুণমান পরীক্ষা ও সার্টিফিকেশন সম্পর্কে।",
  alternates: { canonical: "/farm" },
  openGraph: { title: "খামার থেকে টেবিল | বিশ্বাস এগ্রো", url: "/farm" },
};

const journey = [
  { time: "ভোর ৫:০০", title: "মাঠে সংগ্রহ", body: "কৃষক নিজ হাতে সবজি তোলেন — পাকা ও কচি বেছে নিয়ে, কোনো রাসায়নিক স্প্রে ছাড়া।", icon: "🌅" },
  { time: "সকাল ৭:৩০", title: "সংগ্রহ কেন্দ্র", body: "ওজন ও গ্রেডিং হয়; প্রতিটি ক্রেটে কৃষকের নাম ও খামারের আইডি ট্যাগ লাগানো হয়।", icon: "📦" },
  { time: "সকাল ৯:০০", title: "গুণমান পরীক্ষা", body: "প্রতি ব্যাচে পেস্টিসাইড রেসিডিউ ও ফ্রেশনেস টেস্ট। ফেল করলে পুরো ব্যাচ ফেরত।", icon: "🧪" },
  { time: "বেলা ১১:০০", title: "কোল্ড-চেইন প্যাকিং", body: "৪°C ঠান্ডা ঘরে প্যাকিং, ইনসুলেটেড বক্স ও আইস প্যাকে সিল করা হয়।", icon: "❄️" },
  { time: "বিকেল ৩:০০", title: "ডেলিভারি রুট", body: "ঢাকার ৬টি রুটে রাইডার বের হয়; বাইরের জেলায় কুরিয়ার পার্টনারের কাছে হস্তান্তর।", icon: "🛺" },
  { time: "সন্ধ্যা ৭:০০", title: "আপনার দরজায়", body: "বক্সে লেবেল — খামারের নাম, তোলার তারিখ, প্যাকিং তারিখ ও ব্যাচ নম্বর।", icon: "🏠" },
];

const promises = [
  { icon: ShieldCheck, title: "কোনো ক্ষতিকর কেমিক্যাল নেই", body: "প্রতিটি ব্যাচে র‍্যাবিট রেসিডিউ টেস্ট। ফলাফল খারাপ হলে ব্যাচ বাজারে যায় না।" },
  { icon: Award, title: "কৃষকের ন্যায্য দাম", body: "বাজার দরের চেয়ে ২০–৩০% বেশি, সরাসরি মোবাইল ব্যাংকিংয়ে পরিশোধ।" },
  { icon: Leaf, title: "মাটির স্বাস্থ্য", body: "জৈব সার ও ফসল আবর্তন — মাটির উর্বরতা দীর্ঘমেয়াদে টেকসই রাখতে।" },
  { icon: Truck, title: "কোল্ড-চেইন", body: "তোলা থেকে ডেলিভারি পর্যন্ত তাপমাত্রা নিয়ন্ত্রিত, ফ্রেশনেস হার কম।" },
];

export default async function FarmPage() {
  const farmers = await getFarmers();

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image src="/images/hero/farm.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/60 via-ink-900/85 to-ink-900" />
        </div>

        <div className="container-x py-14 sm:py-20">
          <span className="eyebrow mb-4">
            <Sprout className="h-3.5 w-3.5" /> খামার থেকে টেবিল
          </span>
          <h1 className="max-w-3xl text-[28px] font-bold leading-tight sm:text-[42px]">
            যেখানে আপনার খাবারের যাত্রা শুরু হয়
          </h1>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-sand-100/65">
            বাংলাদেশের ২৩০+ কৃষক পরিবারের সাথে আমাদের সম্পর্ক শুধু কেনা-বেচা নয় — এটি একটি
            দীর্ঘমেয়াদি অংশীদারিত্ব। আমরা ন্যায্য দাম দিই, তাঁরা আমাদের দেন তাঁদের জীবনের সেরা ফসল।
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              { value: "২৩০+", label: "কৃষক পরিবার" },
              { value: "১২", label: "জেলা" },
              { value: "৯৮%", label: "টেস্ট পাস রেট" },
              { value: "৮ ঘণ্টা", label: "ঢাকায় ডেলিভারি" },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-2xl font-bold text-leaf-200">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-sand-100/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* journey */}
      <section className="section container-x">
        <SectionHeader
          eyebrow="প্রক্রিয়া"
          title="তোলা থেকে আপনার রান্নাঘর — ৬টি ধাপ"
          subtitle="প্রতিটি ধাপে ট্রেসেবিলিটি রাখা হয়, তাই কোনো সমস্যা হলে আমরা ব্যাচ পর্যন্ত পৌঁছাতে পারি।"
        />

        <div className="relative">
          <div className="absolute left-[19px] top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-leaf-500/60 via-leaf-600/30 to-transparent sm:block" />
          <ol className="space-y-3">
            {journey.map((step) => (
              <li key={step.time} className="card relative flex gap-4 p-4 sm:ml-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-lg">
                  {step.icon}
                </span>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-leaf-300/80">{step.time}</p>
                  <h3 className="mt-0.5 text-[14.5px] font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/55">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* promises */}
      <section className="section container-x">
        <SectionHeader eyebrow="প্রতিশ্রুতি" title="আমাদের চারটি অঙ্গীকার" align="center" />
        <div className="grid gap-3.5 sm:grid-cols-2">
          {promises.map(({ icon: Icon, title, body }) => (
            <article key={title} className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-[14.5px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-sand-100/55">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* farmers */}
      <section className="section container-x">
        <SectionHeader
          eyebrow="কৃষক পরিচিতি"
          title="যাঁদের হাতের ছোঁয়ায় আপনার খাবার"
          subtitle="প্রতিটি পণ্যের পেছনে একজন মানুষ আছেন — তাঁর নাম, গ্রাম ও গল্প জানুন।"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {farmers.map((f) => (
            <article key={f.id} className="card overflow-hidden">
              <div className="grid sm:grid-cols-[160px_1fr]">
                <div className="relative aspect-[4/3] sm:aspect-auto">
                  {f.image ? <Image src={f.image} alt={f.name_bn} fill sizes="200px" className="object-cover" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink-850/60 sm:to-ink-850" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-[15px] font-bold">{f.name_bn}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-leaf-300">
                        <MapPin className="h-3 w-3" /> {f.location_bn}
                      </p>
                    </div>
                    <span className="badge bg-white/[0.06] text-sand-100/60">{f.years}+ বছর</span>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-sand-100/55">{f.story_bn}</p>
                  <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-leaf-300/70">
                    বিশেষত্ব: {f.specialty_bn}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* certifications */}
      <section className="container-x pb-12">
        <div className="card grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span className="eyebrow mb-3">
              <ShieldCheck className="h-3.5 w-3.5" /> গুণমান ও সার্টিফিকেশন
            </span>
            <h2 className="text-xl font-bold sm:text-2xl">স্বচ্ছতা আমাদের সবচেয়ে বড় সার্টিফিকেট</h2>
            <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-sand-100/60">
              <li>• প্রতিটি পণ্যে খামারের নাম, তোলার তারিখ ও ব্যাচ নম্বর সংযুক্ত</li>
              <li>• প্রতি মাসে স্বাধীন ল্যাবে পেস্টিসাইড রেসিডিউ পরীক্ষা</li>
              <li>• বাংলাদেশ ফুড সেফটি অথরিটি (BFSA) নির্দেশনা অনুসরণ</li>
              <li>• কোনো পণ্য ফেরত এলে কৃষক-পর্যন্ত কারণ অনুসন্ধান</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            {["BFSA নির্দেশনা", "জৈব চাষ অনুশীলন", "কোল্ড-চেইন", "ট্রেসেবল ব্যাচ"].map((c) => (
              <span key={c} className="badge bg-leaf-600/15 text-leaf-200">{c}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x pb-14">
        <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-leaf-600/30 bg-gradient-to-r from-leaf-800/40 to-ink-850 p-6 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-lg font-bold">খামার নিজে দেখতে চান?</h2>
            <p className="mt-1 text-[12.5px] text-sand-100/60">
              প্রতি মাসে আমরা গ্রাহকদের নিয়ে খামার ভিজিট আয়োজন করি — যোগ দিতে চাইলে যোগাযোগ করুন।
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/contact" className="btn-mint">যোগাযোগ</Link>
            <a href={`tel:${site.phone}`} className="btn-ghost">কল করুন</a>
          </div>
        </div>
      </section>
    </div>
  );
}
