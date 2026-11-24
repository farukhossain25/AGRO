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
        className="mob-scrim absolute inset-0 bg-neu-ink/35 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label={t("বন্ধ করুন", "Close menu")}
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        className="mob-drawer absolute inset-y-0 left-0 flex w-[88%] max-w-[392px] flex-col overflow-hidden rounded-r-[30px] border-r border-white/80 shadow-neu-lg"
        style={{
          background: "linear-gradient(158deg, #F2F5FA 0%, #E7ECF4 45%, #E3E8F0 100%)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* decorative glow + right edge highlight */}
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-neu-accent/10 blur-[70px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/70 to-transparent"
        />

        {/* ── header ─────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between px-4 pb-3 pt-4">
          <Logo size={38} />
          <button
            data-autofocus
            onClick={onClose}
            className="neu-icon-btn h-11 w-11"
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
              className="mob-item neu-inset-sm flex h-11 w-full items-center gap-2.5 rounded-2xl px-3.5 text-left text-[13px] text-neu-muted transition hover:text-neu-ink"
              style={{ ["--d" as string]: delay() }}
            >
              <Search className="h-4 w-4 shrink-0 text-neu-faint" />
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
            className="mob-item mb-1 flex w-full items-center gap-3 rounded-2xl border border-white/80 bg-neu-accent-soft/70 px-3 py-2.5 text-left shadow-neu-xs transition hover:bg-neu-accent-soft active:scale-[0.99]"
            style={{ ["--d" as string]: delay() }}
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neu-accent text-white shadow-neu-accent-sm">
              <ShoppingBag className="h-[17px] w-[17px]" />
              {cart.count > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-neu-ink px-1 text-[10px] font-bold leading-none text-white">
                  {cart.count}
                </span>
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-neu-ink">{t("আমার কার্ট", "My cart")}</span>
              <span className="block text-[11px] text-neu-muted">
                {cart.count > 0
                  ? t(`${cart.count} টি পণ্য · ৳${cart.subtotal}`, `${cart.count} items · ৳${cart.subtotal}`)
                  : t("এখনো খালি", "Still empty")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neu-accent" />
          </button>

          {/* categories accordion */}
          <button
            onClick={() => setCatsOpen((v) => !v)}
            aria-expanded={catsOpen}
            className={`mob-item flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
              catsOpen ? "bg-white/70 shadow-neu-xs" : "hover:bg-white/50"
            }`}
            style={{ ["--d" as string]: delay() }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neu-accent-soft text-neu-accent-strong">
              <ShoppingBag className="h-[17px] w-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-neu-ink">{t("ক্যাটাগরি", "Categories")}</span>
              <span className="block text-[11px] text-neu-muted">
                {t(`${categories.length} টি বিভাগ`, `${categories.length} departments`)}
              </span>
            </span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-neu-faint transition-transform duration-300 ${catsOpen ? "rotate-90" : ""}`}
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
                    className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/45 px-2.5 py-2 text-[12.5px] text-neu-ink transition hover:border-neu-accent/40 hover:bg-white/80 hover:text-neu-accent-strong active:scale-[0.98]"
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
                  className="col-span-2 mt-0.5 flex items-center justify-center gap-1.5 rounded-xl bg-neu-accent-soft px-2.5 py-2 text-[12px] font-semibold text-neu-accent-strong transition hover:bg-neu-accent hover:text-white"
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
                className="mob-item px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neu-faint"
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
                        active
                          ? "bg-neu-raised text-neu-accent-strong shadow-neu-xs"
                          : "text-neu-ink/80 hover:bg-white/50 hover:text-neu-ink"
                      }`}
                      style={{ ["--d" as string]: delay() }}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-leaf-300 to-leaf-600"
                        />
                      ) : null}
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                          active
                            ? "bg-neu-accent-soft text-neu-accent-strong"
                            : "bg-white/60 text-neu-accent/70 group-hover:bg-neu-accent-soft group-hover:text-neu-accent-strong"
                        }`}
                      >
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t(labelBn, labelEn)}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neu-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-neu-accent" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {/* account */}
          <section className="mt-3">
            <p
              className="mob-item px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neu-faint"
              style={{ ["--d" as string]: delay() }}
            >
              {t("আমার অ্যাকাউন্ট", "My account")}
            </p>

            {user ? (
              <div className="space-y-0.5">
                <Link
                  href="/account/orders"
                  onClick={onClose}
                  className="mob-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium text-neu-ink/80 transition hover:bg-white/50 hover:text-neu-ink"
                  style={{ ["--d" as string]: delay() }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/60 text-neu-accent">
                    <Package className="h-[17px] w-[17px]" />
                  </span>
                  <span className="flex-1 truncate">{t("আমার অর্ডার", "My orders")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-neu-faint" />
                </Link>
                <Link
                  href="/account"
                  onClick={onClose}
                  className="mob-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium text-neu-ink/80 transition hover:bg-white/50 hover:text-neu-ink"
                  style={{ ["--d" as string]: delay() }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/60 text-neu-accent">
                    <User className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {user.name ?? t("আমার প্রোফাইল", "My profile")}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-neu-faint" />
                </Link>
              </div>
            ) : (
              <div className="mob-item grid grid-cols-[1fr_auto] gap-1.5 px-1" style={{ ["--d" as string]: delay() }}>
                <Link
                  href="/login"
                  onClick={onClose}
                  className="btn-primary min-h-[44px] px-3 text-[13.5px]"
                >
                  {t("লগইন করুন", "Sign in")}
                </Link>
                <Link
                  href="/login?mode=signup"
                  onClick={onClose}
                  className="btn-outline min-h-[44px] px-3 text-[13.5px]"
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
            className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-neu-bg to-transparent"
          />
          <div className="neu-raised relative rounded-2xl p-2">
            <div className="neu-inset-sm flex items-center gap-1 rounded-xl p-1">
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
                      active ? "bg-neu-raised text-neu-accent-strong shadow-neu-xs" : "text-neu-muted hover:text-neu-ink"
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
              className="btn-primary mt-2 min-h-[46px] w-full text-[13.5px]"
            >
              <Phone className="h-4 w-4" />
              <span className="tabular-nums">{site.phoneDisplay}</span>
            </a>

            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-neu-faint">
              <Headset className="h-3 w-3" />
              {t("সকাল ৭টা – রাত ১০টা, প্রতিদিন", "7 am – 10 pm, every day")}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
