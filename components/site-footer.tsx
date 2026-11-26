"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Mail, MapPin, Phone, Sprout } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { footerLinks } from "@/lib/site";
import { useStoreInfo } from "@/lib/store-info";
import { toBn } from "@/lib/format";
import { Logo } from "./icon-logo";
import { NewsletterSignup } from "./newsletter-signup";
import { FooterPayments, type FooterPaymentMethod as FooterPaymentMethodType } from "./footer-payments";

/* ==========================================================================
   <SiteFooter /> — the storefront's closing block
   --------------------------------------------------------------------------
   One large raised neumorphic panel — the same surface language as
   the floating header bar and the home cards (soft grey-blue, white hairline,
   dual shadows) — so the page ends on the theme instead of on a dark slab.
   Inside, three rows separated by hairlines:
     1. brand (small seal, story, tagline pill, contact, socials) + newsletter card
     2. link columns — an accordion on phones, four columns from md
     3. payment methods + legal

   The seal is deliberately small (132 px, 88 px on a phone): it is a signature,
   not the headline. The three "straight from the farm / delivery / secure
   payment" tiles were removed — the same promises already sit in the header
   strip and the product page badges, and they cost a third of a phone screen.
   Depth is the decoration: raised panel → raised newsletter card → inset
   input, mint glows and a few hairline rings in the corner. Nothing else.

   Payment methods are NOT hard-coded here: the active rows of
   `payment_methods` (logo uploaded at /foisal/payment-methods) drive the
   tiles. A method without a logo still gets a clean typographic tile, and a
   broken image falls back to it instead of showing a broken-image glyph.
   ========================================================================== */

export type { FooterPaymentMethod } from "./footer-payments";

type FooterLink = { href: string; labelBn: string; labelEn: string };

export function SiteFooter({
  categories,
  socials,
  paymentMethods = [],
}: {
  categories: { slug: string; name_bn: string; name_en: string }[];
  socials?: ReactNode;
  paymentMethods?: FooterPaymentMethodType[];
}) {
  const { t } = useLocale();
  const store = useStoreInfo();

  const categoryLinks: FooterLink[] = categories.slice(0, 6).map((c) => ({
    href: `/categories/${c.slug}`,
    labelBn: c.name_bn,
    labelEn: c.name_en,
  }));

  return (
    <footer className="mt-16 sm:mt-20">
      <div className="container-x pb-6 sm:pb-8">
        <div className="neu-raised-lg relative overflow-hidden rounded-[30px] p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
          {/* ── decoration: two soft mint glows + hairline rings ────── */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-leaf-500/15 blur-3xl" />
            <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-neu-accent-soft blur-2xl" />
            <svg
              viewBox="0 0 400 400"
              className="absolute -right-20 -top-24 h-[340px] w-[340px] text-neu-line"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <circle cx="200" cy="200" r="70" opacity="0.6" />
              <circle cx="200" cy="200" r="120" opacity="0.42" />
              <circle cx="200" cy="200" r="170" opacity="0.26" />
            </svg>
          </div>

          {/* ── 1 · brand + newsletter ─────────────────────────────── */}
          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
            <div className="min-w-0">
              <Logo variant="full" width={132} priority={false} />

              <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-neu-muted">
                {t(
                  "২০২১ সাল থেকে বিশ্বাস এগ্রো বাংলাদেশের কৃষকদের কাছ থেকে সরাসরি তাজা ও নিরাপদ খাবার পরিবারের কাছে পৌঁছে দিচ্ছে। কোনো মধ্যস্বত্বভোগী নেই, কোনো ক্ষতিকর কেমিক্যাল নেই।",
                  "Since 2021 Biswas Agro has delivered safe, traceable food from Bangladeshi farmers directly to families — no middlemen, no harmful chemicals."
                )}
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-neu-accent-soft px-3.5 py-1.5 text-[12.5px] font-semibold text-neu-accent-strong">
                <Sprout className="h-3.5 w-3.5" aria-hidden />
                {t("বিশুদ্ধতার আস্থায়, খামার থেকে আপনার ঘরে", "Trust in purity — from our farms to your home")}
              </p>

              {/* two-up on phones: four stacked address rows made the footer
                  half a screen longer than it had to be */}
              <ul className="mt-5 grid gap-1.5 text-[12.5px] text-neu-ink/80 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2">
                <li className="col-span-2 flex items-start gap-3">
                  <ContactIcon>
                    <MapPin className="h-3.5 w-3.5" />
                  </ContactIcon>
                  <span className="pt-1.5">{t(store.address_bn, store.address_en)}</span>
                </li>
                <li>
                  <a href={`tel:${store.phone}`} className="flex items-center gap-3 transition hover:text-neu-accent-strong">
                    <ContactIcon>
                      <Phone className="h-3.5 w-3.5" />
                    </ContactIcon>
                    <span className="tabular-nums">{store.phone_display}</span>
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <ContactIcon>
                    <Clock className="h-3.5 w-3.5" />
                  </ContactIcon>
                  <span>{t(store.hours_bn, store.hours_en)}</span>
                </li>
                {/* email gets the full width: at 360 a half column cuts the
                    address in the middle — an address must never wrap mid-word */}
                <li className="col-span-2">
                  <a href={`mailto:${store.email}`} className="flex items-center gap-3 transition hover:text-neu-accent-strong">
                    <ContactIcon>
                      <Mail className="h-3.5 w-3.5" />
                    </ContactIcon>
                    <span className="break-all">{store.email}</span>
                  </a>
                </li>
              </ul>

              {/* Social icons come from the `social_links` table — reorder, hide or
                  add platforms in /foisal/social without touching this file. */}
              {socials}
            </div>

            {/* newsletter — a raised card on the raised panel; the input is the
                inset well, the same three depths as the header's search */}
            {/* on desktop the card is pinned to the top of the column and the
                stat strip fills the height beneath it, so no dead space */}
            {/* the card, then the farm-family counter right under it — no
                stretched gaps, the whitespace falls to the bottom of the
                column where it reads as breathing room */}
            <div className="flex flex-col gap-4">
              {/* The card lives in <NewsletterSignup variant="card"> so the
                  homepage band and the footer share one form, one endpoint and
                  one copy — they used to be two copies of the same code that
                  could drift apart. */}
              <NewsletterSignup variant="card" />

            {/* farm family counter — the same number the home page brags about,
                as a raised tile that closes the column on desktop */}
            <div className="card hidden items-center justify-between gap-4 !rounded-2xl px-5 py-4 sm:flex">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-neu-faint">
                  {t("আমাদের খামার পরিবার", "Our farm families")}
                </p>
                <p className="mt-1 text-lg font-bold leading-none text-neu-ink">
                  {toBn(230)}
                  <span className="ml-1 text-[13px] font-semibold text-neu-accent-strong">
                    {t("পরিবার", "families")}
                  </span>
                </p>
              </div>
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-leaf-600/15 text-neu-accent-strong"
                aria-hidden
              >
                <Sprout className="h-5 w-5" />
              </span>
            </div>
            </div>
          </div>

          {/* ── 2 · link columns — accordion on phones, grid from md ──── */}
          <div className="relative mt-9 border-t border-neu-line/50 pt-2 sm:mt-11 md:mt-12 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-8 md:pt-9 lg:grid-cols-4 lg:gap-x-10">
            <FooterGroup id="shop" title={t("কেনাকাটা", "Shop")} links={footerLinks.shop} />
            <FooterGroup id="categories" title={t("ক্যাটাগরি", "Categories")} links={categoryLinks} />
            <FooterGroup id="support" title={t("সহায়তা", "Support")} links={footerLinks.help} />
            <FooterGroup id="company" title={t("প্রতিষ্ঠান", "Company")} links={footerLinks.company} />
          </div>

          {/* ── 3 · payments + legal ───────────────────────────────── */}
          {/* pr on desktop: the global back-to-top button (fixed bottom-6 right-6,
              44px) floats over the bottom-right corner of this footer, and the
              row's last tile / +N button would sit underneath it once the page
              is scrolled to the end. 64px of padding keeps that corner clear. */}
          <div className="relative mt-9 flex flex-col gap-5 border-t border-neu-line/50 pt-6 sm:pr-16 lg:mt-10 lg:flex-row lg:items-center lg:justify-between">
            {paymentMethods.length > 0 ? <FooterPayments methods={paymentMethods} /> : null}

            {/* ml-auto: stays on the right even when there is no payment block */}
            <div className="flex flex-col items-center gap-2 text-center lg:ml-auto lg:items-end lg:text-right">
              <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-neu-muted" aria-label="আইনি">
                <LegalLink href="/policies/privacy">{t("প্রাইভেসি", "Privacy")}</LegalLink>
                <span aria-hidden className="text-neu-line">
                  ·
                </span>
                <LegalLink href="/policies/terms">{t("শর্তাবলী", "Terms")}</LegalLink>
                <span aria-hidden className="text-neu-line">
                  ·
                </span>
                <LegalLink href="/policies/refund">{t("রিফান্ড", "Refund")}</LegalLink>
              </nav>
              <p className="text-[11.5px] text-neu-faint">
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
    <span className="neu-raised-xs grid h-7 w-7 shrink-0 place-items-center rounded-lg text-neu-accent-strong">
      {children}
    </span>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="transition hover:text-neu-accent-strong">{children}</Link>;
}

/**
 * One footer link group.
 *
 * Phones get an accordion: four open columns of five links each made the footer
 * taller than two product pages, and every link competed with the ones above it.
 * Closed by default, the whole block is four rows high; a tap expands one group
 * with a height/opacity transition (grid-rows trick — no JS measuring, no
 * layout jump). From `md` the button is inert: every group is open and the
 * chevron disappears.
 */
function FooterGroup({ id, title, links }: { id: string; title: string; links: FooterLink[] }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = `footer-${id}`;

  return (
    <div className="border-b border-neu-line/40 md:border-0">
      <h4 className="md:mb-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="group flex w-full items-center justify-between gap-3 py-3.5 text-left md:pointer-events-none md:py-0"
        >
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neu-accent-strong">
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-neu-accent/50" />
            {title}
          </span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-neu-faint transition-transform duration-300 md:hidden ${
              open ? "rotate-180 text-neu-accent-strong" : ""
            }`}
          />
        </button>
      </h4>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out md:!grid-rows-[1fr] md:opacity-100 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <ul className="overflow-hidden pb-2 md:pb-0">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex min-h-[36px] items-center gap-2.5 py-1 pl-1 text-[13.5px] text-neu-muted transition-colors hover:text-neu-accent-strong focus-visible:text-neu-accent-strong"
              >
                <span
                  aria-hidden
                  className="h-1 w-1 shrink-0 rounded-full bg-neu-line transition group-hover:scale-150 group-hover:bg-neu-accent"
                />
                <span className="border-b border-transparent transition-colors group-hover:border-neu-accent/40">
                  {t(l.labelBn, l.labelEn)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

