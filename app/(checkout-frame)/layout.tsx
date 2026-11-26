import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { CartSync } from "@/components/cart/cart-sync";
import { currentUser } from "@/lib/api";
import { getStoreSettings, defaultStoreSettings } from "@/lib/site-settings";
import { StoreInfoProvider } from "@/lib/store-info";

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
 *
 * StoreInfoProvider is NOT optional here: without it every `useStoreInfo()`
 * call inside checkout silently fell back to the hard-coded brand defaults, so
 * the "Need help? Call ০১৭০০-০০০০০০" line ignored whatever number the owner
 * had set in /foisal/settings — the number he was editing never appeared.
 */
export default async function CheckoutFrameLayout({ children }: { children: React.ReactNode }) {
  const [user, store] = await Promise.all([
    currentUser().catch(() => null),
    getStoreSettings().catch(() => defaultStoreSettings),
  ]);

  return (
    <StoreInfoProvider value={store}>
      <AuthProvider initialUser={user}>
        <CartSync />
        {/* Fonts are self-hosted (app/fonts.css) — no third-party font requests,
            which also keeps the strict CSP in middleware.ts happy. */}
        <main id="main" className="min-h-dvh">
          {children}
        </main>
      </AuthProvider>
    </StoreInfoProvider>
  );
}
