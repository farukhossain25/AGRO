import { AuthProvider } from "@/components/auth/auth-provider";
import { CartSync } from "@/components/cart/cart-sync";
import { SiteHeader } from "@/components/site-header";
import { AnnouncementMarquee } from "@/components/announcement-marquee";
import { SiteFooter, type FooterPaymentMethod } from "@/components/site-footer";
import { SocialLinks } from "@/components/social-links";
import { FloatingActions } from "@/components/floating-actions";
import { currentUser } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { resolvePremiumState } from "@/lib/premium";
import { getCategories } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";
import { getPublicMethods } from "@/lib/payment-methods";
import { getAnnouncementSettings, getStoreSettings, defaultStoreSettings } from "@/lib/site-settings";
import { StoreInfoProvider } from "@/lib/store-info";

/**
 * Storefront chrome lives here (not in the root layout) so that the panel can
 * render its own shell without the public header, footer and floating widgets.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [categories, user, announcement, store, methods] = await Promise.all([
    getCategories().catch(() => []),
    currentUser().catch(() => null),
    getAnnouncementSettings().catch(() => null),
    getStoreSettings().catch(() => defaultStoreSettings),
    // the footer's payment tiles: active methods + the logo the admin uploaded
    isDbConfigured() ? getPublicMethods().catch(() => []) : Promise.resolve([]),
  ]);

  const paymentMethods: FooterPaymentMethod[] = methods.map((m) => ({
    code: m.code,
    name_bn: m.name_bn,
    name_en: m.name_en,
    kind: m.kind,
    logo_url: m.logo_url,
  }));

  // Header avatar + premium badge — one extra read, fails soft.
  const [profile, premium] = user
    ? await Promise.all([
        getProfileByLegacyId(user.id).catch(() => null),
        resolvePremiumState(user.id, user.role).catch(() => null),
      ])
    : [null, null];

  const navCats = categories.map((c) => ({
    slug: c.slug,
    name_bn: c.name_bn,
    name_en: c.name_en,
    icon: c.icon,
  }));

  return (
    <StoreInfoProvider value={store}>
    <AuthProvider initialUser={user}>
      <CartSync />
      {announcement ? <AnnouncementMarquee settings={announcement} /> : null}
      <SiteHeader
        socials={<SocialLinks placement="header" size="sm" />}
        categories={navCats}
        user={
          user
            ? {
                name: user.name,
                role: user.role,
                avatar: profile?.avatar_url ?? null,
                premium: premium?.canWatch ?? false,
              }
            : null
        }
      />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter
        categories={navCats}
        paymentMethods={paymentMethods}
        socials={<SocialLinks placement="footer" className="mt-5" />}
      />
      <FloatingActions />
    </AuthProvider>
    </StoreInfoProvider>
  );
}
