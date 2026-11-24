"use client";

import Link from "next/link";
import { Megaphone, Phone } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { site } from "@/lib/site";
import type { AnnouncementSettings } from "@/lib/site-settings";

/* ==========================================================================
   AnnouncementMarquee — the scrolling strip above the header
   --------------------------------------------------------------------------
   Everything here comes from /foisal/settings → "উপরের ঘোষণা": the messages,
   the loop speed, the call-to-action and whether the bar shows at all. The
   owner changes the text in the panel and the next page load shows it — no
   deploy, no code.

   The animation is pure CSS on a duplicated track, so the loop is seamless and
   costs no JavaScript. `prefers-reduced-motion` stops it and the bar becomes a
   normal, readable one-line ticker. Hover pauses it so a long message can be
   read. On a phone the text is 11px and never wraps — a marquee that wraps is
   not a marquee.
   ========================================================================== */

function isExternal(href: string): boolean {
  return /^(?:https?:|tel:|mailto:)/i.test(href);
}

export function AnnouncementMarquee({ settings }: { settings: AnnouncementSettings }) {
  const { isBn } = useLocale();

  const messages = (isBn ? settings.messages_bn : settings.messages_en)
    .map((m) => m.trim())
    .filter(Boolean);

  // Nothing to say → no bar. A disabled bar never renders its wrapper either,
  // so the sticky header sits exactly at the top of the page.
  if (!settings.enabled || messages.length === 0) return null;

  const ctaLabel = (isBn ? settings.link_label_bn : settings.link_label_en).trim();
  const ctaHref = settings.link_url.trim();
  const showCta = Boolean(ctaLabel && ctaHref);

  /* One "run" of the track. Rendered twice: the second copy is what the first
     slides into, which is what makes the loop look endless. */
  const run = (
    <ul className="flex shrink-0 items-center">
      {messages.map((message, index) => (
        <li key={`${message}-${index}`} className="flex items-center whitespace-nowrap">
          <span className="px-3 text-[11.5px] font-medium leading-none text-neu-accent-strong sm:px-5 sm:text-[12.5px]">
            {message}
          </span>
          <span aria-hidden className="text-[8px] text-neu-accent/40">
            ●
          </span>
        </li>
      ))}
      {showCta ? (
        <li className="flex items-center whitespace-nowrap">
          {isExternal(ctaHref) ? (
            <a
              href={ctaHref}
              className="px-3 text-[11.5px] font-bold leading-none text-neu-accent-strong underline decoration-neu-accent/40 underline-offset-2 sm:px-5 sm:text-[12.5px]"
            >
              {ctaLabel}
            </a>
          ) : (
            <Link
              href={ctaHref}
              className="px-3 text-[11.5px] font-bold leading-none text-neu-accent-strong underline decoration-neu-accent/40 underline-offset-2 sm:px-5 sm:text-[12.5px]"
            >
              {ctaLabel}
            </Link>
          )}
          <span aria-hidden className="text-[8px] text-neu-accent/40">
            ●
          </span>
        </li>
      ) : null}
    </ul>
  );

  return (
    <div
      className={`relative overflow-hidden border-b border-neu-accent/15 bg-gradient-to-r from-neu-accent-soft via-[#E9F4EE] to-neu-accent-soft ${
        settings.show_mobile ? "" : "hidden sm:block"
      }`}
      role="region"
      aria-label={isBn ? "ঘোষণা" : "Announcements"}
    >
      <div className="relative flex h-9 items-center">
        {/* the moving track — `min-w-0` keeps the phone chip on screen */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-max animate-marquee items-center will-change-transform hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{ animationDuration: `${settings.speed}s` }}
          >
            {run}
            <div aria-hidden className="flex shrink-0 items-center">
              {run}
            </div>
          </div>
        </div>

        {/* a small phone chip stays put on the right so a customer can always
            call without waiting for the number to scroll past */}
        <a
          href={`tel:${site.phone}`}
          className="ml-auto hidden shrink-0 items-center gap-1.5 border-l border-neu-accent/15 bg-white/60 px-3 text-[11.5px] font-semibold text-neu-accent-strong backdrop-blur-sm transition hover:text-neu-ink sm:flex"
          aria-label={isBn ? "ফোনে কল করুন" : "Call us"}
        >
          <Phone className="h-3 w-3" />
          {site.phoneDisplay}
        </a>

        {/* icon on the very left, purely decorative */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden h-full items-center bg-neu-accent-soft/90 pl-2 pr-3 text-neu-accent-strong sm:flex"
        >
          <Megaphone className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
