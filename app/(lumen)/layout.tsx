import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LumenStudio — Kits",
  robots: { index: false, follow: false },
};

/**
 * LumenStudio lives in its own route group so it renders as a self-contained
 * premium commerce frame (sticky nav + footer, per the design spec) instead
 * of the storefront site chrome. Inter is loaded via Google Fonts CDN.
 */
export default function LumenLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    </>
  );
}
