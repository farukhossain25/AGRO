import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.nameBn} | ${site.taglineBn}`,
    template: `%s | ${site.nameBn}`,
  },
  description: site.descriptionBn,
  keywords: [
    "বিশ্বাস এগ্রো",
    "Biswas Agro",
    "অর্গানিক সবজি",
    "তাজা শাকসবজি ডেলিভারি",
    "খামার থেকে ঘরে",
    "organic food bangladesh",
    "fresh vegetables delivery dhaka",
    "দেশি ডিম",
    "খাঁটি মধু",
    "মাসিক ফুড প্যাকেজ",
  ],
  authors: [{ name: site.nameEn, url: site.url }],
  creator: site.nameEn,
  publisher: site.nameBn,
  alternates: {
    canonical: "/",
    languages: { "bn-BD": "/", "en-US": "/?lang=en" },
  },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
    url: site.url,
    siteName: site.nameEn,
    title: `${site.nameBn} — ${site.taglineBn}`,
    description: site.descriptionBn,
    images: [
      {
        url: "/images/cat/vegetables.jpg",
        width: 1200,
        height: 630,
        alt: "বিশ্বাস এগ্রো — খামার থেকে তাজা সবজি",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.nameBn} — ${site.taglineBn}`,
    description: site.descriptionBn,
    images: ["/images/cat/vegetables.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "shopping",
  applicationName: site.nameBn,
  formatDetection: { telephone: true, address: true },
};

export const viewport: Viewport = {
  themeColor: "#111312",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "GroceryStore",
  name: site.nameBn,
  alternateName: site.nameEn,
  description: site.descriptionBn,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  image: `${site.url}/images/cat/vegetables.jpg`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "House 12, Road 7, Dhanmondi",
    addressLocality: "Dhaka",
    postalCode: "1209",
    addressCountry: "BD",
  },
  openingHours: "Mo-Su 07:00-22:00",
  priceRange: "৳৳",
  sameAs: [site.social.facebook, site.social.youtube, site.social.instagram],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://lyihdzgmtjkkhybpkqot.supabase.co" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-leaf-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          মূল কন্টেন্টে যান
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
