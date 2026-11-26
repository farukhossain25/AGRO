"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Heart, Layers, LifeBuoy, LogOut, MapPin, Package, Repeat, ShieldCheck, Sparkles, Store, User, Wallet } from "lucide-react";
import { useLocale } from "@/lib/locale";

const links = [
  { href: "/account", labelBn: "ড্যাশবোর্ড", labelEn: "Dashboard", Icon: User },
  { href: "/account/profile", labelBn: "আমার প্রোফাইল", labelEn: "My profile", Icon: User },
  { href: "/account/orders", labelBn: "আমার অর্ডার", labelEn: "My orders", Icon: Package },
  { href: "/account/complaints", labelBn: "আমার অভিযোগ", labelEn: "Complaints", Icon: LifeBuoy },
  { href: "/account/subscriptions", labelBn: "সাবস্ক্রিপশন", labelEn: "Subscriptions", Icon: Repeat },
  { href: "/account/addresses", labelBn: "সেভ করা ঠিকানা", labelEn: "Saved addresses", Icon: MapPin },
  { href: "/account/wallet", labelBn: "ওয়ালেট ও রেফারেল", labelEn: "Wallet & referral", Icon: Wallet },
  { href: "/account/wishlist", labelBn: "পছন্দের তালিকা", labelEn: "Wishlist", Icon: Heart },
  { href: "/account/combos", labelBn: "আমার কম্বো", labelEn: "My combos", Icon: Layers },
  { href: "/account/premium", labelBn: "প্রিমিয়াম", labelEn: "Premium", Icon: Sparkles },
  { href: "/account/notifications", labelBn: "নোটিফিকেশন", labelEn: "Notifications", Icon: Bell },
  { href: "/account/security", labelBn: "নিরাপত্তা", labelEn: "Security", Icon: ShieldCheck },
];

const SELLER_LINK = { href: "/seller", labelBn: "সেলার ড্যাশবোর্ড", labelEn: "Seller dashboard", Icon: Store };

export function AccountNav({ isSeller = false }: { isSeller?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  // Sellers get a direct door to /seller — every other entry here is /account/*.
  const items = isSeller ? [links[0], SELLER_LINK, ...links.slice(1)] : links;

  async function signOut() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav aria-label="অ্যাকাউন্ট মেনু" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="no-scrollbar neu-raised flex w-full max-w-full gap-1.5 overflow-x-auto overscroll-x-contain rounded-[22px] p-1.5 lg:flex-col lg:gap-0.5">
        {items.map(({ href, labelBn, labelEn, Icon }) => {
          const active = pathname === href || (href !== "/account" && pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="shrink-0 lg:w-full">
              <Link
                href={href}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-2xl px-3 py-2.5 text-[12.5px] font-medium transition ${
                  active
                    ? "neu-raised-xs bg-neu-raised text-neu-accent-strong"
                    : "text-neu-muted hover:bg-white/60 hover:text-neu-ink"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(labelBn, labelEn)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-1 lg:w-full lg:border-t lg:border-neu-line/50 lg:pt-1">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[12.5px] font-medium text-[#c0392b]/80 transition hover:bg-red-500/10 hover:text-[#c0392b]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t("লগআউট", "Sign out")}
          </button>
        </li>
      </ul>
    </nav>
  );
}
