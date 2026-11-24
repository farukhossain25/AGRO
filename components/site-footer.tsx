"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Clock,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Sprout,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { footerLinks } from "@/lib/site";
import { useStoreInfo } from "@/lib/store-info";
import { toBn } from "@/lib/format";
import { Logo } from "./icon-logo";
import { Spinner } from "./ui";

/* ==========================================================================
   <SiteFooter /> — the storefront's closing block
   --------------------------------------------------------------------------
   A newsletter card, then one deep-green brand panel that carries everything
   else: who we are and how to reach us, the link columns, three trust points,
   and the payment logos. The green is the same brand green as the receipts and
   the QR scan page, so the page ends on the brand instead of trailing off into
   a flat list of text.

   Payment methods are NOT hard-coded here: the active rows of
   `payment_methods` (logo uploaded at /foisal/payment-methods) drive the
   tiles. A method without a logo still gets a clean typographic tile, and a
   broken image falls back to it instead of showing a broken-image glyph.

   Colour note: the light theme remaps `bg-white/5..40` and `border-white/…`
   to light greys with !important, so the dark panel uses arbitrary rgba
   values for its translucent surfaces — those class names are not remapped.
   ========================================================================== */

export type FooterPaymentMethod = {
  code: string;
  name_bn: string;
  name_en: string | null;
  kind: string;
  logo_url: string | null;
};

const PANEL = {
  background: "linear-gradient(160deg, #0a2a1b 0%, #10412a 55%, #165536 100%)",
  boxShadow: "0 32px 64px -36px rgba(10,42,27,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
};
const GLOW =
  "radial-gradient(560px 280px at 90% -10%, rgba(120,226,170,0.16), transparent 62%)," +
  "radial-gradient(460px 260px at -8% 110%, rgba(120,226,170,0.10), transparent 60%)";
const MINT = "#9fe3bf";
const HAIRLINE = "rgba(255,255,255,0.12)";
const TILE = "rgba(255,255,255,0.08)";

type FooterLink = { href: string; labelBn: string; labelEn: string };

export function SiteFooter({
  categories,
  socials,
  paymentMethods = [],
}: {
  categories: { slug: string; name_bn: string; name_en: string }[];
  socials?: ReactNode;
  paymentMethods?: FooterPaymentMethod[];
}) {
  const { t } = useLocale();
  const toast = useToast();
  const store = useStoreInfo();
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

  const categoryLinks: FooterLink[] = categories.slice(0, 6).map((c) => ({
    href: `/categories/${c.slug}`,
    labelBn: c.name_bn,
    labelEn: c.name_en,
  }));

  const trust: { Icon: LucideIcon; bn: string; en: string; subBn: string; subEn: string }[] = [
    { Icon: Sprout, bn: "খামার থেকে সরাসরি", en: "Straight from the farm", subBn: "কোনো মধ্যস্বত্বভোগী নেই", subEn: "No middlemen" },
    { Icon: Truck, bn: "সারা বাংলাদেশে ডেলিভারি", en: "Delivery across Bangladesh", subBn: "ঘরে বসে অর্ডার করুন", subEn: "Order from home" },
    { Icon: ShieldCheck, bn: "নিরাপদ পেমেন্ট", en: "Secure payment", subBn: "যাচাইকৃত পেমেন্ট মাধ্যম", subEn: "Verified payment methods" },
  ];

  return (
    <footer className="mt-16">
      {/* newsletter */}
      <div className="container-x">
        <div className="neu-raised-lg grid gap-6 rounded-[28px] p-6 sm:p-8 md:grid-cols-2 md:items-center">
          <div>
            <h3 className="text-xl font-bold sm:text-2xl">
              {t("সাপ্তাহিক তাজা খবর পান", "Get fresh news weekly")}
            </h3>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-neu-muted">
              {t(
                "মৌসুমি সবজি, রেসিপি ও বিশেষ ছাড়ের খবর সবার আগে আপনার ইনবক্সে।",
                "Seasonal produce, recipes and exclusive discounts — straight to your inbox."
              )}
            </p>
          </div>
          <form onSubmit={subscribe} className="flex gap-2">
            <label className="relative flex-1">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neu-faint" />
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
            <button
              type="submit"
              disabled={loading}
              className="btn-primary shrink-0 !px-5"
              /* icon-only on a phone: the name must not disappear with the text */
              aria-label={t("সাবস্ক্রাইব করুন", "Subscribe")}
            >
              {loading ? <Spinner /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{t("সাবস্ক্রাইব", "Subscribe")}</span>
            </button>
          </form>
        </div>
      </div>

      {/* brand panel */}
      <div className="container-x mt-8 pb-6 sm:mt-10">
        <div
          className="relative overflow-hidden rounded-[28px] px-6 py-9 sm:rounded-[32px] sm:px-10 sm:py-12 lg:px-14 lg:py-14"
          style={PANEL}
        >
          {/* light + leaf watermark — decoration only */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: GLOW }} />
          <svg
            aria-hidden
            viewBox="0 0 32 32"
            className="pointer-events-none absolute -bottom-16 -right-10 h-[320px] w-[320px] opacity-[0.05] sm:h-[420px] sm:w-[420px]"
            fill="#ffffff"
          >
            <path d="M16 27V16" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M16 16C16 9.4 21 5 27 5c0 6.6-5 11-11 11Z" />
            <path d="M16 19C16 13.5 12 10 7 10c0 5.5 4 9 9 9Z" />
          </svg>

          <div className="relative grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-x-12 lg:gap-y-0">
            {/* ── brand ─────────────────────────────────────────────── */}
            <div className="col-span-2 lg:col-span-1">
              <Logo tone="dark" size={44} />
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-white/80">
                {t(
                  "২০২১ সাল থেকে বিশ্বাস এগ্রো বাংলাদেশের কৃষকদের কাছ থেকে সরাসরি তাজা ও নিরাপদ খাবার পরিবারের কাছে পৌঁছে দিচ্ছে। কোনো মধ্যস্বত্বভোগী নেই, কোনো ক্ষতিকর কেমিক্যাল নেই।",
                  "Since 2021 Biswas Agro has delivered safe, traceable food from Bangladeshi farmers directly to families — no middlemen, no harmful chemicals."
                )}
              </p>
              <p className="mt-3 text-[13px] font-medium" style={{ color: MINT }}>
                {t("বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে", "Trust in purity — from our farms to your home")}
              </p>

              <ul className="mt-6 space-y-2.5 text-[13px] text-white/80">
                <li className="flex items-start gap-3">
                  <ContactIcon>
                    <MapPin className="h-3.5 w-3.5" />
                  </ContactIcon>
                  <span className="pt-1">{t(store.address_bn, store.address_en)}</span>
                </li>
                <li>
                  <a href={`tel:${store.phone}`} className="flex items-center gap-3 transition hover:text-white">
                    <ContactIcon>
                      <Phone className="h-3.5 w-3.5" />
                    </ContactIcon>
                    <span className="pt-1 tabular-nums">{store.phone_display}</span>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${store.email}`} className="flex items-center gap-3 transition hover:text-white">
                    <ContactIcon>
                      <Mail className="h-3.5 w-3.5" />
                    </ContactIcon>
                    <span className="pt-1">{store.email}</span>
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <ContactIcon>
                    <Clock className="h-3.5 w-3.5" />
                  </ContactIcon>
                  <span className="pt-1">{t(store.hours_bn, store.hours_en)}</span>
                </li>
              </ul>

              {/* Social icons come from the `social_links` table — reorder, hide or
                  add platforms in /foisal/social without touching this file. */}
              {socials}
            </div>

            {/* ── link columns ──────────────────────────────────────── */}
            <FooterCol title={t("কেনাকাটা", "Shop")} links={footerLinks.shop} />
            <FooterCol title={t("ক্যাটাগরি", "Categories")} links={categoryLinks} />
            {/* phone/tablet: side by side under the first two; desktop: stacked */}
            <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-9 lg:col-span-1 lg:grid-cols-1">
              <FooterCol title={t("সহায়তা", "Support")} links={footerLinks.help} />
              <FooterCol title={t("প্রতিষ্ঠান", "Company")} links={footerLinks.company} />
            </div>
          </div>

          {/* ── trust strip ─────────────────────────────────────────── */}
          <ul
            className="relative mt-10 hidden grid-cols-3 gap-4 border-t pt-7 md:mt-12 md:grid"
            style={{ borderColor: HAIRLINE }}
          >
            {trust.map(({ Icon, bn, en, subBn, subEn }) => (
              <li key={bn} className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: TILE, color: MINT }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">{t(bn, en)}</p>
                  <p className="text-[11.5px] text-white/55">{t(subBn, subEn)}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* ── payments + legal ────────────────────────────────────── */}
          <div
            className="relative mt-9 flex flex-col gap-5 border-t pt-6 lg:mt-10 lg:flex-row lg:items-center lg:justify-between"
            style={{ borderColor: HAIRLINE }}
          >
            {paymentMethods.length > 0 ? (
              <div className="flex flex-col items-center gap-2.5 lg:items-start">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {t("আমরা যেসব পেমেন্ট গ্রহণ করি", "We accept")}
                </p>
                <ul className="flex flex-wrap items-center justify-center gap-2 lg:justify-start" aria-label="পেমেন্ট মাধ্যম">
                  {paymentMethods.map((m) => (
                    <PaymentTile key={m.code} method={m} />
                  ))}
                </ul>
              </div>
            ) : null}

            {/* ml-auto: stays on the right even when there is no payment block */}
            <div className="flex flex-col items-center gap-2 text-center lg:ml-auto lg:items-end lg:text-right">
              <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-white/65" aria-label="আইনি">
                <LegalLink href="/policies/privacy">{t("প্রাইভেসি", "Privacy")}</LegalLink>
                <span aria-hidden style={{ color: "rgba(255,255,255,0.25)" }}>
                  ·
                </span>
                <LegalLink href="/policies/terms">{t("শর্তাবলী", "Terms")}</LegalLink>
                <span aria-hidden style={{ color: "rgba(255,255,255,0.25)" }}>
                  ·
                </span>
                <LegalLink href="/policies/refund">{t("রিফান্ড", "Refund")}</LegalLink>
              </nav>
              <p className="text-[11.5px] text-white/45">
                © {toBn(new Date().getFullYear())} {t(store.name, store.name_en)} ·{" "}
                {t("সর্বস্বত্ব সংরক্ষিত", "All rights reserved")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────────── */

function ContactIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
      style={{ background: TILE, color: MINT }}
    >
      {children}
    </span>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="transition hover:text-white">
      {children}
    </Link>
  );
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  const { t } = useLocale();
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: MINT }}>
        {title}
      </h4>
      <span className="mt-2 block h-0.5 w-7 rounded-full" style={{ background: "rgba(159,227,191,0.5)" }} />
      <ul className="mt-3.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group inline-flex min-h-[34px] items-center gap-2.5 py-1 text-[13.5px] text-white/70 transition hover:text-white"
            >
              <span
                className="h-1 w-1 shrink-0 rounded-full transition group-hover:scale-150"
                style={{ background: "rgba(255,255,255,0.35)" }}
              />
              <span className="border-b border-transparent transition group-hover:border-[rgba(255,255,255,0.35)]">
                {t(l.labelBn, l.labelEn)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KIND_ICON: Record<string, LucideIcon> = {
  cod: Banknote,
  bank: Landmark,
  gateway: ShieldCheck,
  mfs: Wallet,
};

/**
 * One white tile per payment method — the logo exactly as the admin uploaded
 * it, contained inside a fixed-height tile so a tall logo and a wide logo sit
 * on one baseline. A missing or broken logo degrades to the method's name on
 * a kind icon rather than a broken-image glyph.
 */
function PaymentTile({ method }: { method: FooterPaymentMethod }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const name = method.name_bn;

  /* Server-rendered <img> tags start loading before hydration; when the logo
     404s quickly the `error` event is gone before React's onError exists. On
     mount, an image that is "complete" with no pixels has already failed. */
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const showLogo = Boolean(method.logo_url) && !failed;
  const Icon = KIND_ICON[method.kind] ?? Wallet;

  return (
    <li
      className="grid h-10 min-w-[68px] place-items-center rounded-xl bg-white px-3 shadow-[0_8px_18px_-10px_rgba(0,0,0,0.55)] ring-1 ring-black/[0.06]"
      title={name}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin may paste any host; <img> never throws
        <img
          ref={img}
          src={method.logo_url ?? ""}
          alt={name}
          width={76}
          height={24}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-6 w-auto max-w-[76px] object-contain"
        />
      ) : (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#1d2a23]">
          <Icon className="h-3.5 w-3.5 text-[#1f7a4d]" aria-hidden />
          <span className="max-w-[84px] truncate uppercase tracking-wide">{method.name_en || name}</span>
        </span>
      )}
    </li>
  );
}
