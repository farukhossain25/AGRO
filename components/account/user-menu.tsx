"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Layers,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { ADMIN_BASE } from "@/lib/paths";

/* ==========================================================================
   UserMenu — the header avatar dropdown
   --------------------------------------------------------------------------
   Logged out → "লগইন / সাইন আপ"
   Logged in  → avatar + the six destinations from the brief + log out

   The identity comes from AuthProvider (Supabase session), so signing in or
   out updates this instantly without a reload. The admin panel link exists
   only in the menu of a signed-in admin — customers never see it, so the panel
   is still not advertised anywhere public.
   ========================================================================== */

export type HeaderUser = {
  name: string | null;
  role?: string;
  avatar?: string | null;
  premium?: boolean;
};

const ITEMS = [
  { href: "/account/profile", labelBn: "আমার প্রোফাইল", labelEn: "My profile", Icon: UserIcon },
  { href: "/account/orders", labelBn: "আমার অর্ডার", labelEn: "My orders", Icon: Package },
  { href: "/account/combos", labelBn: "আমার কম্বো", labelEn: "My combos", Icon: Layers },
  { href: "/account/premium", labelBn: "প্রিমিয়াম স্ট্যাটাস", labelEn: "Premium status", Icon: Sparkles },
  { href: "/account/notifications", labelBn: "নোটিফিকেশন", labelEn: "Notifications", Icon: Bell },
  { href: "/account/security", labelBn: "সেটিংস", labelEn: "Settings", Icon: Settings },
] as const;

export function UserMenu({ premium = false }: { premium?: boolean }) {
  const { t } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      toast.success(t("লগআউট হয়েছে", "Signed out"));
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(t("লগআউট ব্যর্থ", "Sign-out failed"), (err as Error).message);
    } finally {
      setSigningOut(false);
    }
  }

  /* --------------------------------------------------------- logged out */
  if (!user) {
    return (
      <Link
        href="/login"
        aria-label={t("লগইন / সাইন আপ", "Login / Sign up")}
        className="neu-pill flex min-h-[40px] items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-neu-ink sm:px-3.5"
      >
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{t("লগইন / সাইন আপ", "Login / Sign up")}</span>
        <span className="sm:hidden">{t("লগইন", "Login")}</span>
        {loading ? <span className="sr-only">{t("লোড হচ্ছে", "Loading")}</span> : null}
      </Link>
    );
  }

  /* ---------------------------------------------------------- logged in */
  const initial = (user.name ?? user.email ?? "U").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-full transition hover:ring-2 hover:ring-neu-accent/40"
        aria-label={t("অ্যাকাউন্ট মেনু", "Account menu")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name ?? ""}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-leaf-400 to-leaf-600 text-[13px] font-bold text-white shadow-neu-accent-sm">
            {initial}
          </span>
        )}
        {premium ? (
          <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-neu-highlight text-amber-500 ring-1 ring-neu-line" />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[52px] z-[70] w-60 overflow-hidden rounded-3xl border border-white/85 bg-neu-surface p-1.5 shadow-neu-lg animate-fade-up"
        >
          <div className="border-b border-neu-line/50 px-3 py-3">
            <p className="truncate text-[13px] font-semibold">{user.name ?? t("গ্রাহক", "Customer")}</p>
            <p className="mt-0.5 truncate text-[11px] text-neu-muted">
              {user.email ??
                (premium ? t("প্রিমিয়াম সদস্য", "Premium member") : t("গ্রাহক", "Customer"))}
            </p>
          </div>

          <div className="py-1">
            {/* A seller's own dashboard — without this row the only way in was
                typing /seller, which is why sellers reported "can't find my page". */}
            {user.isSeller || user.role === "seller" ? (
              <Link
                href="/seller"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-[38px] items-center gap-2.5 rounded-2xl px-3 py-2 text-[12.5px] font-semibold text-neu-accent-strong transition hover:bg-neu-accent-soft/70"
              >
                <Store className="h-3.5 w-3.5" />
                {t("সেলার ড্যাশবোর্ড", "Seller dashboard")}
              </Link>
            ) : null}
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-[38px] items-center gap-2.5 rounded-2xl px-3 py-2 text-[12.5px] text-neu-ink/75 transition hover:bg-white/70 hover:text-neu-ink"
              >
                <item.Icon className="h-3.5 w-3.5 text-neu-faint" />
                {t(item.labelBn, item.labelEn)}
              </Link>
            ))}
          </div>

          {/* Admin-only shortcut. Ordinary customers never see this row, so the
              panel URL is still not advertised anywhere public. */}
          {user.role === "admin" ? (
            <div className="border-t border-neu-line/50 py-1">
              <Link
                href={ADMIN_BASE}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-[38px] items-center gap-2.5 rounded-2xl px-3 py-2 text-[12.5px] font-semibold text-neu-accent-strong transition hover:bg-neu-accent-soft/70"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("অ্যাডমিন প্যানেল", "Admin panel")}
              </Link>
            </div>
          ) : null}

          <div className="border-t border-neu-line/50 py-1">
            <button
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex min-h-[38px] w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-[12.5px] text-[#c0392b] transition hover:bg-red-500/10 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? t("বের হচ্ছে…", "Signing out…") : t("লগআউট", "Log out")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
