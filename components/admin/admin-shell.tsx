"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Camera,
  FileText,
  HelpCircle,
  Images,
  ScrollText,
  Search,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Percent,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sprout,
  Store,
  Tags,
  Ticket,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/icon-logo";
import type { SessionUser } from "@/lib/auth";
import { can, roleLabelBn, type Permission } from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutGrid;
  /** Hidden from the sidebar when the signed-in role lacks it. The API is the
   *  real gate — this only stops staff seeing doors they cannot open. */
  perm?: Permission;
};

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "ওভারভিউ",
    items: [{ href: "/admin", label: "ড্যাশবোর্ড", Icon: LayoutGrid }],
  },
  {
    title: "বিক্রয়",
    items: [
      { href: "/admin/orders", label: "অর্ডার", Icon: ShoppingCart, perm: "orders.read" },
      { href: "/admin/subscriptions", label: "সাবস্ক্রিপশন", Icon: Repeat, perm: "orders.read" },
      { href: "/admin/customers", label: "কাস্টমার", Icon: Users, perm: "customers.read" },
      { href: "/admin/reports", label: "রিপোর্ট", Icon: BarChart3, perm: "reports.view" },
    ],
  },
  {
    title: "প্রিমিয়াম",
    items: [
      { href: "/admin/premium", label: "সাবস্ক্রিপশন", Icon: Sparkles, perm: "premium.manage" },
      { href: "/admin/plans", label: "প্ল্যান", Icon: Ticket, perm: "premium.manage" },
      { href: "/admin/codes", label: "অ্যাক্সেস কোড", Icon: Ticket, perm: "premium.manage" },
      { href: "/admin/farms", label: "খামার", Icon: Sprout, perm: "cams.manage" },
      { href: "/admin/cameras", label: "ক্যামেরা", Icon: Camera, perm: "cams.manage" },
    ],
  },
  {
    title: "মার্কেটপ্লেস",
    items: [
      { href: "/admin/sellers", label: "সেলার", Icon: Store, perm: "sellers.read" },
      { href: "/admin/suppliers/quality", label: "কোয়ালিটি স্কোর", Icon: ShieldCheck, perm: "sellers.read" },
      { href: "/admin/camera-requests", label: "ক্যামেরা রিকোয়েস্ট", Icon: Camera, perm: "cams.manage" },
    ],
  },
  {
    title: "ক্যাটালগ",
    items: [
      { href: "/admin/products", label: "পণ্য", Icon: Package, perm: "products.read" },
      { href: "/admin/categories", label: "ক্যাটাগরি", Icon: Tags, perm: "products.read" },
      { href: "/admin/reviews", label: "রিভিউ", Icon: MessageSquare, perm: "reviews.moderate" },
      { href: "/admin/complaints", label: "অভিযোগ", Icon: AlertTriangle, perm: "complaints.handle" },
    ],
  },
  {
    title: "মার্কেটিং",
    items: [
      { href: "/admin/coupons", label: "কুপন", Icon: Percent, perm: "coupons.write" },
      { href: "/admin/banners", label: "ব্যানার", Icon: ImageIcon, perm: "content.write" },
      { href: "/admin/blog", label: "ব্লগ", Icon: FileText, perm: "content.write" },
      { href: "/admin/cms", label: "সাইড পেজ", Icon: BookOpen, perm: "content.write" },
      { href: "/admin/faq", label: "প্রশ্ন-উত্তর", Icon: HelpCircle, perm: "content.write" },
      { href: "/admin/media", label: "মিডিয়া", Icon: Images, perm: "media.write" },
      { href: "/admin/seo", label: "SEO", Icon: Search, perm: "seo.write" },
    ],
  },
  {
    title: "টিম ও সিস্টেম",
    items: [
      { href: "/admin/team", label: "টিম ও রোল", Icon: ShieldCheck, perm: "team.read" },
      { href: "/admin/audit", label: "অডিট লগ", Icon: ScrollText, perm: "audit.read" },
      { href: "/admin/delivery", label: "ডেলিভারি চার্জ", Icon: Truck, perm: "settings.write" },
    ],
  },
];

export function AdminShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-4">
        <Logo size={34} />
        <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-sand-100/50 hover:bg-white/10 lg:hidden" aria-label="বন্ধ">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="অ্যাডমিন নেভিগেশন">
        {navGroups
          .map((group) => ({ ...group, items: group.items.filter((item) => !item.perm || can(user, item.perm)) }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-sand-100/30">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, Icon }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium transition ${
                        active
                          ? "bg-leaf-600/20 text-leaf-200"
                          : "text-sand-100/60 hover:bg-white/[0.05] hover:text-sand-100"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] text-sand-100/50 transition hover:bg-white/[0.05] hover:text-sand-100">
          <Store className="h-3.5 w-3.5" /> ওয়েবসাইট দেখুন
        </Link>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-white/[0.03] px-2.5 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-leaf-600/25 text-[10px] font-bold text-leaf-200">
            {(user.name ?? "A").slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold">{user.name ?? "Admin"}</p>
            <p className="truncate text-[9.5px] text-sand-100/35">
              {roleLabelBn(user.role)} · {user.email}
            </p>
          </div>
          <button onClick={signOut} className="rounded-lg p-1.5 text-sand-100/40 hover:bg-red-500/15 hover:text-red-300" aria-label="লগআউট">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-surface flex min-h-dvh">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-white/[0.06] bg-ink-900 lg:block">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      {/* mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <button className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="বন্ধ" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-ink-900 animate-[fade-up_.2s_ease]">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-900/90 px-4 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-sand-100/70 hover:bg-white/10 lg:hidden" aria-label="মেনু">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-[13px] font-semibold">অ্যাডমিন প্যানেল</p>
          <span className="badge ml-auto bg-leaf-600/20 text-leaf-200">লাইভ</span>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
