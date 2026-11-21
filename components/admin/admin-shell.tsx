"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Percent,
  Repeat,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/icon-logo";
import type { SessionUser } from "@/lib/auth";

const navGroups = [
  {
    title: "ওভারভিউ",
    items: [{ href: "/admin", label: "ড্যাশবোর্ড", Icon: LayoutGrid }],
  },
  {
    title: "বিক্রয়",
    items: [
      { href: "/admin/orders", label: "অর্ডার", Icon: ShoppingCart },
      { href: "/admin/subscriptions", label: "সাবস্ক্রিপশন", Icon: Repeat },
      { href: "/admin/customers", label: "কাস্টমার", Icon: Users },
      { href: "/admin/reports", label: "রিপোর্ট", Icon: BarChart3 },
    ],
  },
  {
    title: "ক্যাটালগ",
    items: [
      { href: "/admin/products", label: "পণ্য", Icon: Package },
      { href: "/admin/categories", label: "ক্যাটাগরি", Icon: Tags },
      { href: "/admin/reviews", label: "রিভিউ", Icon: MessageSquare },
    ],
  },
  {
    title: "মার্কেটিং",
    items: [
      { href: "/admin/coupons", label: "কুপন", Icon: Percent },
      { href: "/admin/banners", label: "ব্যানার", Icon: ImageIcon },
      { href: "/admin/blog", label: "ব্লগ", Icon: FileText },
    ],
  },
  {
    title: "সেটিংস",
    items: [{ href: "/admin/delivery", label: "ডেলিভারি চার্জ", Icon: Truck }],
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
        {navGroups.map((group) => (
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
            <p className="truncate text-[9.5px] text-sand-100/35">{user.email}</p>
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
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-900/90 px-4 backdrop-blur">
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
