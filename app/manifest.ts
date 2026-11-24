import type { MetadataRoute } from "next";

/**
 * PWA manifest — served at /manifest.webmanifest and picked up by the
 * <link rel="manifest"> in the root layout. The Android wrapper (Capacitor)
 * uses the same icon set.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "বিশ্বাস এগ্রো — খামার থেকে আপনার ঘরে",
    short_name: "বিশ্বাস এগ্রো",
    description:
      "বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে। তাজা শাকসবজি, দুধ, ডিম, মাছ ও অর্গানিক পণ্য — সাথে লাইভ খামার ক্যামেরা।",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /* Matches the top of the iOS launch-screen gradient (scripts/generate-brand.mjs). */
    background_color: "#0a2a1b",
    theme_color: "#1f7a4d",
    lang: "bn-BD",
    dir: "ltr",
    categories: ["shopping", "food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "লাইভ খামার", short_name: "লাইভ", url: "/live", description: "খামারের লাইভ ক্যামেরা" },
      { name: "কার্ট", short_name: "কার্ট", url: "/cart", description: "আপনার কার্ট" },
      { name: "অর্ডার ট্র্যাক", short_name: "ট্র্যাক", url: "/track", description: "অর্ডার কোথায়" },
    ],
  };
}
