import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Phone, ShieldCheck, Sprout, Users, Video } from "lucide-react";
import { getFarmBySlug, farmTypeLabelBn } from "@/lib/farms";
import { FarmCameras } from "@/components/live/farm-cameras";
import { FarmDetailMap } from "@/components/live/farm-detail-map";
import { breadcrumbLd, dynamicAlternates, jsonLdScript } from "@/lib/seo";
import { site } from "@/lib/site";

/* Dynamic on purpose: the farm page reads the session for the premium camera
   gate, so prerendering it would flip to dynamic anyway — and prerendering it
   means every farm is rendered during the build, where a slow/blocked Supabase
   connection burns the 60-second static-render budget. The data layer caches
   farms for 5 minutes, so this is still cheap. */
export const dynamic = "force-dynamic";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const farm = await getFarmBySlug(slug);
  if (!farm) return { title: "খামার পাওয়া যায়নি" };

  return {
    title: `${farm.name_bn} — লাইভ ক্যামেরা`,
    description: farm.description_bn ?? `${farm.district} জেলার ${farm.name_bn}।`,
    alternates: dynamicAlternates(`/live/farms/${farm.slug}`),
    openGraph: {
      title: farm.name_bn,
      description: farm.description_bn ?? "",
      url: `/live/farms/${farm.slug}`,
      images: farm.cover ? [{ url: farm.cover }] : undefined,
    },
  };
}

export default async function FarmDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const farm = await getFarmBySlug(slug);
  if (!farm) notFound();

  const output = (farm.daily_output ?? {}) as Record<string, number | string>;
  const cameras = farm.cameras ?? [];

  /* Farm markup: LocalBusiness with the farmer as founder (Person), plus a
     breadcrumb. Coordinates come from the farm record so Google Maps can place
     the pin; no personal phone number is exposed. */
  const farmLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${site.url}/live/farms/${farm.slug}#farm`,
        name: farm.name_bn,
        url: `${site.url}/live/farms/${farm.slug}`,
        image: farm.cover
          ? farm.cover.startsWith("http") ? farm.cover : `${site.url}${farm.cover}`
          : `${site.url}/images/hero/farm.jpg`,
        description: farm.description_bn ?? farm.story_bn ?? undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: farm.address_bn ?? undefined,
          addressLocality: farm.district,
          addressRegion: farm.division,
          addressCountry: "BD",
        },
        ...(farm.lat && farm.lng
          ? { geo: { "@type": "GeoCoordinates", latitude: farm.lat, longitude: farm.lng } }
          : {}),
        ...(farm.owner_name_bn
          ? { founder: { "@type": "Person", name: farm.owner_name_bn } }
          : {}),
        parentOrganization: { "@id": `${site.url}/#organization` },
        isPartOf: { "@id": `${site.url}/#organization` },
      },
      breadcrumbLd([
        { name: "হোম", href: "/" },
        { name: "লাইভ খামার", href: "/live" },
        { name: farm.name_bn },
      ]),
    ].map((node) => {
      const { "@context": _c, ...rest } = node as Record<string, unknown> & { "@context"?: string };
      return rest;
    }),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(farmLd) }}
      />
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src={farm.cover || "/images/hero/farm.jpg"}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-scrim/55 via-scrim/85 to-scrim" />
        </div>

        <div className="container-x py-10 sm:py-14">
          <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-white/55">
            <Link href="/live" className="hover:text-[#7CE3B4]">লাইভ</Link>
            <span>/</span>
            <Link href="/live/farms" className="hover:text-[#7CE3B4]">খামার</Link>
            <span>/</span>
            <span className="text-white/85">{farm.name_bn}</span>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="eyebrow">{farmTypeLabelBn[farm.type]}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-[#ffb4a8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {toBn(farm.online_cameras ?? 0)} লাইভ ক্যামেরা
                </span>
                {farm.established_year && (
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-white/80">
                    প্রতিষ্ঠিত {toBn(farm.established_year)}
                  </span>
                )}
              </div>

              <h1 className="text-[26px] font-bold leading-tight text-white sm:text-[38px]">{farm.name_bn}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/70">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {farm.address_bn ?? `${farm.district}, বাংলাদেশ`}
                </span>
                {farm.owner_name_bn && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {farm.owner_name_bn}
                  </span>
                )}
              </p>
              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-white/75">{farm.description_bn}</p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="#cameras" className="btn-primary">
                <Video className="h-4 w-4" /> লাইভ দেখুন
              </Link>
              {farm.owner_phone && (
                <a href={`tel:${farm.owner_phone}`} className="btn-ghost">
                  <Phone className="h-4 w-4" /> যোগাযোগ
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- production strip */}
      {Object.keys(output).length > 0 && (
        <section className="border-y border-white/5 bg-ink-800/40">
          <div className="container-x grid grid-cols-2 gap-px py-5 sm:grid-cols-4">
            {[
              { label: "গাভী", value: output.cows, suffix: "টি" },
              { label: "আজকের দুধ", value: output.litres_today, suffix: "লিটার" },
              { label: "বিক্রি হয়েছে", value: output.sold_today, suffix: "লিটার" },
              { label: "সাপ্তাহিক", value: output.litres_week, suffix: "লিটার" },
            ]
              .filter((s) => s.value !== undefined && s.value !== null)
              .map((stat) => (
                <div key={stat.label} className="px-3">
                  <p className="text-[10.5px] uppercase tracking-wide text-sand-100/40">{stat.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-mint">
                    {toBn(Number(stat.value))}
                    <span className="ml-1 text-[11px] font-medium text-sand-100/40">{stat.suffix}</span>
                  </p>
                </div>
              ))}
          </div>
          {output.note_bn && (
            <p className="container-x pb-4 text-[11.5px] text-sand-100/40">🕐 {String(output.note_bn)}</p>
          )}
        </section>
      )}

      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {/* ------------------------------------------------------- cameras */}
          <section id="cameras" className="scroll-mt-24">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <Video className="h-4.5 w-4.5 text-mint" /> লাইভ ক্যামেরা
            </h2>
            <p className="mb-4 text-[12.5px] text-sand-100/50">
              {toBn(cameras.length)}টি ক্যামেরা — ক্লিক করলে স্ট্রিম চালু হবে।
              {cameras.length === 0 && " এই খামারে এখনো ক্যামেরা বসানো হয়নি।"}
            </p>
            <FarmCameras cameras={cameras} farmName={farm.name_bn} cover={farm.cover} />
          </section>

          {/* --------------------------------------------------------- story */}
          {farm.story_bn && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
                <Sprout className="h-4.5 w-4.5 text-mint" /> খামারের গল্প
              </h2>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-sand-100/65">{farm.story_bn}</p>
            </section>
          )}

          {/* --------------------------------------------- harvest calendar */}
          {Array.isArray(farm.harvest_calendar) && farm.harvest_calendar.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <CalendarDays className="h-4.5 w-4.5 text-mint" /> সংগ্রহের ক্যালেন্ডার
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {farm.harvest_calendar.map((entry) => (
                  <div key={entry.month} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <p className="text-[12px] font-semibold text-mint">{entry.month}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {entry.crops.map((crop) => (
                        <span key={crop} className="rounded-full bg-white/6 px-2 py-0.5 text-[11px] text-sand-100/65">
                          {crop}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---------------------------------------------------------- map */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <MapPin className="h-4.5 w-4.5 text-mint" /> খামারের অবস্থান
            </h2>
            <FarmDetailMap farm={farm} height={320} />
          </section>
        </div>

        {/* ------------------------------------------------------- sidebar */}
        <aside className="space-y-4">
          {/* farmer card */}
          <div className="card p-5">
            <div className="flex items-center gap-3">
              {farm.owner_photo ? (
                <Image
                  src={farm.owner_photo}
                  alt={farm.owner_name_bn ?? ""}
                  width={52}
                  height={52}
                  className="h-13 w-13 rounded-full object-cover ring-2 ring-mint/25"
                />
              ) : (
                <div className="grid h-13 w-13 place-items-center rounded-full bg-leaf-600/20 text-lg">👨‍🌾</div>
              )}
              <div>
                <p className="text-[11px] text-sand-100/40">খামারি</p>
                <p className="text-[14px] font-bold text-neu-ink">{farm.owner_name_bn ?? "খামার দল"}</p>
              </div>
            </div>
            {farm.owner_bio_bn && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-sand-100/60">{farm.owner_bio_bn}</p>
            )}
            {farm.owner_phone && (
              <a href={`tel:${farm.owner_phone}`} className="btn-ghost btn-sm mt-4 w-full">
                <Phone className="h-3.5 w-3.5" /> কল করুন
              </a>
            )}
          </div>

          {/* certifications */}
          {(farm.certifications ?? []).length > 0 && (
            <div className="card p-5">
              <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-neu-ink">
                <ShieldCheck className="h-3.5 w-3.5 text-leaf-400" /> সার্টিফিকেশন
              </p>
              <ul className="space-y-1.5">
                {farm.certifications!.map((c) => (
                  <li key={c} className="flex items-start gap-1.5 text-[12px] text-sand-100/60">
                    <span className="mt-0.5 text-leaf-400">✓</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* gallery */}
          {(farm.images ?? []).length > 1 && (
            <div className="card overflow-hidden p-3">
              <p className="mb-2 text-[12px] font-semibold text-neu-ink">খামারের ছবি</p>
              <div className="grid grid-cols-2 gap-1.5">
                {farm.images!.slice(0, 4).map((img, i) => (
                  <div key={`${img}-${i}`} className="relative aspect-square overflow-hidden rounded-lg">
                    <Image src={img} alt="" fill sizes="160px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-2xl border border-mint/25 bg-leaf-900/25 p-5">
            <p className="text-[13px] font-bold text-neu-ink">সব খামার একসাথে দেখতে চান?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-sand-100/55">
              ১০ মিনিট ফ্রি ট্রায়াল — কোনো কার্ড লাগবে না।
            </p>
            <Link href="/live/trial" className="btn-mint btn-sm mt-3 w-full">
              ফ্রি ট্রায়াল শুরু
            </Link>
            <Link
              href="/live/plans"
              className="mt-2 block text-center text-[11.5px] text-mint/80 hover:underline"
            >
              অথবা প্রিমিয়াম প্ল্যান দেখুন →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function toBn(n: number | string): string {
  return String(n ?? "").replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}
