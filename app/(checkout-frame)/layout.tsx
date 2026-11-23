import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { CartSync } from "@/components/cart/cart-sync";
import { currentUser } from "@/lib/api";

export const metadata: Metadata = {
  title: "চেকআউট",
  robots: { index: false, follow: false },
};

/**
 * Checkout gets its own route group so it can render as a self-contained
 * premium frame (sticky nav + slim footer, per the design spec) instead of
 * the usual storefront chrome (site header, announcement marquee, footer,
 * floating widgets). Cart sync + auth are still wired so a signed-in
 * customer's cart and session behave exactly as elsewhere.
 */
export default async function CheckoutFrameLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);

  return (
    <AuthProvider initialUser={user}>
      <CartSync />
      <head>
        {/* Inter via Google Fonts CDN, per the checkout design spec */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    </AuthProvider>
  );
}
