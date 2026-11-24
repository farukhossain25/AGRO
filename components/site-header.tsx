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
import { nav } from "@/lib/site";
import { Logo } from "./icon-logo";
import { CartDrawer } from "./cart-drawer";
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
      {/* ── Header — a floating neumorphic bar with the page scrolling behind */}
      <header
        className="sticky top-0 z-50 px-2 pt-2 sm:px-4 sm:pt-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="container-x !px-0 sm:!px-0">
          <div className="neu-bar flex h-[62px] items-center gap-1.5 rounded-[24px] px-2 min-[400px]:gap-2 sm:h-[70px] sm:gap-3 sm:rounded-[28px] sm:px-3.5">
            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="neu-icon-btn h-11 w-11 shrink-0 lg:hidden"
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
            <nav className="ml-1 hidden items-center gap-0.5 lg:flex" aria-label={t("প্রধান মেনু", "Main navigation")}>
              <div className="relative">
                <button
                  onClick={() => setCatOpen((v) => !v)}
                  onBlur={() => window.setTimeout(() => setCatOpen(false), 150)}
                  className="flex items-center gap-1 rounded-full px-3.5 py-2 text-[13.5px] font-medium text-neu-muted transition hover:text-neu-ink"
                  aria-expanded={catOpen}
                >
                  {t("ক্যাটাগরি", "Categories")}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${catOpen ? "rotate-180" : ""}`} />
                </button>
                {catOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-3 grid w-[520px] grid-cols-2 gap-0.5 rounded-[26px] border border-white/80 bg-neu-surface p-2 shadow-neu animate-pop">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/categories/${c.slug}`}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] text-neu-ink transition hover:bg-white/70 hover:text-neu-accent-strong"
                      >
                        <span className="text-base" aria-hidden>{c.icon ?? "🌿"}</span>
                        <span className="font-medium">{t(c.name_bn, c.name_en)}</span>
                      </Link>
                    ))}
                    <Link
                      href="/categories"
                      className="col-span-2 mt-1 rounded-2xl bg-neu-accent-soft px-3 py-2.5 text-center text-[12.5px] font-semibold text-neu-accent-strong transition hover:bg-neu-accent hover:text-white"
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
                    className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition ${
                      active
                        ? "bg-neu-raised text-neu-accent-strong shadow-neu-xs"
                        : "text-neu-muted hover:bg-white/50 hover:text-neu-ink"
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
            <div className="ml-auto flex shrink-0 items-center gap-1 xl:ml-0">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="neu-icon-btn h-10 w-10 xl:hidden"
                aria-label={t("খুঁজুন", "Search")}
                aria-expanded={searchOpen}
              >
                <Search className="h-[18px] w-[18px]" />
              </button>

              <button
                onClick={toggle}
                className="hidden items-center gap-1 rounded-full px-2.5 py-2 text-[12px] font-semibold text-neu-muted transition hover:text-neu-ink sm:flex"
                aria-label={t("ভাষা পরিবর্তন", "Change language")}
              >
                <Globe className="h-4 w-4" />
                {locale === "bn" ? "বাংলা" : "English"}
              </button>

              <Link
                href="/account/wishlist"
                className="neu-icon-btn hidden h-10 w-10 sm:grid"
                aria-label={t("পছন্দের তালিকা", "Wishlist")}
              >
                <Heart className="h-[18px] w-[18px]" />
              </Link>

              {/* Identity comes from AuthProvider (Supabase session); the server
                  prop only carries the premium badge. */}
              <UserMenu premium={user?.premium ?? false} />

              <button
                onClick={() => setCartOpen(true)}
                className="neu-icon-btn relative h-10 w-10"
                aria-label={t(`কার্ট, ${cart.count}টি পণ্য`, `Cart, ${cart.count} items`)}
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
                {cart.count > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neu-accent px-1 text-[10px] font-bold text-white shadow-neu-xs">
                    {cart.count}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Mobile / tablet search row — same component, so the suggestions
              and the keyboard behaviour are identical on every screen size. */}
          {searchOpen ? (
            <div className="animate-fade-in px-1 pb-1 pt-2 xl:hidden">
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
