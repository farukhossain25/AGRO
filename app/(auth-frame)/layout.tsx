import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { CartSync } from "@/components/cart/cart-sync";
import { currentUser } from "@/lib/api";
import { getStoreSettings, defaultStoreSettings } from "@/lib/site-settings";
import { StoreInfoProvider } from "@/lib/store-info";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /login gets its own route group so the sign-in screen owns the whole
 * viewport.
 *
 * WHY THIS EXISTS
 *   Login used to live inside (storefront), which renders the announcement
 *   marquee, the site header, the footer and the floating contact bubble
 *   around whatever page is inside it. On a phone that chrome pushed the form
 *   down and boxed it into a rounded card — a "frame" around a page that is
 *   only ever one screen tall. The form scrolled inside a container instead of
 *   the browser, so the submit button sat below the fold.
 *
 *   A route group is the cheapest fix that touches no other page: same URL,
 *   same metadata, but nothing is painted that the page did not ask for.
 *
 * WHAT MUST STAY
 *   AuthProvider — LoginForm calls useAuth() and expects the provider.
 *   CartSync     — signing in adopts a guest cart; without it a customer who
 *                  adds items and then logs in loses them.
 *   StoreInfoProvider — the "সমস্যা হচ্ছে?" line and the footer phone number
 *                  read the owner's numbers from here, not hard-coded strings.
 */
export default async function AuthFrameLayout({ children }: { children: React.ReactNode }) {
  const [user, store] = await Promise.all([
    currentUser().catch(() => null),
    getStoreSettings().catch(() => defaultStoreSettings),
  ]);

  return (
    <StoreInfoProvider value={store}>
      <AuthProvider initialUser={user}>
        <CartSync />
        <main id="main">{children}</main>
      </AuthProvider>
    </StoreInfoProvider>
  );
}
