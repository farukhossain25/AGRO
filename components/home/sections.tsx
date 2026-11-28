import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, ShieldCheck, Snowflake } from "lucide-react";
import { ProductGrid } from "@/components/product-card";
import { SectionHeader, ViewAll } from "@/components/ui";
import dynamic from "next/dynamic";
import { TrustStrip } from "@/components/home/trust-strip";
import { LiveFarmsStrip } from "@/components/home/live-farms";

/* Blocks that sit below the fold are code-split: they still render on the
   server (identical HTML, nothing changes for SEO), but their JavaScript is
   fetched after the first paint instead of competing with the hero for the
   main thread — that is what moved LCP on a throttled phone. */
const CombosStrip = dynamic(() =>
  import("@/components/home/combos-strip").then((m) => m.CombosStrip)
);
const PackagesPreview = dynamic(() =>
  import("@/components/home/packages-preview").then((m) => m.PackagesPreview)
);
const RingShowcase = dynamic(() =>
  import("@/components/home/ring-showcase").then((m) => m.RingShowcase)
);
const Testimonials = dynamic(() =>
  import("@/components/home/testimonials").then((m) => m.Testimonials)
);
const WhyChooseUs = dynamic(() =>
  import("@/components/home/why-choose-us").then((m) => m.WhyChooseUs)
);
const FaqAccordion = dynamic(() =>
  import("@/components/faq-accordion").then((m) => m.FaqAccordion)
);
import { whyChooseUs } from "@/lib/site";
import type { BlogPost, Category, Combo, Farmer, Package, Product, Review } from "@/lib/types";
import type { RingProduct } from "@/components/home/ring-showcase";

/* ==========================================================================
   components/home/sections.tsx — one exported block per homepage section
   --------------------------------------------------------------------------
   The homepage is a composition, not a hard-coded page: /foisal/homepage lets
   the owner drag these into any order, hide them, and tune the small config
   blob each one accepts (heading text, item count).

   Every block is a plain server component receiving already-fetched data, so
   reordering costs nothing at runtime — the page decides *whether* to render a
   block, this file only decides *how*.

   Stateless on purpose: no data fetching here, which keeps the fallback logic
   in lib/data.ts as the single source of "what if the DB is down".
   ========================================================================== */

export type HomeData = {
  categories: Category[];
  featured: Product[];
  freshPicks: Product[];
  combos: Combo[];
  packages: Package[];
  posts: BlogPost[];
  farmers: Farmer[];
  reviews: Review[];
};


export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <>
    <section className="section container-x" aria-labelledby="cat-heading">
      <SectionHeader
        eyebrow="৯টি ক্যাটাগরি"
        title={<span id="cat-heading">আপনার রান্নাঘরের সব কিছু, এক জায়গায়</span>}
        subtitle="প্রতিটি ক্যাটাগরির পণ্য আসে সরাসরি নির্বাচিত খামার থেকে — আজ তোলা, আজই পাঠানো।"
        action={<ViewAll href="/categories" label="সব ক্যাটাগরি" />}
      />
      {!categories.length ? (
        /* Reachable when the catalogue read timed out or the table is empty.
           A bare heading with nothing under it reads as a broken page; this
           says what happened in one line and links somewhere useful. */
        <p className="rounded-xl border border-dashed border-neu-line/70 p-8 text-center text-[13.5px] text-sand-100/55">
          ক্যাটাগরি এখন দেখানো যাচ্ছে না — <Link className="text-leaf-300 underline" href="/products">সব পণ্য দেখুন</Link>।
        </p>
      ) : (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {categories.map((c, i) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="card card-hover group relative overflow-hidden"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="relative aspect-[5/4] overflow-hidden">
              {c.image ? (
                <Image
                  src={c.image}
                  alt={c.name_bn}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="grid h-full place-items-center bg-ink-800 text-3xl">{c.icon}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
              <span className="absolute left-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-xl bg-ink-950/70 text-sm backdrop-blur">
                {c.icon}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="text-[13px] font-semibold leading-tight">{c.name_bn}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-leaf-300 opacity-0 transition group-hover:opacity-100">
                দেখুন <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          </Link>
        ))}
      </div>
      )}
    </section>    </>
  );
}

export function FeaturedProducts({
  products,
  headingBn,
}: {
  products: Product[];
  headingBn: string;
}) {
  return (
    <>
    <section className="section container-x" aria-labelledby="featured-heading">
      <SectionHeader
        eyebrow="আজকের সেরা"
        title={<span id="featured-heading">{headingBn}</span>}
        subtitle="আমাদের গ্রাহকদের সবচেয়ে পছন্দের পণ্যগুলো — সীমিত স্টক, তাই দ্রুত অর্ডার করুন।"
        action={<ViewAll href="/products" label="সব পণ্য" />}
      />
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <p className="rounded-xl border border-dashed border-neu-line/70 p-8 text-center text-[13.5px] text-sand-100/55">
          পণ্যের তালিকা এখন লোড হচ্ছে না — কয়েক সেকেন্ড পর আবার দেখা হবে।
        </p>
      )}
    </section>
    </>
  );
}

export function StoryBlock({
  headingBn,
  bodyBn,
}: {
  headingBn: string;
  bodyBn: string;
}) {
  return (
    <>
    <section className="section container-x">
      <div className="card relative overflow-hidden rounded-[2rem]">
        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[280px] lg:min-h-[420px]">
            <Image
              src="/images/hero/farm.jpg"
              alt="বিশ্বাস এগ্রোর খামার — ভোরে সবজি তোলা হচ্ছে"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink-950/70 lg:to-ink-850" />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-10">
            <span className="eyebrow mb-4">খামার থেকে টেবিল</span>
            <h2 className="h-section">{headingBn}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-sand-100/65">{bodyBn}</p>
            <ul className="mt-6 space-y-3">
              {[
                { icon: Clock, t: "৮ ঘণ্টার মধ্যে ঢাকায় ডেলিভারি", d: "সকালে তোলা, সন্ধ্যায় আপনার দরজায়" },
                { icon: Snowflake, t: "কোল্ড-চেইন প্যাকিং", d: "তাপমাত্রা নিয়ন্ত্রিত বক্সে সংরক্ষণ" },
                { icon: ShieldCheck, t: "প্রতি ব্যাচে রেসিডিউ টেস্ট", d: "কোনো ক্ষতিকর পেস্টিসাইড নয়" },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold">{t}</p>
                    <p className="text-[12px] text-sand-100/50">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/farm" className="btn-primary">
                আমাদের খামার দেখুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/about" className="btn-ghost">আমাদের গল্প</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
    <WhyChooseUs items={whyChooseUs} />    </>
  );
}

export function FreshPicks({ products }: { products: Product[] }) {
  return (
    <>
    <section className="section container-x">
      <SectionHeader
        eyebrow="নতুন এসেছে"
        title="এই সপ্তাহে নতুন এসেছে"
        subtitle="মৌসুমের সেরা সংগ্রহ — সীমিত সময়ের জন্য।"
        action={<ViewAll href="/products?sort=newest" label="সব নতুন" />}
      />
      <ProductGrid products={products} />
    </section>
    </>
  );
}

export function FarmerGrid({ farmers }: { farmers: Farmer[] }) {
  return (
    <>
    <section className="section container-x">
      <SectionHeader
        eyebrow="আমাদের কৃষক"
        title="যাঁদের হাতের ছোঁয়ায় আপনার খাবার"
        subtitle="প্রতিটি পণ্যের পেছনে একজন কৃষক আছেন — এবং তাঁর একটা নাম আছে।"
        action={<ViewAll href="/farm" label="কৃষক পরিচিতি" />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {farmers.slice(0, 4).map((f) => (
          <article key={f.id} className="card card-hover overflow-hidden">
            <div className="relative aspect-[4/3]">
              {f.image ? (
                <Image src={f.image} alt={f.name_bn} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-950/30 to-transparent" />
              <span className="absolute right-2.5 top-2.5 badge bg-ink-950/80 text-leaf-200 backdrop-blur">
                {f.years}+ বছর
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="text-[14px] font-semibold">{f.name_bn}</p>
                <p className="text-[11.5px] text-leaf-300">📍 {f.location_bn}</p>
              </div>
            </div>
            <div className="p-3.5">
              <p className="line-clamp-3 text-[12.5px] leading-relaxed text-sand-100/55">{f.story_bn}</p>
              <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wider text-leaf-300/70">
                {f.specialty_bn}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
    </>
  );
}

export function BlogGrid({ posts }: { posts: BlogPost[] }) {
  return (
    <>
    <section className="section container-x">
      <SectionHeader
        eyebrow="ব্লগ ও স্বাস্থ্য টিপস"
        title="স্বাস্থ্যকর খাওয়ার ছোট ছোট পাঠ"
        subtitle="মৌসুমি সবজি, অর্গানিক খাবার ও রেসিপি নিয়ে আমাদের লেখা।"
        action={<ViewAll href="/blog" label="সব লেখা" />}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="card card-hover group overflow-hidden">
            <div className="relative aspect-[16/10] overflow-hidden">
              {p.cover ? (
                <Image src={p.cover} alt={p.title_bn} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : null}
              <span className="absolute left-3 top-3 badge bg-leaf-600/85 text-white backdrop-blur">
                {p.tag_bn}
              </span>
            </div>
            <div className="p-4">
              <p className="text-[11.5px] text-sand-100/40">
                {p.read_minutes} মিনিট পড়া · {new Date(p.published_at).toLocaleDateString("bn-BD", { day: "numeric", month: "long" })}
              </p>
              <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-leaf-200">
                {p.title_bn}
              </h3>
              <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-sand-100/50">{p.excerpt_bn}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-leaf-300">
                পড়ুন <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>    </>
  );
}

export function Combos({ combos }: { combos: Combo[] }) {
  return (
    <>
    <CombosStrip combos={combos} />    </>
  );
}

export function LiveFarms() {
  return (
    <>
    <LiveFarmsStrip />    </>
  );
}

/* The spinning product ring below the subscription packages. Split out of the
   homepage module because its animation loop is the only client-side work in
   the middle of the page; code-splitting keeps it off the hero's critical path. */
export function ProductRing({
  products,
  categories,
  headingBn,
  spin,
  secondsPerTurn,
}: {
  products: RingProduct[];
  categories: Category[];
  headingBn: string;
  spin?: boolean;
  secondsPerTurn?: number;
}) {
  return (
    <RingShowcase
      products={products}
      categories={categories}
      headingBn={headingBn}
      spin={spin}
      secondsPerTurn={secondsPerTurn}
    />
  );
}

export function Packages({ packages }: { packages: Package[] }) {
  return (
    <>
    <PackagesPreview packages={packages} />    </>
  );
}

export function Reviews({ reviews }: { reviews: Review[] }) {
  return (
    <>
    <Testimonials reviews={reviews} />    </>
  );
}

export function WhyChoose() {
  return (
    <>
    <WhyChooseUs items={whyChooseUs} />    </>
  );
}

export function Trust() {
  return (
    <>
    <TrustStrip />    </>
  );
}

/* FAQ block — the seeded `faq` row (sort 120) and /foisal/homepage's "কতটি প্রশ্ন"
   field both point here. Questions come from `faq_items`, flattened across
   groups and cut to `limit`; an empty list renders nothing rather than an
   empty accordion. */
export function FaqBlock({ items }: { items: { q: string; a: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="section container-x">
      <SectionHeader
        eyebrow="সাহায্য কেন্দ্র"
        title="সাধারণ প্রশ্ন ও উত্তর"
        subtitle="ডেলিভারি, পেমেন্ট, রিটার্ন ও সাবস্ক্রিপশন নিয়ে যা জানতে চান।"
        action={<ViewAll href="/faq" label="সব প্রশ্ন" />}
      />
      <div className="mx-auto max-w-3xl">
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}
