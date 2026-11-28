import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getApprovedReviews,
  getBlogPosts,
  getCategories,
  getCombos,
  getFarmers,
  getPackages,
  getProducts,
} from "@/lib/data";
import { getFaqGroups } from "@/lib/cms";

import {
  BlogGrid,
  CategoryGrid,
  Combos,
  FaqBlock,
  FarmerGrid,
  FeaturedProducts,
  FreshPicks,
  LiveFarms,
  Packages,
  ProductRing,
  Reviews,
  StoryBlock,
  Trust,
  WhyChoose,
} from "@/components/home/sections";
import { FALLBACK_SLIDES, getHeroSlides, getVisibleSections, sectionConfig } from "@/lib/content";
import { HeroSlider } from "@/components/home/hero-slider";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { alternatesFor } from "@/lib/seo";
import { withSeo } from "@/lib/seo-db";

export const revalidate = 120;

/* The home page carries the money keywords, so its title/description live in
   seo_meta and can be tuned from the panel’s SEO screen without shipping a release. */
export async function generateMetadata(): Promise<Metadata> {
  return withSeo("/", {
    // absolute: the root title already carries the brand, so the layout
    // template must not append it again.
    title: { absolute: "বিশ্বাস এগ্রো | খামার থেকে আপনার ঘরে — তাজা ও অর্গানিক বাজার" },
    description:
      "খামার থেকে সরাসরি তাজা শাকসবজি, ফলমূল, দেশি ডিম, মাছ, মাংস, দুধ ও অর্গানিক পণ্য। ঢাকায় একই দিনে ডেলিভারি, সারা বাংলাদেশে হোম ডেলিভারি, ক্যাশ অন ডেলিভারি।",
    alternates: alternatesFor("/"),
    openGraph: {
      title: "বিশ্বাস এগ্রো — খামার থেকে আপনার ঘরে",
      description: "তাজা শাকসবজি, দেশি ডিম, খাঁটি মধু ও দুধ — সরাসরি খামার থেকে।",
      url: "/",
    },
  });
}


/**
 * The homepage is a COMPOSITION, not a fixed page.
 *
 * `/foisal/homepage` stores an ordered list of `homepage_sections` rows; each
 * key below maps to a block component. The admin can drag them, hide them, and
 * edit a small `config` blob per section (heading text, item count) without a
 * deploy — see migration 0009.
 *
 * Two deliberate choices:
 *
 *   • Data for every block is fetched in ONE Promise.all up front. Fetching
 *     lazily per block would mean a hidden section still paid for its query,
 *     and — worse — a slow section would push the hero out of the LCP window.
 *   • An unknown key is skipped silently. A row added to the table by hand can
 *     never blank the homepage.
 */
/* ==========================================================================
   WHY THE PAGE IS SPLIT IN TWO
   --------------------------------------------------------------------------
   This used to be one async component that awaited twelve queries before it
   returned a single element. Next.js cannot stream a component that has not
   returned, so the visitor got `app/(storefront)/loading.tsx` — the grey
   skeleton — and nothing else until the slowest of twelve round-trips finished.
   If Supabase was slow, that was never.

   Now the hero has no await at all: its slides come from a module-level
   fallback and are replaced by the live ones when they arrive. The rest of the
   page streams in behind it. On a fast connection nothing visibly changes; on
   a slow one the visitor sees the headline and the navigation immediately
   instead of empty boxes.

   `Suspense` boundaries are not decoration — each `<Name>` below is a real
   boundary, so a stalled query inside one section cannot hold the others.
   ========================================================================== */

export default function HomePage() {
  return (
    <>
      {/* ITS OWN BOUNDARY, WITH A REAL HERO AS THE FALLBACK.
          `HomeHero` awaits `getHeroSlides()`. Without a boundary here, that
          suspension would propagate upwards and hold the WHOLE page — header
          included — for as long as the hero query took, which is the original
          bug wearing a different costume. The fallback is the built-in hero,
          fully rendered: the visitor always gets a headline, a CTA and the LCP
          image on the first byte. If the owner has configured their own slides
          they replace these as soon as the read lands. */}
      <Suspense
        fallback={<HeroSlider slides={FALLBACK_SLIDES} autoplayMs={6000} showArrows showDots />}
      >
        <HomeHero />
      </Suspense>
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections />
      </Suspense>
    </>
  );
}

/**
 * The hero, split out purely so `HomePage` can stay synchronous.
 *
 * `getHeroSlides()` returns the built-in slides when the database is not
 * configured and a memoised promise otherwise, so the fallback is already the
 * right content in the degraded case — the swap below is an upgrade, not a fix
 * for a blank hero.
 */
async function HomeHero() {
  const slides = await getHeroSlides().catch(() => FALLBACK_SLIDES);
  return <HeroSlider slides={slides.length ? slides : FALLBACK_SLIDES} autoplayMs={6000} showArrows showDots />;
}

function HomeSectionsSkeleton() {
  return (
    <div className="container-x py-10" aria-hidden>
      <div className="skeleton h-8 w-56" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neu-line/60 bg-neu-surface p-2.5">
            <div className="skeleton aspect-square w-full rounded-lg" />
            <div className="skeleton mt-3 h-3.5 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function HomeSections() {
  const [
    categories,
    featured,
    freshPicks,
    combos,
    packages,
    ringPool,
    posts,
    farmers,
    reviews,
    layout,
    faqGroups,
  ] = await Promise.all([
    getCategories(),
    getProducts({ featuredOnly: true, limit: 8 }),
    getProducts({ sort: "newest", limit: 4 }),
    getCombos(),
    getPackages(),
    /* The ring is ordered newest-first and culled client-side to `limit`, so a
       single query serves every slice size the owner may pick. In-stock only:
       a sold-out product at the front of the wheel is a dead end. */
    getProducts({ sort: "newest", inStockOnly: true, limit: 48 }),
    getBlogPosts(3),
    getFarmers(),
    getApprovedReviews(undefined, 6),
    /* Hero slides are fetched by HomeHero, above the Suspense boundary — asking
       for them here too would be a second identical (cached) read for data this
       component no longer renders. */
    getVisibleSections(),
    getFaqGroups(),
  ]);

  /* Flat list of Q&A for the homepage block; it shares the table with /faq so
     the owner only maintains one place. Only fetched/used when the block is
     visible, so a hidden block costs nothing beyond one memoised read. */
  const faqItems = faqGroups.flatMap((group) => group.items);

  const byKey = new Map(layout.map((section) => [section.key, section]));

  const blocks: Record<string, () => React.ReactNode> = {
    /* Rendered above the Suspense boundary (HomeHero), not here — otherwise the
       hero would appear twice: once from the hero, once when this block
       streamed in. */
    hero_slider: () => null,

    trust_strip: () => <Trust />,

    featured_products: () => {
      const config = sectionConfig(byKey.get("featured_products"), {
        heading_bn: "সবচেয়ে জনপ্রিয় তাজা পণ্য",
        limit: 8,
      });
      const limit = Number(config.limit) || 8;
      return <FeaturedProducts products={featured.slice(0, limit)} headingBn={String(config.heading_bn)} />;
    },

    text_block: () => {
      const config = sectionConfig(byKey.get("text_block"), {
        heading_bn: "আমরা কেন আলাদা",
        body_bn: "",
      });
      // An empty body would render a blank card — skip it entirely.
      if (!config.body_bn) return null;
      return <StoryBlock headingBn={String(config.heading_bn)} bodyBn={String(config.body_bn)} />;
    },

    categories: () => <CategoryGrid categories={categories} />,
    combos: () => <Combos combos={combos} />,
    live_farms: () => <LiveFarms />,
    premium_plans: () => <Packages packages={packages} />,

    product_ring: () => {
      const config = sectionConfig<{
        heading_bn: string;
        limit: number;
        spin_speed: number;
        free_spin: boolean;
      }>(byKey.get("product_ring"), {
        heading_bn: "চাকা ঘুরিয়ে আজকের বাজার দেখুন",
        limit: 12,
        /* seconds for one full lap — see /foisal/homepage */
        spin_speed: 14,
        free_spin: true,
      });
      const limit = Math.max(6, Math.min(24, Number(config.limit) || 12));
      const shown = ringPool.slice(0, limit);
      /* Speed and free-spin come from the homepage manager, so the owner tunes
         the wheel without a deploy. Seconds-per-turn is the number he thinks
         in; the component converts it to degrees. */
      const seconds = Math.max(6, Math.min(120, Number(config.spin_speed) || 18));
      const free = config.free_spin !== false;
      /* Fewer than two products is not a wheel — the block renders nothing
         rather than a single card spinning on its own. */
      return shown.length >= 2 ? (
        <ProductRing
          products={shown}
          categories={categories}
          headingBn={String(config.heading_bn)}
          spin={free}
          secondsPerTurn={seconds}
        />
      ) : null;
    },
    why_choose_us: () => <WhyChoose />,

    reviews: () => {
      const config = sectionConfig(byKey.get("reviews"), { limit: 6 });
      const limit = Number(config.limit) || 6;
      const shown = reviews.slice(0, limit);
      return shown.length ? <Reviews reviews={shown} /> : null;
    },

    fresh_picks: () => <FreshPicks products={freshPicks} />,
    farmers: () => <FarmerGrid farmers={farmers} />,

    blog: () => {
      const config = sectionConfig(byKey.get("blog"), { limit: 3 });
      const limit = Number(config.limit) || 3;
      const shown = posts.slice(0, limit);
      return shown.length ? <BlogGrid posts={shown} /> : null;
    },

    faq: () => {
      const config = sectionConfig(byKey.get("faq"), { limit: 5 });
      const limit = Number(config.limit) || 5;
      return <FaqBlock items={faqItems.slice(0, limit)} />;
    },
  };

  return (
    <>
      {layout.map((section) => {
        const block = blocks[section.key];
        if (!block) return null;
        return <div key={section.id}>{block()}</div>;
      })}

      {/* The closing CTA used to be a full-screen panel repeating products and
          packages the page had already shown six times. In its place: one slim
          band of email capture — the owner's "সাপ্তাহিক তাজা খবর" — which is
          the only thing at the bottom of a shop that still earns its height. */}
      <NewsletterSignup />
    </>
  );
}
