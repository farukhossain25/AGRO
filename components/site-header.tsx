"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Globe,
  Heart,
  Menu,
  Package,
  Phone,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { nav, site } from "@/lib/site";
import { Logo } from "./icon-logo";
import { CartDrawer } from "./cart-drawer";

type Cat = { slug: string; name_bn: string; name_en: string; icon: string | null };

export function SiteHeader({
  categories,
  user,
}: {
  categories: Cat[];
  user: { name: string | null; role?: string } | null;
}) {
  const { isBn, t, toggle, locale } = useLocale();
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setCatOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    setSearchOpen(false);
  }

  return (
    <>
      {/* ── Announcement bar */}
      <div className="relative overflow-hidden border-b border-leaf-600/25 bg-gradient-to-r from-leaf-800 via-leaf-700 to-leaf-800">
        <div className="container-x flex h-9 items-center justify-center gap-2 overflow-hidden">
          <p className="truncate text-center text-[11.5px] font-medium text-leaf-100 sm:text-xs">
            <span className="mr-1.5" aria-hidden>🚚</span>
            {t(
              "খামার থেকে সরাসরি আপনার পরিবারের খাবার টেবিলে · সারা বাংলাদেশে ডেলিভারি",
              "Straight from the farm to your family table · Nationwide delivery across Bangladesh"
            )}
          </p>
          <Link
            href={`tel:${site.phone}`}
            className="ml-3 hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-leaf-100/80 hover:text-white sm:flex"
          >
            <Phone className="h-3 w-3" />
            {site.phoneDisplay}
          </Link>
        </div>
      </div>

      {/* ── Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/85 backdrop-blur-xl">
        <div className="container-x">
          <div className="flex h-[62px] items-center gap-2 sm:h-[72px] sm:gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl text-sand-100/80 transition hover:bg-white/[0.06] lg:hidden"
              aria-label={t("মেনু খুলুন", "Open menu")}
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            <Logo />

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

            {/* Desktop search */}
            <form onSubmit={submitSearch} className="ml-auto hidden flex-1 max-w-sm md:block">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("পণ্য খুঁজুন… (যেমন: আম, ইলিশ)", "Search products… (mango, fish)")}
                  className="input !rounded-full !py-2.5 !pl-10 !pr-4 text-[13px]"
                  aria-label={t("পণ্য খুঁজুন", "Search products")}
                />
              </label>
            </form>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-0.5 md:ml-0">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-xl text-sand-100/80 transition hover:bg-white/[0.06] md:hidden"
                aria-label={t("খুঁজুন", "Search")}
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

              <Link
                href={user ? "/account" : "/login"}
                className="grid h-10 w-10 place-items-center rounded-xl text-sand-100/80 transition hover:bg-white/[0.06] hover:text-sand-100"
                aria-label={user ? t("আমার অ্যাকাউন্ট", "My account") : t("লগইন", "Login")}
              >
                <User className="h-5 w-5" />
              </Link>

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

          {/* Mobile search row */}
          {searchOpen ? (
            <form onSubmit={submitSearch} className="pb-3 md:hidden">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("পণ্য খুঁজুন…", "Search products…")}
                  className="input !rounded-full !py-2.5 !pl-10"
                  aria-label={t("পণ্য খুঁজুন", "Search products")}
                />
              </label>
            </form>
          ) : null}
        </div>
      </header>

      {/* ── Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
            aria-label={t("বন্ধ করুন", "Close")}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col border-r border-white/10 bg-ink-900 animate-[fade-up_.25s_ease]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
              <Logo />
              <button
                onClick={() => setMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-sand-100/60 hover:bg-white/10"
                aria-label={t("বন্ধ করুন", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <p className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-sand-100/35">
                {t("ক্যাটাগরি", "Categories")}
              </p>
              <div className="mb-4 space-y-0.5">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition hover:bg-white/[0.05]"
                  >
                    <span aria-hidden>{c.icon ?? "🌿"}</span>
                    {t(c.name_bn, c.name_en)}
                  </Link>
                ))}
              </div>

              <p className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-sand-100/35">
                {t("মেনু", "Menu")}
              </p>
              <div className="space-y-0.5">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition hover:bg-white/[0.05]"
                  >
                    {t(item.labelBn, item.labelEn)}
                  </Link>
                ))}
                <Link
                  href="/account"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition hover:bg-white/[0.05]"
                >
                  <Package className="h-4 w-4" /> {t("আমার অর্ডার", "My orders")}
                </Link>
              </div>
            </div>

            <div className="border-t border-white/[0.06] p-3">
              <button onClick={toggle} className="btn-ghost w-full !justify-start">
                <Globe className="h-4 w-4" />
                {locale === "bn" ? "English এ দেখুন" : "বাংলায় দেখুন"}
              </button>
              <a href={`tel:${site.phone}`} className="btn-primary mt-2 w-full">
                <Phone className="h-4 w-4" /> {site.phoneDisplay}
              </a>
            </div>
          </aside>
        </div>
      ) : null}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
