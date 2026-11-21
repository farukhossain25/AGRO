import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Radio, ShieldCheck, Sprout, Video } from "lucide-react";
import { listFarms, farmTypeLabelBn, farmTypeIcon } from "@/lib/farms";
import { listPlans } from "@/lib/premium";
import { SectionHeader } from "@/components/ui";
import { site } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "লাইভ খামার — নিজের চোখে দেখুন",
  description:
    "বিশ্বাস এগ্রোর খামারে বসানো লাইভ ক্যামেরা দেখুন — সবজি তোলা, গাভীর দোহন, ডিম বাছাই সবকিছু সরাসরি। ১০ মিনিট ফ্রি ট্রায়াল।",
  alternates: { canonical: "/live" },
  openGraph: { title: "লাইভ খামার ক্যামেরা | বিশ্বাস এগ্রো", url: "/live" },
};

export const dynamic = "force-static";

export default async function LiveHubPage() {
  const [farms, plans] = await Promise.all([listFarms({}), listPlans(true)]);
  const online = farms.reduce((n, f) => n + (f.online_cameras ?? 0), 0);
  const cameras = farms.reduce((n, f) => n + (f.camera_count ?? 0), 0);
  const featured = plans.find((p) => p.is_popular) ?? plans[0];

  const byType = farms.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 -z-10">
          <Image src="/images/hero/farm.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/50 via-ink-900/85 to-ink-900" />
        </div>

        <div className="container-x py-14 sm:py-20">
          <span className="eyebrow mb-4">
            <Radio className="h-3.5 w-3.5" /> লাইভ ফার্ম মনিটরিং
          </span>
          <h1 className="max-w-3xl text-[28px] font-bold leading-tight sm:text-[42px]">
            আপনার খাবার কোথা থেকে আসছে — <span className="text-leaf-400">নিজের চোখে দেখুন</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-sand-100/65">
            প্রতিটি খামারে বসানো ক্যামেরা দিয়ে আপনি সরাসরি দেখতে পারবেন সবজি তোলা, গাভীর দোহন, ডিম বাছাই ও
            প্যাকিং। কোনো সম্পাদনা নেই — যা হচ্ছে, তাই দেখছেন।
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/live/trial" className="btn-primary">
              <Video className="h-4 w-4" /> ১০ মিনিট ফ্রি দেখুন
            </Link>
            <Link href="/live/farms" className="btn-ghost">
              সব খামার দেখুন <ArrowRight className="h-4 w-4" />
            </Link>
            {featured && (
              <Link href="/live/plans" className="text-[13px] text-mint/80 underline-offset-4 hover:underline">
                প্রিমিয়াম {formatTaka(featured.price)}/মাস থেকে
              </Link>
            )}
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "লাইভ ক্যামেরা", value: online, suffix: `/${cameras}` },
              { label: "খামার", value: farms.length, suffix: "" },
              { label: "জেলা", value: new Set(farms.map((f) => f.district)).size, suffix: "" },
              { label: "ফ্রি ট্রায়াল", value: 10, suffix: " মিনিট" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <dt className="text-[11px] uppercase tracking-wide text-sand-100/45">{stat.label}</dt>
                <dd className="mt-1 text-xl font-bold text-mint">
                  {toBn(stat.value)}
                  <span className="text-sm font-medium text-sand-100/40">{stat.suffix}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------------- dairy CTA */}
      <section className="container-x py-12">
        <Link
          href="/live/dairy"
          className="group relative block overflow-hidden rounded-2xl border border-mint/20 bg-gradient-to-br from-leaf-900/45 via-ink-800 to-ink-900 p-6 transition hover:border-mint/40 sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-mint/12 px-2.5 py-1 text-[11px] font-semibold text-mint">
                🐄 ডেইরি লাইভ
              </span>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                আজ কত লিটার দুধ এসেছে — লাইভ দেখুন
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-sand-100/60">
                টাঙ্গাইল ডেইরি ফার্মের গোয়ালঘর, দোহন ও কোল্ড রুমের ক্যামেরা একসাথে — সাথে আজকের উৎপাদন ও
                বিক্রির হিসাব।
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-mint px-5 py-2.5 text-sm font-bold text-green-950 transition group-hover:gap-3">
              ডেইরি লাইভ দেখুন <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      </section>

      {/* ------------------------------------------------------------- farms */}
      <section className="container-x pb-14">
        <SectionHeader
          eyebrow="খামার ডিরেক্টরি"
          title="যে খামারগুলো দেখতে পারবেন"
          subtitle="প্রতিটি খামারের কৃষক, অবস্থান, সার্টিফিকেশন ও লাইভ ক্যামেরার সংখ্যা দেখুন।"
          action={
            <Link href="/live/farms" className="text-[13px] font-semibold text-mint hover:underline">
              সব দেখুন →
            </Link>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farms.slice(0, 6).map((farm) => (
            <Link
              key={farm.id}
              href={`/live/farms/${farm.slug}`}
              className="group card overflow-hidden transition hover:-translate-y-0.5 hover:border-leaf-600/40"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={farm.cover || "/images/hero/farm.jpg"}
                  alt={farm.name_bn}
                  fill
                  sizes="(max-width:768px) 100vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/35 to-transparent" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {toBn(farm.online_cameras ?? 0)} লাইভ
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur">
                  {farmTypeIcon[farm.type]} {farmTypeLabelBn[farm.type]}
                </span>
              </div>

              <div className="p-4">
                <h3 className="text-[15px] font-bold text-white group-hover:text-mint">{farm.name_bn}</h3>
                <p className="mt-1 flex items-center gap-1 text-[12px] text-sand-100/50">
                  <MapPin className="h-3 w-3" /> {farm.upazila ? `${farm.upazila}, ` : ""}
                  {farm.district}
                </p>
                <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-sand-100/55">
                  {farm.description_bn}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-sand-100/45">
                    <ShieldCheck className="h-3.5 w-3.5 text-leaf-400" />
                    {farm.certifications?.[0] ?? "যাচাইকৃত খামার"}
                  </span>
                  <span className="text-[11.5px] font-semibold text-mint">
                    {toBn(farm.camera_count ?? 0)} ক্যামেরা
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* type chips */}
        <div className="mt-8 flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => (
            <Link
              key={type}
              href={`/live/farms?type=${type}`}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-sand-100/70 transition hover:border-mint/40 hover:text-mint"
            >
              {farmTypeIcon[type as keyof typeof farmTypeIcon]} {farmTypeLabelBn[type as keyof typeof farmTypeLabelBn]}{" "}
              <span className="text-sand-100/35">({toBn(count)})</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- plans */}
      <section className="border-t border-white/5 bg-ink-800/40 py-14">
        <div className="container-x">
          <SectionHeader
            align="center"
            eyebrow="প্রিমিয়াম"
            title="যেকোনো সময়, যেকোনো ক্যামেরা"
            subtitle="১০ মিনিট ফ্রি ট্রায়াল দিয়ে শুরু করুন — তারপর মাসিক, ষান্মাসিক বা বাৎসরিক প্ল্যান নিন।"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.slice(0, 3).map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-5 ${
                  plan.is_popular ? "border-mint/45 bg-leaf-900/25" : "border-white/8 bg-white/[0.02]"
                }`}
              >
                {plan.is_popular && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-green-950">
                    জনপ্রিয়
                  </span>
                )}
                <h3 className="text-sm font-bold text-white">{plan.name_bn}</h3>
                <p className="mt-2 text-2xl font-bold text-mint">
                  {formatTaka(plan.price)}
                  <span className="text-[12px] font-medium text-sand-100/40">
                    /{plan.interval === "monthly" ? "মাস" : plan.interval === "yearly" ? "বছর" : "৬ মাস"}
                  </span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {(plan.features as string[]).slice(0, 3).map((f) => (
                    <li key={f} className="flex gap-1.5 text-[12px] text-sand-100/60">
                      <Sprout className="mt-0.5 h-3 w-3 shrink-0 text-leaf-400" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-7 text-center">
            <Link href="/live/plans" className="btn-primary">
              সব প্ল্যান ও দাম দেখুন <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- trust */}
      <section className="container-x py-12">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "🔐", title: "ক্যামেরা সোর্স গোপন", body: "RTSP/IP ঠিকানা কখনো ব্রাউজারে যায় না — শুধু ৫ মিনিটের স্বাক্ষরিত টোকেন।" },
            { icon: "👁️", title: "সম্পাদনা নেই", body: "কোনো রেকর্ড করা ভিডিও নয় — প্রতিটি ফ্রেম সরাসরি খামার থেকে আসে।" },
            { icon: "📱", title: "মোবাইলে হালকা", body: "ডেটা বাঁচাতে HLS অ্যাডাপ্টিভ স্ট্রিমিং ও লো-ল্যাটেন্সি মোড।" },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <span className="text-lg">{item.icon}</span>
              <h3 className="mt-2 text-[13px] font-bold text-white">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-sand-100/55">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-sand-100/40">
          প্রশ্ন আছে? কল করুন <a href={`tel:${site.phone}`} className="text-mint">{site.phone}</a>
        </p>
      </section>
    </div>
  );
}

function formatTaka(n: number): string {
  return `৳${Number(n).toLocaleString("en-IN")}`;
}

function toBn(n: number): string {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
