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
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   UserMenu — the header avatar dropdown
   --------------------------------------------------------------------------
   Logged out → "লগইন / সাইন আপ"
   Logged in  → avatar + the six destinations from the brief + log out

   The identity comes from AuthProvider (Supabase session), so signing in or
   out updates this instantly without a reload. There is deliberately no admin
   link: admins are never advertised in the public UI.
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
        className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-sand-100/80 transition hover:bg-white/[0.06] hover:text-sand-100 sm:px-3"
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
        className="relative grid h-10 w-10 place-items-center rounded-full ring-1 ring-white/10 transition hover:ring-leaf-400/50"
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
          <span className="grid h-10 w-10 place-items-center rounded-full bg-leaf-700 text-[13px] font-bold text-leaf-50">
            {initial}
          </span>
        )}
        {premium ? (
          <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-ink-900 text-amber-400" />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[46px] z-[70] w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/98 shadow-soft backdrop-blur-xl animate-fade-up"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="truncate text-[13px] font-semibold">{user.name ?? t("গ্রাহক", "Customer")}</p>
            <p className="mt-0.5 truncate text-[11px] text-sand-100/45">
              {user.email ??
                (premium ? t("প্রিমিয়াম সদস্য", "Premium member") : t("গ্রাহক", "Customer"))}
            </p>
          </div>

          <div className="py-1">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-[38px] items-center gap-2.5 px-4 py-2 text-[12.5px] text-sand-100/75 transition hover:bg-white/[0.06] hover:text-sand-100"
              >
                <item.Icon className="h-3.5 w-3.5 text-sand-100/40" />
                {t(item.labelBn, item.labelEn)}
              </Link>
            ))}
          </div>

          <div className="border-t border-white/[0.07] py-1">
            <button
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex min-h-[38px] w-full items-center gap-2.5 px-4 py-2 text-[12.5px] text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
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
