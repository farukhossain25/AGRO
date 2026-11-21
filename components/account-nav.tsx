"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LogOut, MapPin, Package, Repeat, User } from "lucide-react";
import { useLocale } from "@/lib/locale";

const links = [
  { href: "/account", labelBn: "ড্যাশবোর্ড", labelEn: "Dashboard", Icon: User },
  { href: "/account/orders", labelBn: "আমার অর্ডার", labelEn: "My orders", Icon: Package },
  { href: "/account/subscriptions", labelBn: "সাবস্ক্রিপশন", labelEn: "Subscriptions", Icon: Repeat },
  { href: "/account/addresses", labelBn: "সেভ করা ঠিকানা", labelEn: "Saved addresses", Icon: MapPin },
  { href: "/account/wishlist", labelBn: "পছন্দের তালিকা", labelEn: "Wishlist", Icon: Heart },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav aria-label="অ্যাকাউন্ট মেনু" className="lg:sticky lg:top-24 lg:self-start">
      <ul className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-ink-850/60 p-1.5 lg:flex-col lg:gap-0.5">
        {links.map(({ href, labelBn, labelEn, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="shrink-0 lg:w-full">
              <Link
                href={href}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[12.5px] font-medium transition ${
                  active
                    ? "bg-leaf-600/20 text-leaf-200"
                    : "text-sand-100/65 hover:bg-white/[0.05] hover:text-sand-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(labelBn, labelEn)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-1 lg:w-full lg:border-t lg:border-white/[0.06] lg:pt-1">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-medium text-red-300/80 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t("লগআউট", "Sign out")}
          </button>
        </li>
      </ul>
    </nav>
  );
}
