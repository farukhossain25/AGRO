import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingActions } from "@/components/floating-actions";
import { currentUser } from "@/lib/api";
import { getCategories } from "@/lib/data";

/**
 * Storefront chrome lives here (not in the root layout) so that /admin can
 * render its own shell without the public header, footer and floating widgets.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [categories, user] = await Promise.all([
    getCategories().catch(() => []),
    currentUser().catch(() => null),
  ]);

  const navCats = categories.map((c) => ({
    slug: c.slug,
    name_bn: c.name_bn,
    name_en: c.name_en,
    icon: c.icon,
  }));

  return (
    <>
      <SiteHeader categories={navCats} user={user ? { name: user.name, role: user.role } : null} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter categories={navCats} />
      <FloatingActions />
    </>
  );
}
