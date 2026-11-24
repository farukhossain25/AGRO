import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

/* Brand colours sampled from the master logo (assets/brand/bishwas-agro-logo.png):
   the deep ring green of "বিশ্বাস", the leaf green of "এগ্রো", the gold of "AGRO".
   Gold is a fill colour in the artwork — as 12 px type on a light surface it
   would sit at ~1.2:1, so the wordmark uses its darkened amber (#8f5a05, 4.9:1)
   instead of the literal #fcd818. */
const BN_DEEP = "#0a4d0a";
const BN_LEAF = "#2f7a10";
const EN_AMBER = "#8f5a05";
const BN_LEAF_ON_DARK = "#9fe3bf";
const EN_AMBER_ON_DARK = "#f6c85a";

export function Logo({
  size = 40,
  href = "/",
  showText = true,
  tone = "light",
  variant = "lockup",
  responsive = false,
  priority = false,
}: {
  /** Emblem edge in px. Everything else (type, gap) scales from it. */
  size?: number;
  href?: string | null;
  showText?: boolean;
  /** `dark` = the wordmark sits on the deep-green footer panel: white type. */
  tone?: "light" | "dark";
  /**
   * `lockup` (default): emblem tile + wordmark in brand colours — the sticky
   * header, checkout, admin. `full`: the complete logo artwork (emblem,
   * বিশ্বাস এগ্রো, BISHWAS AGRO, wave, tagline) on a white plate — only where
   * there is room to read the tagline (footer, emails).
   */
  variant?: "lockup" | "full";
  /** Header: the emblem grows with the breakpoint (40 → 44 → 52 px). */
  responsive?: boolean;
  /** Above-the-fold instances must not lazy-load. */
  priority?: boolean;
}) {
  const onDark = tone === "dark";

  /* `--logo-size` drives the tile and the type, so a 34 px checkout logo is a
     scaled copy of the 52 px desktop one. The breakpoint overrides live on the
     inner span: an inline style on the outer span would always win. */
  const rootStyle = { "--logo-size": `${size}px` } as CSSProperties;

  if (variant === "full") {
    /* The seal already has its own gold ring and transparent corners — no
       white plate behind it, or the round badge sits in a visible box. */
    const content = (
      <Image
        src="/brand/logo-full.webp"
        alt="বিশ্বাস এগ্রো — BISHWAS AGRO"
        width={1200}
        height={1093}
        sizes="(max-width: 640px) 200px, 240px"
        priority={priority}
        className="block h-auto w-[200px] sm:w-[240px]"
      />
    );
    if (!href) return content;
    return (
      <Link href={href} className="inline-block rounded-2xl">
        {content}
      </Link>
    );
  }

  const mark = (
    <span
      className="relative inline-flex h-[var(--logo-size)] w-[var(--logo-size)] shrink-0 overflow-hidden rounded-[24%] shadow-neu-xs ring-1 ring-black/[0.06]"
      aria-hidden
    >
      <Image
        src="/brand/logo-mark.webp"
        alt=""
        fill
        sizes={responsive ? "(max-width: 400px) 40px, (max-width: 640px) 44px, 52px" : `${size}px`}
        priority={priority}
        className="object-cover"
      />
    </span>
  );

  /* On a 320–360px phone the emblem + wordmark + three actions do not fit.
     The wordmark shrinks and truncates instead of pushing the header sideways. */
  const text = (
    <span className={`flex min-w-0 flex-col leading-none ${responsive ? "max-[359px]:hidden" : ""}`}>
      <span
        className="truncate font-bold tracking-tight text-[calc(var(--logo-size)*0.37)]"
        style={{ color: onDark ? "#ffffff" : BN_DEEP }}
      >
        বিশ্বাস <span style={{ color: onDark ? BN_LEAF_ON_DARK : BN_LEAF }}>এগ্রো</span>
      </span>
      <span
        className="mt-[calc(var(--logo-size)*0.11)] truncate font-sans font-bold uppercase tracking-[0.2em] text-[calc(var(--logo-size)*0.225)]"
        style={{ color: onDark ? "#9fe3bf" : BN_DEEP }}
      >
        BISHWAS{" "}
        <span style={{ color: onDark ? EN_AMBER_ON_DARK : EN_AMBER }}>AGRO</span>
      </span>
    </span>
  );

  const content = (
    <span
      className={`inline-flex min-w-0 items-center gap-[calc(var(--logo-size)*0.22)] ${
        responsive ? "min-[400px]:[--logo-size:44px] sm:[--logo-size:52px]" : ""
      }`}
    >
      {mark}
      {showText ? text : null}
    </span>
  );

  /* Base size inline; the breakpoint overrides sit on the inner span above. */
  const sizedContent = (
    <span style={rootStyle} className="inline-block min-w-0 align-middle">
      {content}
    </span>
  );

  if (!href) return sizedContent;
  /* No aria-label: the link's visible text ("বিশ্বাস এগ্রো · BISHWAS AGRO") is
     already a perfect accessible name, and overriding it with a shorter one
     fails label-content-name-mismatch — the name has to contain every word the
     sighted user reads. */
  return (
    <Link href={href} className="flex min-w-0 max-w-full items-center rounded-2xl">
      {sizedContent}
    </Link>
  );
}
