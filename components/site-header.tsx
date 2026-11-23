"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Globe,
  Heart,
  Menu,
  Search,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { nav, site } from "@/lib/site";
import { Logo } from "./icon-logo";
import { CartDrawer } from "./cart-drawer";
import { SocialLinks } from "./social-links";
import { UserMenu } from "./account/user-menu";
import { SearchBox } from "./shop/search-box";
import { MobileNav } from "./mobile-nav";

type Cat = { slug: string; name_bn: string; name_en: string; icon: string | null };

export function SiteHeader({
  categories,
  user,
  socials,
}: {
  categories: Cat[];
  user: { name: string | null; role?: string; avatar?: string | null; premium?: boolean } | null;
  /** Server-rendered social icons (admin-managed). */
  socials?: React.ReactNode;
}) {
  const { t, toggle, locale } = useLocale();
  const cart = useCart();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setCatOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Header */}
      <header
        className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/85 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="container-x">
          <div className="flex h-[62px] items-center gap-1.5 min-[400px]:gap-2 sm:h-[72px] sm:gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sand-100/85 transition duration-300 hover:border-leaf-500/40 hover:bg-leaf-600/10 hover:text-white active:scale-95 lg:hidden"
              aria-label={t("মেনু খুলুন", "Open menu")}
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 shrink">
              <Logo />
            </div>

            {/* Desktop social icons — admin-managed, hidden on small screens */}
            {socials ? <div className="ml-auto hidden items-center xl:flex">{socials}</div> : null}

            {/* Desktop nav */}
            <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label={t("প্রধান মেনু", "Main navigation")}>
              <div className="relative">
                <button
                  onClick={() => setCatOpen((v) => !v)}
                  onBlur={() => window.setTimeout(() => setCatOpen(false), 150)}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-[13.5px] font-medium text-sand-100/80 transition hover:bg-white/[0.06] hover:text-sand-100"
                  aria-expanded={catOpen}
                >
                  {t("ক্যাটাগরি", "Categories")}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${catOpen ? "rotate-180" : ""}`} />
                </button>
                {catOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-2 grid w-[520px] grid-cols-2 gap-0.5 rounded-2xl border border-white/10 bg-ink-850 p-2 shadow-soft animate-pop">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/categories/${c.slug}`}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition hover:bg-leaf-600/15"
                      >
                        <span className="text-base" aria-hidden>{c.icon ?? "🌿"}</span>
                        <span className="font-medium">{t(c.name_bn, c.name_en)}</span>
                      </Link>
                    ))}
                    <Link
                      href="/categories"
                      className="col-span-2 mt-1 rounded-xl bg-leaf-600/15 px-3 py-2.5 text-center text-[12.5px] font-semibold text-leaf-200 hover:bg-leaf-600/25"
                    >
                      {t("সব ক্যাটাগরি দেখুন →", "View all categories →")}
                    </Link>
                  </div>
                ) : null}
              </div>

              {nav.slice(0, 5).map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2 text-[13.5px] font-medium transition hover:bg-white/[0.06] ${
                      active ? "text-leaf-200" : "text-sand-100/80 hover:text-sand-100"
                    }`}
                  >
                    {t(item.labelBn, item.labelEn)}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop search — with live suggestions (see components/shop/search-box) */}
            <div className="ml-auto hidden min-w-0 max-w-sm flex-1 xl:block">
              <SearchBox />
            </div>

            {/* Actions */}
            <div className="ml-auto flex shrink-0 items-center gap-0.5 xl:ml-0">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-xl text-sand-100/80 transition hover:bg-white/[0.06] xl:hidden"
                aria-label={t("খুঁজুন", "Search")}
                aria-expanded={searchOpen}
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                onClick={toggle}
                className="hidden items-center gap-1 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-sand-100/70 transition hover:bg-white/[0.06] hover:text-sand-100 sm:flex"
                aria-label={t("ভাষা পরিবর্তন", "Change language")}
              >
                <Globe className="h-4 w-4" />
                {locale === "bn" ? "বাংলা" : "English"}
              </button>

              <Link
                href="/account/wishlist"
                className="hidden h-10 w-10 place-items-center rounded-xl text-sand-100/70 transition hover:bg-white/[0.06] hover:text-sand-100 sm:grid"
                aria-label={t("পছন্দের তালিকা", "Wishlist")}
              >
                <Heart className="h-5 w-5" />
              </Link>

              {/* Identity comes from AuthProvider (Supabase session); the server
                  prop only carries the premium badge. */}
              <UserMenu premium={user?.premium ?? false} />

              <button
                onClick={() => setCartOpen(true)}
                className="relative grid h-10 w-10 place-items-center rounded-xl text-sand-100/80 transition hover:bg-white/[0.06] hover:text-sand-100"
                aria-label={t(`কার্ট, ${cart.count}টি পণ্য`, `Cart, ${cart.count} items`)}
              >
                <ShoppingBag className="h-5 w-5" />
                {cart.count > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-leaf-400 px-1 text-[10px] font-bold text-ink-900">
                    {cart.count}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Mobile / tablet search row — same component, so the suggestions
              and the keyboard behaviour are identical on every screen size. */}
          {searchOpen ? (
            <div className="pb-3 xl:hidden">
              <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} />
            </div>
          ) : null}

        </div>
      </header>

      <MobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenCart={() => setCartOpen(true)}
        categories={categories}
        user={user ? { name: user.name } : null}
      />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
