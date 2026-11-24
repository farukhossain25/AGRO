import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LumenStudio — Kits",
  robots: { index: false, follow: false },
};

/**
 * LumenStudio lives in its own route group so it renders as a self-contained
 * premium commerce frame (sticky nav + footer, per the design spec) instead
 * of the storefront site chrome. Typography is the project's own self-hosted
 * stack — the strict CSP allows no third-party font origin.
 */
export default function LumenLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="min-h-dvh">
      {children}
    </main>
  );
}
