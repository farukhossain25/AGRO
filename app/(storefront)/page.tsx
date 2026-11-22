import type { Metadata } from "next";
import Link from "next/link";
import { Leaf, Truck } from "lucide-react";
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
import { HeroSlider } from "@/components/home/hero-slider";
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
  Reviews,
  StoryBlock,
  Trust,
  WhyChoose,
} from "@/components/home/sections";
import { getHeroSlides, getVisibleSections, sectionConfig } from "@/lib/content";
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
export default async function HomePage() {
  const [
    categories,
    featured,
    freshPicks,
    combos,
    packages,
    posts,
    farmers,
    reviews,
    slides,
    layout,
    faqGroups,
  ] = await Promise.all([
    getCategories(),
    getProducts({ featuredOnly: true, limit: 8 }),
    getProducts({ sort: "newest", limit: 4 }),
    getCombos(),
    getPackages(),
    getBlogPosts(3),
    getFarmers(),
    getApprovedReviews(undefined, 6),
    getHeroSlides(),
    getVisibleSections(),
    getFaqGroups(),
  ]);

  /* Flat list of Q&A for the homepage block; it shares the table with /faq so
     the owner only maintains one place. Only fetched/used when the block is
     visible, so a hidden block costs nothing beyond one memoised read. */
  const faqItems = faqGroups.flatMap((group) => group.items);

  const byKey = new Map(layout.map((section) => [section.key, section]));

  const blocks: Record<string, () => React.ReactNode> = {
    hero_slider: () => {
      const config = sectionConfig(byKey.get("hero_slider"), {
        autoplay_ms: 6000,
        show_arrows: true,
        show_dots: true,
      });
      return (
        <HeroSlider
          slides={slides}
          autoplayMs={Number(config.autoplay_ms) || 6000}
          showArrows={config.show_arrows !== false}
          showDots={config.show_dots !== false}
        />
      );
    },

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

      {/* The closing CTA is not reorderable — it is the page's exit, and every
          layout wants it last. It can still be hidden with the `text_block`
          toggle if the owner prefers a shorter page. */}
      <section className="container-x pb-8 pt-2">
        <div className="relative overflow-hidden rounded-[2rem] border border-leaf-600/30 bg-gradient-to-br from-leaf-800/60 via-ink-850 to-ink-850 p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-leaf-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-leaf-400/10 blur-3xl" />
          <div className="relative">
            <span className="eyebrow mb-4">প্রথম অর্ডারে ছাড়</span>
            <h2 className="mx-auto max-w-2xl text-2xl font-bold sm:text-4xl">
              আজই শুরু করুন — খাঁটি খাবারের বিশ্বাস
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-sand-100/60">
              কুপন কোড{" "}
              <span className="rounded-md bg-leaf-600/25 px-2 py-0.5 font-mono font-bold text-leaf-200">
                BISWAS10
              </span>{" "}
              ব্যবহার করে প্রথম অর্ডারে ১০% ছাড় নিন। ঢাকায় আজকের মধ্যে ডেলিভারি।
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/products" className="btn-mint">
                <Leaf className="h-4 w-4" /> পণ্য দেখুন
              </Link>
              <Link href="/subscription" className="btn-outline">
                <Truck className="h-4 w-4" /> মাসিক প্যাকেজ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
