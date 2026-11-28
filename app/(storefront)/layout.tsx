import { AuthProvider } from "@/components/auth/auth-provider";
import { CartSync } from "@/components/cart/cart-sync";
import { SiteHeader } from "@/components/site-header";
import { AnnouncementMarquee } from "@/components/announcement-marquee";
import { SiteFooter, type FooterPaymentMethod } from "@/components/site-footer";
import { SocialLinks } from "@/components/social-links";
import { ContactBubble } from "@/components/chat/contact-bubble";
import { currentUser } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { resolvePremiumState } from "@/lib/premium";
import { getCategories } from "@/lib/data";
import { isDbConfigured } from "@/lib/db";
import { withShellDeadline } from "@/lib/fetch-deadline";
import { getFooterPaymentMethods } from "@/lib/payment-methods";
import { getAnnouncementSettings, getStoreSettings, defaultStoreSettings } from "@/lib/site-settings";
import { StoreInfoProvider } from "@/lib/store-info";

/**
 * Storefront chrome lives here (not in the root layout) so that the panel can
 * render its own shell without the public header, footer and floating widgets.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  /* THE SHELL NEVER HOLDS THE DOCUMENT FOR LONG
     A layout wraps every page, so whatever this function awaits delays the
     entire response — header, page and footer alike. It used to await five
     reads here plus two more behind them, with no ceiling: one stalled query
     was enough to hold the whole site.

     A Suspense boundary around the chrome was the obvious fix and is the wrong
     one: it would put `children` inside that boundary too, so the page would
     still wait for the shell, and the fallback would duplicate `<main id="main">`
     while streaming. Instead the shell's own budget is capped well below the
     client deadline (`SHELL_TIMEOUT_MS`, 2 s): on a healthy database it costs
     one warm round-trip and no fallback is ever seen; on a sick one the chrome
     degrades to sensible defaults and the page streams immediately. */
  const [categories, user, announcement, store, methods] = await withShellDeadline(
    Promise.all([
      getCategories().catch(() => []),
      currentUser().catch(() => null),
      getAnnouncementSettings().catch(() => null),
      getStoreSettings().catch(() => defaultStoreSettings),
      // the footer's payment tiles: active + show_on_checkout, in the admin's
      // order (that order decides which logos appear first), read per request so
      // add/remove/reorder/hide is live without a redeploy
      isDbConfigured() ? getFooterPaymentMethods().catch(() => []) : Promise.resolve([]),
    ]),
    [[] as Awaited<ReturnType<typeof getCategories>>, null, null, defaultStoreSettings, []] as const,
  );

  const paymentMethods: FooterPaymentMethod[] = methods.map((m) => ({
    code: m.code,
    name_bn: m.name_bn,
    name_en: m.name_en,
    kind: m.kind as string,
    logo_url: m.logo_url,
  }));

  // Header avatar + premium badge — both reads depend on `user`, so they are a
  // second round-trip after the first block. They are already parallel with
  // each other; keeping them out of the first Promise.all is unavoidable
  // (no user → nothing to look up) and each is individually cheap. What
  // mattered was capping how long either can hold the tree: both clients now
  // carry a fetch deadline (lib/fetch-deadline.ts).
  /* Also inside the budget: these two only run for a signed-in visitor, which
     made the slow path depend on whether a cookie happened to be present —
     exactly the kind of variable latency that turns into "sometimes the site
     hangs". Past two seconds the avatar and the premium badge fall back and the
     page renders; the session itself was already established above. */
  const [profile, premium] = user
    ? await withShellDeadline(
        Promise.all([
          getProfileByLegacyId(user.id).catch(() => null),
          resolvePremiumState(user.id, user.role).catch(() => null),
        ]),
        [null, null] as const,
      )
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
      <ContactBubble />
    </AuthProvider>
    </StoreInfoProvider>
  );
}
