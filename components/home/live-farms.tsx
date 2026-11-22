import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Radio, Video } from "lucide-react";
import { listFarms } from "@/lib/farms";

/* ==========================================================================
   LiveFarmsStrip — homepage teaser for the premium CCTV feature
   ========================================================================== */

const TYPE_BN: Record<string, string> = {
  vegetables: "শাকসবজি",
  dairy: "দুগ্ধ",
  poultry: "মুরগি ও ডিম",
  fish: "মাছ",
  fruits: "ফল",
};

export async function LiveFarmsStrip() {
  const farms = await listFarms({ limit: 4 });
  if (!farms.length) return null;

  const online = farms.reduce((n, f) => n + (f.online_cameras ?? 0), 0);

  return (
    <section className="border-y border-white/[0.06] bg-gradient-to-b from-ink-850/60 to-ink-900">
      <div className="container-x py-12 sm:py-16">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow mb-3">
              <Radio className="h-3.5 w-3.5" /> লাইভ ফার্ম
            </span>
            <h2 className="h-section">
              নিজের চোখে দেখুন — <span className="text-leaf-400">খামারে কী হচ্ছে</span>
            </h2>
            <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-sand-100/60">
              {bn(online)}টি ক্যামেরা এখন লাইভ। সবজি তোলা, গাভীর দোহন, ডিম বাছাই — সবকিছু সম্পাদনাহীন।
            </p>
          </div>
          <Link href="/live" className="btn-ghost btn-sm shrink-0 self-start sm:self-auto">
            সব খামার দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {farms.map((farm) => (
            <Link
              key={farm.id}
              href={`/live/farms/${farm.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-mint/40"
            >
              <Image
                src={farm.cover || "/images/hero/farm.jpg"}
                alt={farm.name_bn}
                fill
                sizes="(max-width:640px) 50vw, 25vw"
                className="object-cover opacity-65 transition duration-500 group-hover:scale-105 group-hover:opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />

              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                <span className="relative flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-white" />
                </span>
                লাইভ
              </span>

              <div className="absolute inset-x-2 bottom-2">
                <p className="text-[11.5px] font-bold leading-tight text-white drop-shadow">{farm.name_bn}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-white/65">
                  <Video className="h-2.5 w-2.5" />
                  {bn(farm.online_cameras ?? 0)} ক্যামেরা · {TYPE_BN[farm.type]}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-mint/20 bg-leaf-900/20 px-4 py-3">
          <p className="flex-1 text-[12px] leading-relaxed text-sand-100/65">
            <span className="font-semibold text-mint">১০ মিনিট ফ্রি</span> — কার্ড ছাড়াই সব ক্যামেরা দেখুন।
          </p>
          <Link href="/live/trial" className="btn-mint btn-sm shrink-0">
            ফ্রি ট্রায়াল
          </Link>
        </div>
      </div>
    </section>
  );
}

function bn(n: number): string {
  return String(n ?? 0).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
