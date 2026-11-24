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
      {/* Fonts are self-hosted (app/fonts.css) — no third-party font requests,
          which also keeps the strict CSP in middleware.ts happy. */}
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    </AuthProvider>
  );
}
