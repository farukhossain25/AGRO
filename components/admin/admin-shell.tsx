"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Camera,
  CreditCard,
  FileText,
  Headset,
  HelpCircle,
  KeyRound,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Percent,
  PlaySquare,
  Repeat,
  ScrollText,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sprout,
  Store,
  Tags,
  Ticket,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/icon-logo";
import type { SessionUser } from "@/lib/session";
import { can, roleLabelBn, type Permission, type RolePermissionOverrides } from "@/lib/permissions";
import { canOpenPanelPath } from "@/lib/paths";
import { ADMIN_BASE, adminHref } from "@/lib/paths";
import { IdleGuard } from "./idle-guard";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutGrid;
  /** Hidden from the sidebar when the signed-in role lacks it. The API is the
   *  real gate — this only stops staff seeing doors they cannot open. */
  perm?: Permission;
};

/**
 * Can this role actually open `href`? Mirrors middleware.ts + the layout, using
 * the same table (PANEL_PAGE_PERMISSIONS) rather than a second copy of the rule.
 * Before this, a staff/manager sidebar showed only live chat even though the
 * role could already edit products, media, reviews and content through the API.
 */
function isPageReachable(
  user: SessionUser,
  href: string,
  overrides?: RolePermissionOverrides | null
): boolean {
  if (user.role === "admin") return true;
  return canOpenPanelPath(href, (permission) => can(user, permission, overrides));
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "ওভারভিউ",
    items: [{ href: ADMIN_BASE, label: "ড্যাশবোর্ড", Icon: LayoutGrid }],
  },
  {
    title: "বিক্রয়",
    items: [
      { href: adminHref("orders"), label: "অর্ডার", Icon: ShoppingCart, perm: "orders.read" },
      /* Two different things sit next to each other on purpose:
         "ফুড প্ল্যান" = what the owner SELLS (price, features, who it fits)
         "সাবস্ক্রিপশন" = the running subscriptions customers already have. */
      { href: adminHref("food-plans"), label: "ফুড প্ল্যান", Icon: Sprout, perm: "orders.read" },
      { href: adminHref("subscriptions"), label: "সাবস্ক্রিপশন", Icon: Repeat, perm: "orders.read" },
      { href: adminHref("customers"), label: "কাস্টমার", Icon: Users, perm: "customers.read" },
      { href: adminHref("wallet"), label: "ওয়ালেট ও রেফারেল", Icon: Wallet, perm: "customers.read" },
      { href: adminHref("reports"), label: "রিপোর্ট", Icon: BarChart3, perm: "reports.view" },
    ],
  },
  {
    title: "পেমেন্ট",
    items: [
      { href: adminHref("payment-methods"), label: "মাধ্যম ও নম্বর", Icon: CreditCard, perm: "payments.manage" },
    ],
  },
  {
    title: "প্রিমিয়াম",
    items: [
      { href: adminHref("premium"), label: "সাবস্ক্রিপশন", Icon: Sparkles, perm: "premium.manage" },
      { href: adminHref("plans"), label: "প্ল্যান", Icon: Ticket, perm: "premium.manage" },
      { href: adminHref("codes"), label: "অ্যাক্সেস কোড", Icon: Ticket, perm: "premium.manage" },
      { href: adminHref("farms"), label: "খামার", Icon: Sprout, perm: "cams.manage" },
      { href: adminHref("cameras"), label: "ক্যামেরা", Icon: Camera, perm: "cams.manage" },
    ],
  },
  {
    title: "মার্কেটপ্লেস",
    items: [
      { href: adminHref("sellers"), label: "সেলার", Icon: Store, perm: "sellers.read" },
      { href: adminHref("seller-sales"), label: "বিক্রয় ও পেমেন্ট", Icon: Wallet, perm: "payouts.read" },
      { href: adminHref("suppliers/quality"), label: "কোয়ালিটি স্কোর", Icon: ShieldCheck, perm: "sellers.read" },
      { href: adminHref("camera-requests"), label: "ক্যামেরা রিকোয়েস্ট", Icon: Camera, perm: "cams.manage" },
    ],
  },
  {
    title: "ক্যাটালগ",
    items: [
      { href: adminHref("products"), label: "পণ্য", Icon: Package, perm: "products.read" },
      { href: adminHref("categories"), label: "ক্যাটাগরি", Icon: Tags, perm: "products.read" },
      { href: adminHref("combos"), label: "কম্বো বক্স", Icon: Package, perm: "combos.write" },
      { href: adminHref("reviews"), label: "রিভিউ", Icon: MessageSquare, perm: "reviews.moderate" },
      { href: adminHref("complaints"), label: "অভিযোগ", Icon: AlertTriangle, perm: "complaints.handle" },
      /* Live chat sits next to অভিযোগ because both are "a customer is talking
         to us". Every staff member sees it in the sidebar — reading is open,
         replying is what needs the claim. */
      { href: adminHref("chats"), label: "লাইভ চ্যাট", Icon: Headset, perm: "chats.handle" },
    ],
  },
  {
    title: "সাইট সাজান",
    items: [
      { href: adminHref("slides"), label: "হিরো স্লাইডার", Icon: PlaySquare, perm: "content.layout" },
      { href: adminHref("homepage"), label: "হোমপেজ সেকশন", Icon: LayoutTemplate, perm: "content.layout" },
      { href: adminHref("social"), label: "সোশ্যাল লিংক", Icon: Share2, perm: "content.social" },
    ],
  },
  {
    title: "মার্কেটিং",
    items: [
      { href: adminHref("coupons"), label: "কুপন", Icon: Percent, perm: "coupons.write" },
      /* The two percentages that move money on every order. They also exist
         inside সাইট সেটিংস → রেফারেল ও ওয়ালেট, but the owner asked where to
         set "how much of an order a customer may pay from the referral
         balance" — so it gets its own door instead of a scroll position. */
      { href: adminHref("wallet-settings"), label: "ওয়ালেটের সীমা ও কমিশন", Icon: Wallet, perm: "settings.write" },
      { href: adminHref("banners"), label: "ব্যানার", Icon: ImageIcon, perm: "content.write" },
      { href: adminHref("blog"), label: "ব্লগ", Icon: FileText, perm: "content.write" },
      { href: adminHref("cms"), label: "সাইড পেজ", Icon: BookOpen, perm: "content.write" },
      { href: adminHref("faq"), label: "প্রশ্ন-উত্তর", Icon: HelpCircle, perm: "content.write" },
      { href: adminHref("media"), label: "মিডিয়া", Icon: Images, perm: "media.write" },
      { href: adminHref("seo"), label: "SEO", Icon: Search, perm: "seo.write" },
    ],
  },
  {
    title: "টিম ও সিস্টেম",
    items: [
      { href: adminHref("team"), label: "টিম ও রোল", Icon: ShieldCheck, perm: "team.read" },
      { href: adminHref("access"), label: "প্যানেল অ্যাক্সেস", Icon: KeyRound, perm: "team.read" },
      { href: adminHref("audit"), label: "অডিট লগ", Icon: ScrollText, perm: "audit.read" },
      { href: adminHref("delivery"), label: "ডেলিভারি জোন", Icon: Truck, perm: "settings.write" },
      { href: adminHref("settings"), label: "সাইট সেটিংস", Icon: Settings, perm: "settings.write" },
      { href: adminHref("system-check"), label: "সিস্টেম চেক", Icon: Activity, perm: "admin.access" },
    ],
  },
];

export function AdminShell({
  user,
  overrides,
  children,
}: {
  user: SessionUser;
  /** The admin's per-role configuration (migration 30). Only the diff against
   *  the code defaults crosses to the browser; an admin passes null. */
  overrides?: RolePermissionOverrides | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /* The sidebar shows how many premium payments are waiting for a decision.
     It is a read-only count from the same route the premium desk uses; a
     failure just hides the dot rather than bothering the owner. */
  const [pendingPremium, setPendingPremium] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch("/api/foisal/premium-subscriptions", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive && typeof json?.data?.pending === "number") setPendingPremium(json.data.pending);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  async function signOut() {
    // Supabase clears its own cookies on the server; then land on the login page.
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Logo size={34} />
        <button
          onClick={() => setOpen(false)}
          className="neu-icon-btn h-9 w-9 lg:hidden"
          aria-label="বন্ধ"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="mob-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1" aria-label="অ্যাডমিন নেভিগেশন">
        {navGroups
          /*
           * Two filters, on purpose:
           *   1. permission — the role must hold the right to the screen;
           *   2. page reachable — a non-admin gets a 404 for every panel URL
           *      its permissions do not cover. A link that lands on a 404 reads
           *      as a broken panel, so the item is hidden instead.
           */
          .map((group) => ({
            ...group,
            items: group.items.filter(
              (item) =>
                  (!item.perm || can(user, item.perm, overrides)) &&
                  isPageReachable(user, item.href, overrides)
            ),
          }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-neu-faint">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, Icon }) => {
                  const active = href === ADMIN_BASE ? pathname === ADMIN_BASE : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-[12.5px] transition ${
                          active
                            ? "neu-raised-xs bg-neu-raised font-semibold text-neu-accent-strong"
                            : "font-medium text-neu-muted hover:bg-white/60 hover:text-neu-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                        {href === adminHref("premium") && pendingPremium > 0 ? (
                          <span
                            className="ml-auto rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-200"
                            title="যাচাইয়ের অপেক্ষায় থাকা পেমেন্ট"
                          >
                            {pendingPremium}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>

      <div className="shrink-0 border-t border-neu-line/50 p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[12px] font-medium text-neu-muted transition hover:bg-white/60 hover:text-neu-ink"
        >
          <Store className="h-3.5 w-3.5" /> ওয়েবসাইট দেখুন
        </Link>
        <div className="neu-inset-sm mt-2 flex items-center gap-2 rounded-2xl px-2.5 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-leaf-400 to-leaf-600 text-[10px] font-bold text-white">
            {(user.name ?? "A").slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold text-neu-ink">{user.name ?? "Admin"}</p>
            <p className="truncate text-[9.5px] text-neu-muted">
              {roleLabelBn(user.role)} · {user.email}
            </p>
          </div>
          <button
            onClick={signOut}
            className="neu-icon-btn h-8 w-8 shrink-0 !text-[#c0392b]"
            aria-label="লগআউট"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-surface flex min-h-dvh">
      <IdleGuard />
      {/* desktop sidebar — a floating raised panel */}
      <aside className="hidden w-[264px] shrink-0 p-3 lg:block">
        <div className="neu-raised-lg sticky top-3 h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl">
          {sidebar}
        </div>
      </aside>

      {/* mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <button
            className="absolute inset-0 bg-neu-ink/35 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="বন্ধ"
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-white/85 bg-neu-surface shadow-neu-lg animate-[fade-up_.2s_ease]">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-40 px-3 pt-3 sm:px-5"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="neu-bar flex h-14 items-center gap-3 rounded-xl px-3 sm:px-4">
            <button
              onClick={() => setOpen(true)}
              className="neu-icon-btn h-10 w-10 lg:hidden"
              aria-label="মেনু"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-[13px] font-semibold text-neu-ink">অ্যাডমিন প্যানেল</p>
            <span className="badge ml-auto bg-neu-accent-soft text-neu-accent-strong">লাইভ</span>
          </div>
        </header>

        <main className="p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
