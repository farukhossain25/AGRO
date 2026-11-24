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
  MessageCircle,
  Newspaper,
  Package,
  Percent,
  Phone,
  Search,
  ShoppingBag,
  Sprout,
  Store,
  User,
  Video,
  X,
} from "lucide-react";
import { nav } from "@/lib/site";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useStoreInfo } from "@/lib/store-info";
import { Logo } from "./icon-logo";
import { SearchBox } from "./shop/search-box";

/* ==========================================================================
   MobileNav — the phone menu
   --------------------------------------------------------------------------   The drawer is the whole site on a phone, so it is organised by what a
   customer actually does, in the order they reach for it:

     account    → signed in: orders / profile · signed out: sign in / sign up
     quick      → cart, track an order, offers, WhatsApp (the four things
                  people open the menu for on a phone)
     ক্যাটাগরি   → accordion, closed by default, 2-column tiles
     কিনুন      → combos, subscriptions, marketplace
     খামার      → live cameras, our farms
     আরও        → blog, about, contact
     footer     → language + call, sticky so it is never scrolled away

   Accessibility: real focus trap (Tab/Shift+Tab stay inside), Escape closes,
   focus returns to the button that opened it, `aria-expanded`/`aria-controls`
   on the accordion, 44 px minimum targets, and `prefers-reduced-motion` kills
   the stagger (globals.css).
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const store = useStoreInfo();
  const pathname = usePathname();
  const cart = useCart();
  const [catsOpen, setCatsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);

  /* Escape closes; Tab is trapped inside; the page behind is locked. */
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = Boolean(active && panel.contains(active));

      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /* keyboard users land inside the panel, and get their place back on close */
    const returnTo = document.activeElement as HTMLElement | null;
    window.setTimeout(() => {
      panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  /* reset the inner state each time it closes */
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setCatsOpen(false);
      setSearching(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  let step = 0;
  const delay = () => `${110 + step++ * 30}ms`;

  const waLink = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
    t(`আসসালামু আলাইকুম, ${store.name} থেকে অর্ডার করতে চাই।`, `Hello ${store.name_en}, I'd like to place an order.`)
  )}`;

  return (
    <div
      className="fixed inset-0 z-[90] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mob-nav-title"
    >
      <button
        className="mob-scrim absolute inset-0 bg-neu-ink/40 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label={t("বন্ধ করুন", "Close menu")}
        tabIndex={-1}
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        className="mob-drawer absolute inset-y-0 left-0 flex w-[90%] max-w-[400px] flex-col overflow-hidden rounded-r-[30px] border-r border-white/80 shadow-neu-lg"
        style={{
          background: "linear-gradient(158deg, #F4F7FB 0%, #E9EEF6 45%, #E3E8F0 100%)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-neu-accent/10 blur-[70px]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/70 to-transparent"
        />

        {/* ── header ─────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <div className="flex min-h-[44px] min-w-0 items-center">
            {/* `showText` off: the wordmark is drawn here so the shop name
                follows the admin panel, and the Logo's own link is not nested
                inside another link. */}
            <Logo size={38} href={null} showText={false} />
            <div className="ml-2.5 min-w-0">
              <h2 id="mob-nav-title" className="truncate text-[15px] font-bold leading-tight text-neu-ink">
                {t(store.name, store.name_en)}
              </h2>
              <p className="truncate text-[10px] text-neu-faint">
                {t("খামার থেকে আপনার ঘরে", "Farm to family")}
              </p>
            </div>
          </div>
          <button
            data-autofocus
            onClick={onClose}
            className="neu-icon-btn h-11 w-11 shrink-0"
            aria-label={t("বন্ধ করুন", "Close menu")}
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* ── account / sign-in ─────────────────────────────────── */}
        <div className="relative px-4 pb-2 pt-1">
          {user ? (
            <Link
              href="/account"
              onClick={onClose}
              className="mob-item flex items-center gap-3 rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-neu-xs transition hover:bg-white active:scale-[0.99]"
              style={{ ["--d" as string]: delay() }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neu-accent text-[14px] font-bold text-white shadow-neu-accent-sm">
                {(user.name ?? "গ").slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-neu-ink">
                  {user.name ?? t("আমার অ্যাকাউন্ট", "My account")}
                </span>
                <span className="block text-[10.5px] text-neu-muted">{t("অর্ডার, প্রোফাইল ও ঠিকানা", "Orders, profile & addresses")}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neu-accent" />
            </Link>
          ) : (
            <div className="mob-item grid grid-cols-[1fr_auto] gap-1.5" style={{ ["--d" as string]: delay() }}>
              <Link href="/login" onClick={onClose} className="btn-primary min-h-[46px] px-3 text-[13.5px]">
                {t("লগইন করুন", "Sign in")}
              </Link>
              <Link
                href="/login?mode=signup"
                onClick={onClose}
                className="btn-outline min-h-[46px] px-4 text-[13.5px]"
              >
                {t("সাইন আপ", "Sign up")}
              </Link>
            </div>
          )}
        </div>

        {/* ── quick actions ─────────────────────────────────────── */}
        <div className="relative grid grid-cols-4 gap-1.5 px-4 pb-2 pt-1">
          <QuickAction
            label={t("কার্ট", "Cart")}
            Icon={ShoppingBag}
            onClick={() => {
              onClose();
              window.setTimeout(onOpenCart, 60);
            }}
            badge={cart.count || undefined}
            delay={delay()}
          />
          <QuickAction label={t("ট্র্যাক", "Track")} href="/track" onNavigate={onClose} Icon={MapPin} delay={delay()} />
          <QuickAction label={t("অফার", "Offers")} href="/offers" onNavigate={onClose} Icon={Percent} delay={delay()} />
          <QuickAction label={t("হোয়াটসঅ্যাপ", "WhatsApp")} href={waLink} external onNavigate={onClose} Icon={MessageCircle} delay={delay()} />
        </div>

        {/* ── search ─────────────────────────────────────────────── */}
        <div className="relative px-4 pb-1.5">
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
        <div className="mob-scroll relative flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {/* categories accordion */}
          <button
            onClick={() => setCatsOpen((v) => !v)}
            aria-expanded={catsOpen}
            aria-controls="mob-categories"
            className={`mob-item mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
              catsOpen ? "bg-white/80 shadow-neu-xs" : "hover:bg-white/50"
            }`}
            style={{ ["--d" as string]: delay() }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neu-accent-soft text-neu-accent-strong">
              <ShoppingBag className="h-[17px] w-[17px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-neu-ink">{t("ক্যাটাগরি", "Categories")}</span>
              <span className="block text-[11px] text-neu-muted">
                {categories.length > 0
                  ? t(`${categories.length} টি বিভাগ`, `${categories.length} departments`)
                  : t("সব বিভাগ একসাথে", "Browse every department")}
              </span>
            </span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-neu-faint transition-transform duration-300 ${catsOpen ? "rotate-90" : ""}`}
            />
          </button>

          <div className="mob-collapse" data-open={catsOpen}>
            <div>
              <div id="mob-categories" className="grid grid-cols-2 gap-1.5 px-1 pb-2 pt-2">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    onClick={onClose}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/70 bg-white/45 px-2.5 py-2 text-[12.5px] text-neu-ink transition hover:border-neu-accent/40 hover:bg-white/80 hover:text-neu-accent-strong active:scale-[0.98]"
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
                  className="col-span-2 mt-0.5 flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-neu-accent-soft px-2.5 py-2 text-[12px] font-semibold text-neu-accent-strong transition hover:bg-neu-accent hover:text-white"
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
                        active ? "bg-neu-raised text-neu-accent-strong shadow-neu-xs" : "text-neu-ink/80 hover:bg-white/50 hover:text-neu-ink"
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

          {/* signed-in shortcuts */}
          {user ? (
            <section className="mt-3">
              <p
                className="mob-item px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neu-faint"
                style={{ ["--d" as string]: delay() }}
              >
                {t("আমার অ্যাকাউন্ট", "My account")}
              </p>
              <div className="space-y-0.5">
                <AccountLink
                  href="/account/orders"
                  onNavigate={onClose}
                  Icon={Package}
                  label={t("আমার অর্ডার", "My orders")}
                  delay={delay()}
                />
                <AccountLink
                  href="/account/wishlist"
                  onNavigate={onClose}
                  Icon={User}
                  label={t("উইশলিস্ট", "Wishlist")}
                  delay={delay()}
                />
              </div>
            </section>
          ) : null}
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
            <div className="neu-inset-sm flex items-center gap-1 rounded-xl p-1" role="group" aria-label={t("ভাষা", "Language")}>
              {[
                { key: "bn" as const, label: "বাংলা" },
                { key: "en" as const, label: "English" },
              ].map((option) => {
                const active = locale === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      if (!active) toggle();
                    }}
                    aria-pressed={active}
                    className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition ${
                      active ? "bg-neu-raised text-neu-accent-strong shadow-neu-xs" : "text-neu-muted hover:text-neu-ink"
                    }`}
                  >
                    {option.key === "en" ? <Globe className="h-3.5 w-3.5" /> : null}
                    {option.label}
                  </button>
                );
              })}
            </div>

            <a href={`tel:${store.phone}`} className="btn-primary mt-2 min-h-[48px] w-full text-[13.5px]">
              <Phone className="h-4 w-4" />
              <span className="tabular-nums">{store.phone_display}</span>
            </a>

            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-neu-faint">
              <Headset className="h-3 w-3" />
              {t(store.hours_bn, store.hours_en)}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ---- the four tiles under the account row ------------------------------ */
function QuickAction({
  label,
  Icon,
  href,
  external,
  onClick,
  onNavigate,
  badge,
  delay,
}: {
  label: string;
  Icon: typeof ShoppingBag;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  onNavigate?: () => void;
  badge?: number;
  delay: string;
}) {
  const className =
    "mob-item relative flex flex-col items-center gap-1 rounded-2xl border border-white/80 bg-white/60 px-1 py-2 text-[10.5px] font-medium text-neu-ink shadow-neu-xs transition hover:bg-white active:scale-[0.97]";

  const body = (
    <>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-neu-accent-soft text-neu-accent-strong">
        <Icon className="h-[17px] w-[17px]" />
        {badge ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-neu-ink px-1 text-[9px] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="w-full truncate text-center leading-tight">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={className}
        style={{ ["--d" as string]: delay }}
      >
        {body}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className} style={{ ["--d" as string]: delay }}>
      {body}
    </button>
  );
}

function AccountLink({
  href,
  onNavigate,
  Icon,
  label,
  delay,
}: {
  href: string;
  onNavigate: () => void;
  Icon: typeof Package;
  label: string;
  delay: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="mob-item flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium text-neu-ink/80 transition hover:bg-white/50 hover:text-neu-ink"
      style={{ ["--d" as string]: delay }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/60 text-neu-accent">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-neu-faint" />
    </Link>
  );
}
