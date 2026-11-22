import type { Metadata } from "next";
import Link from "next/link";
import { Milk, ThermometerSun, TrendingUp } from "lucide-react";
import { getDairyFarms } from "@/lib/farms";
import { DairyBoard } from "@/components/live/dairy-board";
import { alternatesFor } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "ডেইরি লাইভ — আজকের দুধ উৎপাদন",
  description:
    "টাঙ্গাইল ডেইরি ফার্মের গোয়ালঘর লাইভ দেখুন এবং আজ কত লিটার দুধ এসেছে, কত বিক্রি হয়েছে তার রিয়েল-টাইম হিসাব।",
  alternates: alternatesFor("/live/dairy"),
};

export default async function DairyLivePage() {
  const farms = await getDairyFarms();

  const totals = farms.reduce(
    (acc, f) => {
      const out = (f.daily_output ?? {}) as Record<string, number>;
      acc.cows += Number(out.cows ?? 0);
      acc.litres += Number(out.litres_today ?? 0);
      acc.sold += Number(out.sold_today ?? 0);
      return acc;
    },
    { cows: 0, litres: 0, sold: 0 }
  );

  return (
    <div className="container-x py-10 sm:py-14">
      <nav className="mb-5 flex items-center gap-1.5 text-[12px] text-sand-100/40">
        <Link href="/live" className="hover:text-mint">লাইভ</Link>
        <span>/</span>
        <span className="text-sand-100/70">ডেইরি লাইভ</span>
      </nav>

      <header className="mb-8">
        <span className="eyebrow mb-3">
          <Milk className="h-3.5 w-3.5" /> ডেইরি মনিটরিং
        </span>
        <h1 className="text-[26px] font-bold leading-tight sm:text-[36px]">
          আজ খামার থেকে কত দুধ এলো
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-sand-100/60">
          সংখ্যাগুলো খামার ম্যানেজার দিনে দুবার হালনাগাদ করেন, আর বিক্রির হিসাব সরাসরি আজকের অর্ডার থেকে আসে।
          ক্যামেরা চালু করতে নিচের যেকোনো কার্ডে ক্লিক করুন।
        </p>
      </header>

      {/* top totals */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[
          { label: "মোট গাভী", value: totals.cows, suffix: "টি", icon: Milk },
          { label: "আজকের উৎপাদন", value: totals.litres, suffix: "লিটার", icon: TrendingUp },
          { label: "এখনো বাকি", value: Math.max(0, totals.litres - totals.sold), suffix: "লিটার", icon: ThermometerSun },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <stat.icon className="h-4 w-4 text-mint" />
            <p className="mt-2 text-[10.5px] uppercase tracking-wide text-sand-100/40">{stat.label}</p>
            <p className="mt-0.5 text-xl font-bold text-mint">
              {bn(stat.value)}
              <span className="ml-1 text-[11px] font-medium text-sand-100/40">{stat.suffix}</span>
            </p>
          </div>
        ))}
      </div>

      <DairyBoard farms={farms} />

      <section className="mt-10 rounded-2xl border border-mint/20 bg-leaf-900/20 p-6">
        <h2 className="text-[15px] font-bold text-white">দুধ কেনার আগে যা জানা দরকার</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "প্রতিটি গাভীর দুধ আলাদা ফ্যাট টেস্ট করা হয় — গড় ফ্যাট ৪.২%।",
            "দোহনের পর ৩০ মিনিটের মধ্যে ৪°C কোল্ড চেইনে ঢোকানো হয়।",
            "কোনো বুস্টার, হরমোন বা অ্যান্টিবায়োটিক ব্যবহার করা হয় না।",
            "প্রতিদিন সকাল ৭টার মধ্যে অর্ডার দিলে একই দিনে ডেলিভারি।",
          ].map((line) => (
            <li key={line} className="flex gap-2 text-[12.5px] leading-relaxed text-sand-100/65">
              <span className="text-leaf-400">✓</span> {line}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/categories/dairy" className="btn-primary btn-sm">
            দুধ ও দুগ্ধ পণ্য অর্ডার করুন
          </Link>
          <Link href="/live/plans" className="btn-ghost btn-sm">
            লাইভ ক্যামেরা আনলক করুন
          </Link>
        </div>
      </section>
    </div>
  );
}

function bn(n: number): string {
  return String(Math.round(n ?? 0)).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
