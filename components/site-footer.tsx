"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { footerLinks, site } from "@/lib/site";
import { Logo } from "./icon-logo";
import { Spinner } from "./ui";

export function SiteFooter({
  categories,
  socials,
}: {
  categories: { slug: string; name_bn: string; name_en: string }[];
  socials?: ReactNode;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "সমস্যা হয়েছে");
      toast.success(t("সাবস্ক্রাইব সম্পন্ন!", "You're subscribed!"), t("ধন্যবাদ, প্রতি সপ্তাহে টিপস পাবেন।", "Weekly tips are on the way."));
      setEmail("");
    } catch (err) {
      toast.error(t("সাবস্ক্রাইব ব্যর্থ", "Subscription failed"), (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <footer className="mt-16 border-t border-white/[0.06] bg-ink-950/60">
      {/* newsletter */}
      <div className="border-b border-white/[0.06]">
        <div className="container-x grid gap-6 py-10 md:grid-cols-2 md:items-center">
          <div>
            <h3 className="text-xl font-bold sm:text-2xl">
              {t("সাপ্তাহিক তাজা খবর পান", "Get fresh news weekly")}
            </h3>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
              {t(
                "মৌসুমি সবজি, রেসিপি ও বিশেষ ছাড়ের খবর সবার আগে আপনার ইনবক্সে।",
                "Seasonal produce, recipes and exclusive discounts — straight to your inbox."
              )}
            </p>
          </div>
          <form onSubmit={subscribe} className="flex gap-2">
            <label className="relative flex-1">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-100/35" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("আপনার ইমেইল", "Your email")}
                className="input !rounded-full !pl-11"
                aria-label={t("ইমেইল ঠিকানা", "Email address")}
              />
            </label>
            <button type="submit" disabled={loading} className="btn-mint shrink-0 !px-5">
              {loading ? <Spinner /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{t("সাবস্ক্রাইব", "Subscribe")}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-sand-100/55">
            {t(
              "২০২১ সাল থেকে বিশ্বাস এগ্রো বাংলাদেশের কৃষকদের কাছ থেকে সরাসরি তাজা ও নিরাপদ খাবার পরিবারের কাছে পৌঁছে দিচ্ছে। কোনো মধ্যস্বত্বভোগী নেই, কোনো ক্ষতিকর কেমিক্যাল নেই।",
              "Since 2021 Biswas Agro has delivered safe, traceable food from Bangladeshi farmers directly to families — no middlemen, no harmful chemicals."
            )}
          </p>

          <ul className="mt-5 space-y-2.5 text-[13px] text-sand-100/60">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
              {t(site.addressBn, site.addressEn)}
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-leaf-400" />
              <a href={`tel:${site.phone}`} className="hover:text-leaf-200">{site.phoneDisplay}</a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-leaf-400" />
              <a href={`mailto:${site.email}`} className="hover:text-leaf-200">{site.email}</a>
            </li>
          </ul>

          {/* Social icons come from the `social_links` table — reorder, hide or
              add platforms in /foisal/social without touching this file. */}
          {socials}
        </div>

        <FooterCol title={t("কেনাকাটা", "Shop")} links={footerLinks.shop} />
        <div>
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-leaf-300/80">
            {t("ক্যাটাগরি", "Categories")}
          </h4>
          <ul className="space-y-2">
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="text-[13px] text-sand-100/60 transition hover:text-leaf-200">
                  {t(c.name_bn, c.name_en)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-8">
          <FooterCol title={t("সহায়তা", "Support")} links={footerLinks.help} />
          <FooterCol title={t("প্রতিষ্ঠান", "Company")} links={footerLinks.company.slice(0, 3)} />
        </div>
      </div>

      {/* payments + legal */}
      <div className="border-t border-white/[0.06]">
        <div className="container-x flex flex-col items-center gap-4 py-6 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-sand-100/35">
              {t("পেমেন্ট", "Payment")}:
            </span>
            {[
              { name: "bKash", color: "#e2136e" },
              { name: "Nagad", color: "#f6921e" },
              { name: "SSLCommerz", color: "#0a7d5a" },
              { name: "COD", color: "#b7ead2" },
            ].map((p) => (
              <span
                key={p.name}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] font-semibold"
                style={{ color: p.color }}
              >
                {p.name}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11.5px] text-sand-100/45">
            <Link href="/policies/privacy" className="hover:text-leaf-200">{t("প্রাইভেসি", "Privacy")}</Link>
            <Link href="/policies/terms" className="hover:text-leaf-200">{t("শর্তাবলী", "Terms")}</Link>
            <Link href="/policies/refund" className="hover:text-leaf-200">{t("রিফান্ড", "Refund")}</Link>
          </div>
        </div>
        <div className="container-x border-t border-white/[0.04] py-4 text-center text-[11.5px] text-sand-100/35">
          © {new Date().getFullYear()} {t("বিশ্বাস এগ্রো", "Biswas Agro")} · {t("সর্বস্বত্ব সংরক্ষিত", "All rights reserved")} ·{" "}
          <span className="text-leaf-300/70">{site.taglineBn}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; labelBn: string; labelEn: string }[] }) {
  const { t } = useLocale();
  return (
    <div>
      <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-leaf-300/80">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[13px] text-sand-100/60 transition hover:text-leaf-200">
              {t(l.labelBn, l.labelEn)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
