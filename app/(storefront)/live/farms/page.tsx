import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { listFarms, farmTypeLabelBn, farmTypeIcon } from "@/lib/farms";
import { FarmDirectory } from "@/components/live/farm-directory";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "খামার ডিরেক্টরি — লাইভ ক্যামেরা",
  description: "বাংলাদেশের বিভিন্ন জেলার বিশ্বাস এগ্রো খামার দেখুন — লাইভ ক্যামেরা, কৃষকের তথ্য ও সার্টিফিকেশন।",
  alternates: { canonical: "/live/farms" },
};

const TYPES = ["all", "vegetables", "dairy", "poultry", "fish", "fruits"] as const;

export default async function FarmDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; district?: string }>;
}) {
  const params = await searchParams;
  const type = TYPES.includes((params.type ?? "all") as (typeof TYPES)[number])
    ? ((params.type ?? "all") as (typeof TYPES)[number])
    : "all";

  const [farms, allFarms] = await Promise.all([
    listFarms({ type, search: params.q, district: params.district }),
    listFarms({}),
  ]);

  const districts = Array.from(new Set(allFarms.map((f) => f.district))).sort();

  return (
    <div className="container-x py-10 sm:py-14">
      <nav className="mb-5 flex items-center gap-1.5 text-[12px] text-sand-100/40">
        <Link href="/live" className="hover:text-mint">
          লাইভ
        </Link>
        <span>/</span>
        <span className="text-sand-100/70">খামার ডিরেক্টরি</span>
      </nav>

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">খামার ডিরেক্টরি</h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-sand-100/55">
            {toBn(farms.length)}টি খামার — ম্যাপে অবস্থান দেখুন, কৃষকের সাথে পরিচিত হন, লাইভ ক্যামেরা চালু করুন।
          </p>
        </div>

        <form action="/live/farms" className="flex w-full gap-2 sm:w-auto">
          {type !== "all" && <input type="hidden" name="type" value={type} />}
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="খামার বা জেলা খুঁজুন…"
              className="input pl-9"
              aria-label="খামার খুঁজুন"
            />
          </div>
          <button type="submit" className="btn-primary btn-sm shrink-0">
            খুঁজুন
          </button>
        </form>
      </div>

      {/* type chips */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1.5">
        {TYPES.map((t) => {
          const href =
            t === "all"
              ? "/live/farms"
              : `/live/farms?type=${t}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`;
          return (
            <Link
              key={t}
              href={href}
              className={`chip shrink-0 whitespace-nowrap ${type === t ? "chip-active" : ""}`}
            >
              {t === "all" ? "🗺️ সব খামার" : `${farmTypeIcon[t]} ${farmTypeLabelBn[t]}`}
            </Link>
          );
        })}
      </div>

      {/* district chips */}
      {districts.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[11px] text-sand-100/35">জেলা:</span>
          {districts.map((d) => {
            const active = params.district === d;
            const href = active
              ? `/live/farms${type !== "all" ? `?type=${type}` : ""}`
              : `/live/farms?district=${encodeURIComponent(d)}${type !== "all" ? `&type=${type}` : ""}`;
            return (
              <Link
                key={d}
                href={href}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                  active
                    ? "border-mint/60 bg-mint/15 text-mint"
                    : "border-white/8 text-sand-100/55 hover:border-mint/35 hover:text-mint"
                }`}
              >
                <MapPin className="mr-0.5 inline h-2.5 w-2.5" />
                {d}
              </Link>
            );
          })}
        </div>
      )}

      <FarmDirectory farms={farms} />

      {farms.length === 0 && (
        <div className="card mt-6 p-10 text-center">
          <p className="text-2xl">🔍</p>
          <p className="mt-3 text-sm text-sand-100/70">কোনো খামার পাওয়া যায়নি</p>
          <Link href="/live/farms" className="btn-ghost btn-sm mt-4">
            ফিল্টার মুছুন
          </Link>
        </div>
      )}
    </div>
  );
}

function toBn(n: number): string {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
