"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Globe,
  Headset,
  Info,
  Layers,
  MapPin,
  MessageSquare,
  Newspaper,
  Package,
  Phone,
  Search,
  ShoppingBag,
  Sprout,
  Store,
  User,
  Video,
  X,
} from "lucide-react";
import { nav, site } from "@/lib/site";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { Logo } from "./icon-logo";
import { SearchBox } from "./shop/search-box";

/* ==========================================================================
   MobileNav — the phone menu
   --------------------------------------------------------------------------
   The old drawer was one long scroll: nine categories, then ten links, then a
   footer that clipped the last row. This version groups by intent instead:

     ক্যাটাগরি  → an accordion (2-column emoji tiles), closed by default
     কিনুন      → combos, subscriptions, marketplace
     খামার      → live cameras, our farms
     আরও        → blog, tracking, about, contact
     account    → orders / sign-in, pinned above the footer

   The panel slides in from the left, rows follow it in with a 35 ms stagger,
   and the footer is a sticky gradient so the scroll content fades out behind
   it instead of colliding with it.
   ========================================================================== */

type Cat = { slug: string; name_bn: string; name_en: string; icon: string | null };

type Group = {
  titleBn: string;
  titleEn: string;
  items: { href: string; labelBn: string; labelEn: string; Icon: typeof Layers }[];
};

/** nav → intent groups. Anything unrecognised falls into "আরও". */
const GROUP_OF: Record<string, { Icon: typeof Layers; group: 0 | 1 | 2 }> = {
  "/combos": { Icon: Layers, group: 0 },
  "/subscription": { Icon: CalendarDays, group: 0 },
  "/market": { Icon: Store, group: 0 },
  "/live": { Icon: Video, group: 1 },
  "/farm": { Icon: Sprout, group: 1 },
  "/blog": { Icon: Newspaper, group: 2 },
  "/track": { Icon: MapPin, group: 2 },
  "/about": { Icon: Info, group: 2 },
  "/contact": { Icon: MessageSquare, group: 2 },
};

const GROUPS: Group[] = [
  { titleBn: "কিনুন", titleEn: "Shop", items: [] },
  { titleBn: "খামার", titleEn: "Farms", items: [] },
  { titleBn: "আরও", titleEn: "More", items: [] },
];

for (const item of nav) {
  const meta = GROUP_OF[item.href];
  if (!meta) continue;
  GROUPS[meta.group].items.push({ href: item.href, labelBn: item.labelBn, labelEn: item.labelEn, Icon: meta.Icon });
}

export function MobileNav({
  open,
  onClose,
  onOpenCart,
  categories,
  user,
}: {
  open: boolean;
  onClose: () => void;
  /** opens the cart drawer that lives in the header */
  onOpenCart: () => void;
  categories: Cat[];
  user: { name: string | null } | null;
}) {
  const { t, toggle, locale } = useLocale();
  const pathname = usePathname();
  const cart = useCart();
  const [catsOpen, setCatsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);

  /* close on Escape, and lock the page behind the panel */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /* keyboard users land inside the panel, and get their place back on close */
    const returnTo = document.activeElement as HTMLElement | null;
    window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  /* reset the inner state each time it closes */
  useEffect(() => {
    if (open) return;
    const t2 = window.setTimeout(() => {
      setCatsOpen(false);
      setSearching(false);
    }, 200);
    return () => window.clearTimeout(t2);
  }, [open]);

  if (!open) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  let step = 0;
  const delay = () => `${120 + step++ * 35}ms`;

  return (
    <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label={t("মেনু", "Menu")}>
      <button
        className="mob-scrim absolute inset-0 bg-ink-950/70 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label={t("বন্ধ করুন", "Close menu")}
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        className="mob-drawer absolute inset-y-0 left-0 flex w-[88%] max-w-[392px] flex-col overflow-hidden rounded-r-[30px] border-r border-white/[0.08] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)]"
        style={{
          background:
            "linear-gradient(158deg, #0b1510 0%, #091009 42%, #0a1410 72%, #0c1a13 100%)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* decorative glow + right edge highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-leaf-600/20 blur-[70px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-leaf-400/25 to-transparent"
        />

        {/* ── header ─────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between px-4 pb-3 pt-4">
          <Logo size={38} />
          <button
            data-autofocus
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-sand-100/70 transition duration-300 hover:rotate-90 hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-95"
            aria-label={t("বন্ধ করুন", "Close menu")}
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* ── search ─────────────────────────────────────────────── */}
        <div className="relative px-4 pb-3">
          {searching ? (
            <div className="mob-item">
              <SearchBox autoFocus onSubmitted={onClose} />
            </div>
          ) : (
            <button
              onClick={() => setSearching(true)}
              className="mob-item flex h-11 w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 text-left text-[13px] text-sand-100/45 transition hover:border-leaf-500/40 hover:bg-white/[0.06]"
              style={{ ["--d" as string]: delay() }}
            >
              <Search className="h-4 w-4 shrink-0 text-sand-100/40" />
              {t("পণ্য খুঁজুন…", "Search products…")}
            </button>
          )}
        </div>

        {/* ── scrollable body ────────────────────────────────────── */}
        <div className="mob-scroll relative flex-1 overflow-y-auto overscroll-contain px-3 pb-24">
          {/* cart shortcut — the header badge is the only cart affordance on a
              phone, and it is 44px away from the drawer */}
          <button
            onClick={() => {
              onClose();
              // one tick later: the menu unmounts on the same click otherwise
              window.setTimeout(onOpenCart, 60);
            }}
            className="mob-item mb-1 flex w-full items-center gap-3 rounded-2xl border border-leaf-500/25 bg-leaf-600/[0.10] px-3 py-2.5 text-left transition hover:border-leaf-500/40 hover:bg-leaf-600/[0.16] active:scale-[0.99]"
            style={{ ["--d" as string]: delay() }}
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-600/25 text-leaf-100 ring-1 ring-inset ring-leaf-400/25">
              <ShoppingBag className="h-[17px] w-[17px]" />
              {cart.count > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sand-100 px-1 text-[10px] font-bold leading-none text-ink-900">
                  {cart.count}
                </span>
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">{t("আমার কার্ট", "My cart")}</span>
              <span className="block text-[11px] text-sand-100/45">
                {cart.count > 0
                  ? t(`${cart.count} টি পণ্য · ৳${cart.subtotal}`, `${cart.count} items · ৳${cart.subtotal}`)
                  : t("এখনো খালি", "Still empty")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-leaf-200/60" />
          </button>

          {/* categories accordion */}
          <button
            onClick={() => setCatsOpen((v) => !v)}
            aria-expanded={catsOpen}
            className={`mob-item flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
              catsOpen ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
            }`}
            style={{ ["--d" as string]: delay() }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-600/15 text-leaf-200 ring-1 ring-inset ring-white/[0.06]">
              <ShoppingBag className="h-[17px] w-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-sand-100">{t("ক্যাটাগরি", "Categories")}</span>
              <span className="block text-[11px] text-sand-100/40">
                {t(`${categories.length} টি বিভাগ`, `${categories.length} departments`)}
              </span>
            </span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-sand-100/40 transition-transform duration-300 ${catsOpen ? "rotate-90" : ""}`}
            />
          </button>

          <div className="mob-collapse" data-open={catsOpen}>
            <div>
              <div className="grid grid-cols-2 gap-1.5 px-1 pb-2 pt-2">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    onClick={onClose}
                    className="group flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-2.5 py-2 text-[12.5px] text-sand-100/80 transition hover:border-leaf-500/40 hover:bg-leaf-600/10 hover:text-white active:scale-[0.98]"
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {c.icon ?? "🌿"}
                    </span>
                    <span className="line-clamp-2 leading-tight">{t(c.name_bn, c.name_en)}</span>
                  </Link>
                ))}
                <Link
                  href="/categories"
                  onClick={onClose}
                  className="col-span-2 mt-0.5 flex items-center justify-center gap-1.5 rounded-xl bg-leaf-600/15 px-2.5 py-2 text-[12px] font-semibold text-leaf-200 transition hover:bg-leaf-600/25"
                >
                  {t("সব ক্যাটাগরি দেখুন", "View all categories")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* grouped links */}
          {GROUPS.filter((g) => g.items.length > 0).map((group) => (
            <section key={group.titleBn} className="mt-3">
              <p
                className="mob-item px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sand-100/30"
                style={{ ["--d" as string]: delay() }}
              >
                {t(group.titleBn, group.titleEn)}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, labelBn, labelEn, Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`mob-item group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition active:scale-[0.99] ${
                        active ? "bg-leaf-600/[0.14] text-white" : "text-sand-100/80 hover:bg-white/[0.04] hover:text-white"
                      }`}
                      style={{ ["--d" as string]: delay() }}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-leaf-300 to-leaf-500"
                        />
                      ) : null}
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset transition-colors ${
                          active
                            ? "bg-leaf-600/25 text-leaf-100 ring-leaf-400/25"
                            : "bg-white/[0.04] text-leaf-200/80 ring-white/[0.06] group-hover:bg-leaf-600/15 group-hover:text-leaf-100"
                        }`}
                      >
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t(labelBn, labelEn)}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sand-100/25 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-sand-100/50" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {/* account */}
          <section className="mt-3">
            <p
              className="mob-item px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sand-100/30"
              style={{ ["--d" as string]: delay() }}
            >
              {t("আমার অ্যাকাউন্ট", "My account")}
            </p>

            {user ? (
              <div className="space-y-0.5">
                <Link
                  href="/account/orders"
                  onClick={onClose}
                  className="mob-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium text-sand-100/80 transition hover:bg-white/[0.04] hover:text-white"
                  style={{ ["--d" as string]: delay() }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-leaf-200/80 ring-1 ring-inset ring-white/[0.06]">
                    <Package className="h-[17px] w-[17px]" />
                  </span>
                  <span className="flex-1 truncate">{t("আমার অর্ডার", "My orders")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-sand-100/25" />
                </Link>
                <Link
                  href="/account"
                  onClick={onClose}
                  className="mob-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium text-sand-100/80 transition hover:bg-white/[0.04] hover:text-white"
                  style={{ ["--d" as string]: delay() }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-leaf-200/80 ring-1 ring-inset ring-white/[0.06]">
                    <User className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {user.name ?? t("আমার প্রোফাইল", "My profile")}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-sand-100/25" />
                </Link>
              </div>
            ) : (
              <div className="mob-item grid grid-cols-[1fr_auto] gap-1.5 px-1" style={{ ["--d" as string]: delay() }}>
                <Link
                  href="/login"
                  onClick={onClose}
                  className="flex min-h-[44px] items-center justify-center rounded-2xl bg-gradient-to-b from-leaf-500 to-leaf-600 px-3 text-[13.5px] font-semibold text-white shadow-[0_14px_30px_-18px_rgba(31,122,77,1)] transition hover:from-leaf-400 hover:to-leaf-500 active:scale-[0.99]"
                >
                  {t("লগইন করুন", "Sign in")}
                </Link>
                <Link
                  href="/login?mode=signup"
                  onClick={onClose}
                  className="flex min-h-[44px] items-center justify-center rounded-2xl border border-leaf-500/40 px-3 text-[13.5px] font-semibold text-leaf-200 transition hover:bg-leaf-600/15 active:scale-[0.99]"
                >
                  {t("সাইন আপ", "Sign up")}
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* ── sticky footer ──────────────────────────────────────── */}
        <div
          className="relative shrink-0 px-4 pt-3"
          style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[#0b1510] to-transparent"
          />
          <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2">
            <div className="flex items-center gap-1 rounded-xl bg-black/25 p-1">
              {(
                [
                  { key: "bn" as const, label: "বাংলা" },
                  { key: "en" as const, label: "English" },
                ]
              ).map((option) => {
                const active = locale === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (!active) toggle();
                    }}
                    aria-pressed={active}
                    className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition ${
                      active ? "bg-white/[0.09] text-white shadow-inner" : "text-sand-100/45 hover:text-sand-100/80"
                    }`}
                  >
                    {option.key === "en" ? <Globe className="h-3.5 w-3.5" /> : null}
                    {option.label}
                  </button>
                );
              })}
            </div>

            <a
              href={`tel:${site.phone}`}
              className="mt-2 flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-leaf-500 to-leaf-600 text-[13.5px] font-semibold text-white shadow-[0_16px_34px_-20px_rgba(31,122,77,1)] transition hover:from-leaf-400 hover:to-leaf-500 active:scale-[0.99]"
            >
              <Phone className="h-4 w-4" />
              <span className="tabular-nums">{site.phoneDisplay}</span>
            </a>

            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-sand-100/35">
              <Headset className="h-3 w-3" />
              {t("সকাল ৭টা – রাত ১০টা, প্রতিদিন", "7 am – 10 pm, every day")}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
