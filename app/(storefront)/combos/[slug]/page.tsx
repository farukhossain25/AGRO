import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, Clock, Leaf, Package, Truck } from "lucide-react";
import { decodeRouteParam } from "@/lib/format";
import { getCombos, lookupComboBySlug } from "@/lib/data";
import { money } from "@/lib/format";
import { ComboAddButton } from "@/components/shop/combo-add-button";
import { dynamicAlternates } from "@/lib/seo";

/* Session-aware components on this page (wishlist, review form) read the
   session cookie per request. In Next 15 an ISR render that touches
   `cookies()` aborts with DYNAMIC_SERVER_USAGE, so any slug outside the
   prerendered set answered 500. Rendering per request is the correct mode. */
export const dynamic = "force-dynamic";

export const revalidate = 180;

export async function generateStaticParams() {
  const combos = await getCombos().catch(() => []);
  return combos.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  const found = await lookupComboBySlug(slug);
  const combo = found.state === "ok" ? found.value : null;
  if (!combo) return { title: "কম্বো পাওয়া যায়নি" };
  return {
    title: combo.name_bn,
    description: combo.description_bn ?? undefined,
    alternates: dynamicAlternates(`/combos/${combo.slug}`),
    openGraph: {
      title: combo.name_bn,
      description: combo.description_bn ?? undefined,
      images: combo.image ? [{ url: combo.image }] : undefined,
      url: `/combos/${combo.slug}`,
    },
  };
}

export default async function ComboPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteParam(rawSlug);
  /* A failed read must not be reported as "no such combo" — see lib/data.ts. */
  const found = await lookupComboBySlug(slug);
  if (found.state === "error") throw new Error(`combo lookup failed for "${slug}"`);
  const combo = found.value;
  if (!combo) notFound();

  const all = await getCombos();
  const others = all.filter((c) => c.id !== combo.id).slice(0, 3);
  const saving = combo.original_price
    ? Math.round(((combo.original_price - combo.price) / combo.original_price) * 100)
    : 0;

  return (
    <div className="container-x py-6 sm:py-10">
      <nav aria-label="ব্রেডক্রাম্ব" className="mb-5 flex items-center gap-1 text-[12px] text-sand-100/45">
        <Link href="/" className="hover:text-leaf-200">হোম</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/combos" className="hover:text-leaf-200">কম্বো বক্স</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-sand-100/80">{combo.name_bn}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="card relative aspect-[4/3] overflow-hidden rounded-[1.75rem]">
          {combo.image ? (
            <Image src={combo.image} alt={combo.name_bn} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          ) : null}
          <span className="absolute left-3 top-3 badge bg-leaf-600/90 text-white backdrop-blur">
            {combo.kind === "daily" ? "ডেইলি" : combo.kind === "weekly" ? "উইকলি" : "মাসিক"}
          </span>
          {saving > 0 ? (
            <span className="absolute right-3 top-3 badge bg-amber-400 text-ink-900">{saving}% সাশ্রয়</span>
          ) : null}
        </div>

        <div>
          <span className="eyebrow mb-3">
            <Package className="h-3.5 w-3.5" /> রেডিমেড কম্বো
          </span>
          <h1 className="text-[24px] font-bold leading-tight sm:text-[32px]">{combo.name_bn}</h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-sand-100/60">{combo.description_bn}</p>

          <div className="mt-5 flex items-end gap-3">
            <span className="text-[32px] font-bold leading-none text-leaf-200">{money(combo.price, true)}</span>
            {combo.original_price ? (
              <span className="pb-1.5 text-[14px] text-sand-100/35 line-through">
                {money(combo.original_price, true)}
              </span>
            ) : null}
          </div>

          <div className="card mt-5 p-4">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
              <Leaf className="h-4 w-4 text-leaf-400" /> বক্সে যা যা থাকছে
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {combo.contents.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className="flex items-center gap-2 text-[12.5px]">
                    <Check className="h-3.5 w-3.5 shrink-0 text-leaf-400" />
                    {c.name}
                  </span>
                  <span className="shrink-0 text-[11.5px] font-semibold text-leaf-300">{c.qty}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <ComboAddButton comboId={combo.id} comboSlug={combo.slug} label="কার্টে যোগ করুন" className="btn-primary" />
            <Link href="/checkout" className="btn-mint">চেকআউট</Link>
          </div>

          <ul className="mt-5 space-y-2 text-[12.5px] text-sand-100/60">
            <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-leaf-400" /> সকাল ১০টার আগে অর্ডার করলে আজই ডেলিভারি (ঢাকা সিটিতে)</li>
            <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-leaf-400" /> কম্বো বক্সে ডেলিভারি চার্জ ফ্রি</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-leaf-400" /> সবজি পরিবর্তনযোগ্য — অর্ডারের নোটে লিখুন</li>
          </ul>
        </div>
      </div>

      {others.length ? (
        <section className="mt-14">
          <h2 className="mb-5 text-[20px] font-bold sm:text-2xl">অন্য কম্বোগুলো</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {others.map((c) => (
              <Link key={c.id} href={`/combos/${c.slug}`} className="card card-hover group overflow-hidden">
                <div className="relative aspect-[16/9]">
                  {c.image ? <Image src={c.image} alt={c.name_bn} fill sizes="33vw" className="object-cover" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 to-transparent" />
                </div>
                <div className="p-3.5">
                  <p className="text-[13px] font-semibold group-hover:text-leaf-200">{c.name_bn}</p>
                  <p className="mt-1 text-[13px] font-bold text-leaf-300">{money(c.price, true)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
