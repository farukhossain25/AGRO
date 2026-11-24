import type { Metadata } from "next";
import { site } from "./site";
import type { StoreSettings } from "./store-info-model";

/* ==========================================================================
   lib/seo.ts — one place for everything Google reads
   --------------------------------------------------------------------------
   Every page currently hand-writes `title` + `alternates.canonical`. This
   helper centralises the parts that are easy to get subtly wrong:

     • canonical URL always absolute and trailing-slash free
     • hreflang alternates for bn-BD and en-US on every page
     • OpenGraph + Twitter cards kept in sync with the page title
     • robots directives for private routes

   Everything is overridable from the admin CMS later (section E) — the
   `overrides` argument is already shaped for that.
   ========================================================================== */

export const SEO_LOCALES = ["bn-BD", "en-US"] as const;

/** Absolute URL for a path. `"/"` stays `https://bishwasagro.com/`. */
export function absoluteUrl(path = "/"): string {
  const base = site.url.replace(/\/+$/, "");
  if (!path || path === "/") return `${base}/`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Trim a description to the ~155-160 characters Google renders. */
export function clampDescription(input: string | null | undefined, fallback = site.descriptionBn): string {
  const text = (input ?? "").replace(/\s+/g, " ").trim() || fallback;
  if (text.length <= 158) return text;
  const cut = text.slice(0, 155);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Bangla-friendly slug: keeps Bengali letters and digits, folds everything
 * else to a hyphen. Bengali text has no case, so no lower-casing games.
 */
export function banglaSlug(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['"“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type PageSeo = {
  /** page-specific part of <title> */
  title: string;
  description?: string | null;
  /** path beginning with "/" */
  path: string;
  /** absolute or root-relative image */
  image?: string | null;
  imageAlt?: string | null;
  type?: "website" | "article" | "product" | "profile";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /** set true for /account, the panel, /cart, /checkout… */
  noindex?: boolean;
  keywords?: string[];
  /** English twin for hreflang; defaults to `?lang=en` on the same path */
  englishAlternate?: string | null;
};

/**
 * Builds the full Metadata object for a page.
 *
 *   export const metadata = pageMetadata({ title: "সব পণ্য", path: "/products" });
 */
/**
 * The `alternates` block a *static* page needs: canonical + bn/en hreflang.
 * Returns root-relative values, which Next resolves against `metadataBase`
 * and renders as absolute URLs.
 */
export function alternatesFor(path: string) {
  return {
    canonical: path,
    languages: {
      "bn-BD": path,
      "en-US": `${path}?lang=en`,
      "x-default": path,
    },
  };
}

/**
 * The same for a dynamic route, where the path is only known at request time.
 * `languages` cannot contain a template literal, so absolute URLs are built
 * here instead.
 */
export function dynamicAlternates(path: string) {
  return {
    canonical: path,
    languages: {
      "bn-BD": absoluteUrl(path),
      "en-US": `${absoluteUrl(path)}?lang=en`,
      "x-default": absoluteUrl(path),
    },
  };
}

export function pageMetadata(seo: PageSeo): Metadata {
  const canonical = absoluteUrl(seo.path);
  const description = clampDescription(seo.description);
  const image = seo.image ? (seo.image.startsWith("http") ? seo.image : `${site.url}${seo.image}`) : `${site.url}/images/cat/vegetables.jpg`;
  const languages = seo.noindex
    ? undefined
    : {
        "bn-BD": canonical,
        "en-US": absoluteUrl(seo.englishAlternate ?? `${seo.path}?lang=en`),
        "x-default": canonical,
      };

  return {
    title: seo.title,
    description,
    keywords: seo.keywords,
    alternates: { canonical, languages },
    robots: seo.noindex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
        },
    openGraph: {
      // OpenGraph has no "product" type — products are pages.
      type: seo.type === "article" ? "article" : seo.type === "profile" ? "profile" : "website",
      locale: "bn_BD",
      alternateLocale: ["en_US"],
      url: canonical,
      siteName: site.nameEn,
      title: seo.title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: seo.imageAlt ?? seo.title }],
      ...(seo.type === "article"
        ? {
            publishedTime: seo.publishedTime ?? undefined,
            modifiedTime: seo.modifiedTime ?? undefined,
            authors: [site.nameEn],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description,
      images: [image],
    },
  };
}

/* ------------------------------------------------------------- JSON-LD ---- */

/** Wrap a schema.org object as a <script> payload string. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.nameBn,
  alternateName: site.nameEn,
  url: site.url,
  logo: {
    /* The full seal, not the app icon: rich-result logos are shown as a
       wordmark and a 512 px square crops the name off. Generated by
       scripts/generate-brand.mjs from the master. */
    "@type": "ImageObject",
    url: `${site.url}/brand/logo-full.webp`,
    width: 1200,
    height: 1093,
  },
  image: `${site.url}/images/cat/vegetables.jpg`,
  description: site.descriptionBn,
  telephone: site.phone,
  email: site.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "House 12, Road 7, Dhanmondi",
    addressLocality: "Dhaka",
    postalCode: "1209",
    addressRegion: "Dhaka",
    addressCountry: "BD",
  },
  sameAs: [site.social.facebook, site.social.youtube, site.social.instagram],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: site.phone,
      contactType: "customer support",
      areaServed: "BD",
      availableLanguage: ["bn", "en"],
    },
  ],
};

/**
 * The store's structured data, built from the admin-managed contact block so
 * Google is told the same phone number and address the customer reads on the
 * page. Kept as a function because the values now arrive at request time.
 */
export function localBusinessLdFrom(store: StoreSettings) {
  return {
    ...localBusinessLd,
    name: store.name,
    telephone: store.phone,
    email: store.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address_en || store.address_bn,
      addressLocality: "Dhaka",
      addressCountry: "BD",
    },
  };
}

export const localBusinessLd = {
  "@context": "https://schema.org",
  "@type": "GroceryStore",
  "@id": `${site.url}/#store`,
  name: site.nameBn,
  image: `${site.url}/images/hero/farm.jpg`,
  url: site.url,
  telephone: site.phone,
  priceRange: "৳৳",
  currenciesAccepted: "BDT",
  paymentAccepted: "Cash on Delivery, bKash, Nagad, Card",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "07:00",
      closes: "22:00",
    },
  ],
  address: {
    "@type": "PostalAddress",
    streetAddress: "House 12, Road 7, Dhanmondi",
    addressLocality: "Dhaka",
    postalCode: "1209",
    addressCountry: "BD",
  },
  geo: { "@type": "GeoCoordinates", latitude: 23.7461, longitude: 90.3742 },
  areaServed: { "@type": "Country", name: "Bangladesh" },
  parentOrganization: { "@id": `${site.url}/#organization` },
};

export const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${site.url}/#website`,
  url: site.url,
  name: site.nameBn,
  alternateName: site.nameEn,
  description: site.descriptionBn,
  inLanguage: "bn-BD",
  publisher: { "@id": `${site.url}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${site.url}/products?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/** BreadcrumbList from an ordered trail. The last item may omit `href`. */
export function breadcrumbLd(trail: { name: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      ...(crumb.href ? { item: absoluteUrl(crumb.href) } : {}),
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
