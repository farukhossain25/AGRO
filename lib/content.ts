/* ==========================================================================
   lib/content.ts — editable site content (social links, hero slides, layout)
   --------------------------------------------------------------------------
   Everything here is admin-managed in the database (migration 0009) and falls
   back to hard-coded defaults so the storefront never renders an empty hero or
   a footer with no icons — even on a brand-new database, or while Supabase is
   unreachable.

   Caching: each reader is memoised for 60 s per process. The admin screens call
   `revalidateContent()` after a write so the change shows immediately.
   ========================================================================== */

import { db } from "./db";
import { logCache } from "./log";
import { readWithOutcome } from "./read-deadline";
import { site } from "./site";
import type { HeroSlide, HomepageSection, SocialLink } from "./types";

const TTL_MS = 60_000;

type CacheEntry<T> = { value: T; at: number };
const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Memoise one read for 60 s.
 *
 * `cacheable` is what stops a bad minute from becoming a bad hour. Each reader
 * below falls back to built-in content when the database does not answer; if
 * that fallback were memoised like real data, the page would keep serving the
 * built-in hero and the default section order for a full minute AFTER Supabase
 * recovered — the "it is healthy again but the site still looks broken" report.
 * Passing `false` returns the value without caching it, so the next request
 * retries.
 */
function memo<T>(key: string, loader: () => Promise<T>, cacheable = true): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value);

  /* ONE LOAD PER KEY WHILE IT IS PENDING.
     The homepage reads the hero in two places — the `<Suspense>` fallback and
     `HomeHero` — plus the section layout, all in the same render. Without this,
     two identical queries went to Supabase and, on a failing database, both
     waited out their own budget. Cleared in `finally`, so a rejection is never
     the answer any later caller receives. */
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const promise = loader().then((value) => {
    if (cacheable) cache.set(key, { value, at: Date.now() });
    else logCache("fallback not cached", { key });
    return value;
  });

  inflight.set(key, promise);
  void promise.finally(() => inflight.delete(key));
  return promise;
}

/** Reads currently in flight, by memo key — shared within one process. */
const inflight = new Map<string, Promise<unknown>>();

/**
 * The reason this file was the worst offender in production.
 *
 * All three readers used to gate on `isDbConfigured()` — "are credentials
 * present?" — instead of `dbUsable()` — "are credentials present AND is the
 * breaker closed?". `lib/db.ts` opens that breaker after a transport failure
 * precisely so the rest of the render stops paying a full timeout per query.
 * `lib/data.ts` honours it; this file did not. So when Supabase was
 * unreachable, every OTHER read returned instantly while the hero, the section
 * layout and the footer socials each waited out the full 8 s fetch timeout.
 * Measured: 8.0 s and 8.0 s for the two the homepage awaits.
 *
 * `dbUsable()` returns false either way, so the fallback still renders — it
 * just renders immediately instead of after eight seconds, per reader.
 */
/** Drop every memoised read — call after an admin save. */
export function revalidateContent(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

async function timed<T>(
  key: string,
  read: (signal: AbortSignal) => Promise<T>,
  fallback: T
): Promise<{ value: T; ok: boolean }> {
  const outcome = await readWithOutcome("content", key, read, fallback);
  return { value: outcome.value, ok: outcome.ok };
}

const FALLBACK_SOCIALS: SocialLink[] = [
  {
    id: "fallback-facebook",
    platform: "facebook",
    label_bn: "ফেসবুক",
    url: site.social.facebook,
    icon: "Facebook",
    color: null,
    sort_order: 10,
    is_active: true,
    show_header: true,
    show_footer: true,
    show_contact: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-youtube",
    platform: "youtube",
    label_bn: "ইউটিউব",
    url: site.social.youtube,
    icon: "Youtube",
    color: null,
    sort_order: 20,
    is_active: true,
    show_header: true,
    show_footer: true,
    show_contact: true,
    created_at: new Date(0).toISOString(),
  },
  {
    id: "fallback-instagram",
    platform: "instagram",
    label_bn: "ইনস্টাগ্রাম",
    url: site.social.instagram,
    icon: "Instagram",
    color: null,
    sort_order: 30,
    is_active: true,
    show_header: false,
    show_footer: true,
    show_contact: true,
    created_at: new Date(0).toISOString(),
  },
];

export type SocialPlacement = "header" | "footer" | "contact";

/**
 * Footer / header social icons. Abortable, like every other read in this file —
 * it runs in the storefront layout, so a stalled read here delays every page.
 */
export function getSocialLinks(placement: SocialPlacement = "footer"): Promise<SocialLink[]> {
  const fallback = FALLBACK_SOCIALS.filter(byPlacement(placement));
  return memo(
    `social:${placement}`,
    async () => {
      const { value, ok } = await timed(
        "social_links",
        async (signal) => {
          const { data, error } = await db()
            .from("social_links")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .abortSignal(signal);
          if (error) throw error;
          return (data ?? []) as SocialLink[];
        },
        [] as SocialLink[]
      );
      if (!ok) return fallback;
      if (!value.length) return fallback;
      return value.filter(byPlacement(placement));
    },
    /* A fallback is not the owner's content — never memoise it. */
    false
  );
}

function byPlacement(placement: SocialPlacement) {
  return (link: SocialLink) =>
    placement === "header" ? link.show_header : placement === "footer" ? link.show_footer : link.show_contact;
}

/* -------------------------------------------------------------- hero slides */

/**
 * The hero the page renders before Supabase answers.
 * Exported so `/` can paint its above-the-fold band on the first byte instead of
 * waiting for a query: the visitor sees a real headline, not a grey box, and the
 * live slides swap in when they arrive.
 */
export const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: "fallback-1",
    title_bn: "খামার থেকে সোজা আপনার রান্নাঘরে",
    subtitle_bn: "আজ তোলা সবজি, আজই ডেলিভারি। কোনো গুদাম নেই, কোনো কেমিক্যাল নেই।",
    image_url: "/images/cat/vegetables.jpg",
    image_mobile_url: null,
    video_url: null,
    alt_bn: "তাজা শাকসবজি",
    cta_label_bn: "এখনই অর্ডার করুন",
    cta_href: "/products",
    secondary_label_bn: "ক্যাটাগরি দেখুন",
    secondary_href: "/categories",
    text_position: "left",
    text_tone: "light",
    overlay_opacity: 52,
    starts_at: null,
    ends_at: null,
    sort_order: 10,
    is_active: true,
    created_at: new Date(0).toISOString(),
  },
];

export function getHeroSlides(): Promise<HeroSlide[]> {
  return memo("hero", async () => {
    const now = new Date().toISOString();
    const { value, ok } = await timed(
      "hero_slides",
      async (signal) => {
        const { data, error } = await db()
          .from("hero_slides")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .abortSignal(signal);
        if (error) throw error;
        return (data ?? []) as HeroSlide[];
      },
      [] as HeroSlide[]
    );
    if (!ok || !value.length) return FALLBACK_SLIDES;

    /* Date windowing is also enforced in RLS; this is the belt to that brace
       because the service role bypasses RLS. */
    const live = value.filter(
      (slide) => (!slide.starts_at || slide.starts_at <= now) && (!slide.ends_at || slide.ends_at >= now)
    );

    return live.length ? live : FALLBACK_SLIDES;
  }, false);
}

/* --------------------------------------------------------- homepage layout */

/** The order the homepage used to hard-code, used when the table is empty. */
const DEFAULT_LAYOUT: Omit<HomepageSection, "id" | "updated_at">[] = [
  { key: "hero_slider", label_bn: "হিরো স্লাইডার", is_visible: true, sort_order: 10, config: { autoplay_ms: 6000, show_arrows: true, show_dots: true } },
  { key: "trust_strip", label_bn: "বিশ্বাসের স্ট্রিপ", is_visible: true, sort_order: 20, config: {} },
  { key: "featured_products", label_bn: "ফিচার্ড পণ্য", is_visible: true, sort_order: 30, config: { limit: 8, mode: "featured", heading_bn: "আজকের বাছাই" } },
  { key: "text_block", label_bn: "টেক্সট ব্লক", is_visible: true, sort_order: 40, config: { heading_bn: "আমরা কেন আলাদা", body_bn: "" } },
  { key: "categories", label_bn: "ক্যাটাগরি", is_visible: true, sort_order: 50, config: {} },
  { key: "combos", label_bn: "কম্বো বক্স", is_visible: true, sort_order: 60, config: {} },
  { key: "live_farms", label_bn: "লাইভ খামার", is_visible: true, sort_order: 70, config: {} },
  { key: "premium_plans", label_bn: "প্রিমিয়াম প্ল্যান", is_visible: true, sort_order: 80, config: {} },
  /* The product ring sits directly under the monthly food-subscription block,
     which is where the owner asked for it. Visible by default: an existing
     database already has its 12 rows, and getHomeLayout() merges in whatever
     is missing — so this section appears on deploy with NO SQL. */
  { key: "product_ring", label_bn: "ঘোরানো পণ্যের চাকা", is_visible: true, sort_order: 85, config: { heading_bn: "চাকা ঘুরিয়ে আজকের বাজার দেখুন", limit: 12 } },
  { key: "why_choose_us", label_bn: "কেন আমরা", is_visible: true, sort_order: 90, config: {} },
  { key: "reviews", label_bn: "রিভিউ", is_visible: true, sort_order: 100, config: { limit: 6 } },
  { key: "blog", label_bn: "ব্লগ", is_visible: true, sort_order: 110, config: { limit: 3 } },
  { key: "faq", label_bn: "প্রশ্ন-উত্তর", is_visible: true, sort_order: 120, config: { limit: 5 } },
];

/** The Bangla label a section should keep when it is first written to the DB.
 *
 * Before this, a row that only existed as a fallback was inserted with its KEY
 * as `label_bn` (the API derives it from the `fallback-` id), so the owner's
 * homepage manager started showing "product_ring" in Latin the first time he
 * pressed save. New sections are exactly where that bites. */
export function defaultSectionLabel(key: string): string {
  return DEFAULT_LAYOUT.find((section) => section.key === key)?.label_bn ?? key;
}

export function getHomeLayout(): Promise<HomepageSection[]> {
  return memo(
    "home-layout",
    async () => {
      const { value, ok } = await timed(
        "homepage_sections",
        async (signal) => {
          const { data, error } = await db()
            .from("homepage_sections")
            .select("*")
            .order("sort_order", { ascending: true })
            .abortSignal(signal);
          if (error) throw error;
          return (data ?? []) as HomepageSection[];
        },
        [] as HomepageSection[]
      );
      if (!ok || !value.length) return defaultLayout();

      /* Rows added later in the admin panel for an unknown key are ignored by
         the renderer, so merging in anything missing keeps the page whole. */
      const present = new Set(value.map((s) => s.key));
      const missing = DEFAULT_LAYOUT.filter((s) => !present.has(s.key)).map(fallbackRow);

      return [...value, ...missing].sort((a, b) => a.sort_order - b.sort_order);
    },
    /* A default layout is not the owner's layout — never memoise it, or a
       one-minute outage would keep the site on default section order after the
       database came back. */
    false
  );
}

function fallbackRow(section: Omit<HomepageSection, "id" | "updated_at">): HomepageSection {
  return { ...section, id: `fallback-${section.key}`, updated_at: null };
}

function defaultLayout(): HomepageSection[] {
  return DEFAULT_LAYOUT.map(fallbackRow);
}

/**
 * The built-in section order, exported.
 *
 * `/` uses this as the answer when the layout read fails: without it a failed
 * read produced an empty list, which renders an empty homepage — technically
 * "no error", practically the same thing to a visitor. The owner's own order
 * wins whenever the read succeeds.
 */
export const DEFAULT_SECTIONS: HomepageSection[] = defaultLayout();

export async function getVisibleSections(): Promise<HomepageSection[]> {
  const layout = await getHomeLayout();
  return layout.filter((section) => section.is_visible);
}

/** Read one section's config with typed fallbacks. */
export function sectionConfig<T extends Record<string, unknown>>(
  section: HomepageSection | undefined,
  defaults: T
): T {
  return { ...defaults, ...((section?.config as Partial<T>) ?? {}) };
}

/* ------------------------------------------------------------- social icons */

/**
 * A fixed allow-list of icon names → lucide components.
 *
 * An allow-list (not a dynamic lookup) means a typo in the admin panel shows a
 * generic globe instead of crashing the header, and no admin input can ever
 * reach the module system.
 */
export const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook", icon: "Facebook" },
  { value: "youtube", label: "YouTube", icon: "Youtube" },
  { value: "instagram", label: "Instagram", icon: "Instagram" },
  { value: "tiktok", label: "TikTok", icon: "Music2" },
  { value: "whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { value: "telegram", label: "Telegram", icon: "Send" },
  { value: "x", label: "X (Twitter)", icon: "Twitter" },
  { value: "linkedin", label: "LinkedIn", icon: "Linkedin" },
  { value: "custom", label: "কাস্টম", icon: "Globe" },
] as const;

export const SOCIAL_ICON_OPTIONS = [
  "Facebook",
  "Youtube",
  "Instagram",
  "Music2",
  "MessageCircle",
  "Send",
  "Twitter",
  "Linkedin",
  "Globe",
  "Phone",
  "Mail",
  "MapPin",
] as const;

export type SocialIconName = (typeof SOCIAL_ICON_OPTIONS)[number];

export function isSocialIcon(name: string | null | undefined): name is SocialIconName {
  return !!name && (SOCIAL_ICON_OPTIONS as readonly string[]).includes(name);
}

/** Blocks `javascript:` and `data:` URLs from ever reaching an href. */
export function safeHref(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
  return "#";
}
