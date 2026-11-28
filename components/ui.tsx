"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";

/* ------------------------------------------------------------------ section */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
  action,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
  /**
   * Heading level. Defaults to h2, which is right for a section inside a page
   * that already has its own h1. A page whose ONLY heading is this one — /market,
   * /categories, /blog — must pass "h1": Lighthouse's
   * "page does not have an h1" audit is an SEO score item, and a page that
   * starts at h2 also reads as a missing section to a screen reader.
   */
  as?: "h1" | "h2";
}) {
  return (
    <div
      className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${
        align === "center" ? "text-center sm:flex-col sm:items-center sm:text-center" : ""
      }`}
    >
      <div className={align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}>
        {eyebrow ? <span className="eyebrow mb-3">{eyebrow}</span> : null}
        <Heading className="h-section">{title}</Heading>
        {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-neu-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------------- star */
export function StarRating({
  value,
  size = 14,
  onChange,
  className = "",
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const interactive = Boolean(onChange);

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "রেটিং দিন" : `রেটিং ${value} / ৫`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = (hover || value) >= i;
        const StarEl = (
          <Star
            width={size}
            height={size}
            className={filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-neu-line"}
          />
        );
        return interactive ? (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} তারা`}
            onClick={() => onChange?.(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            {StarEl}
          </button>
        ) : (
          <span key={i}>{StarEl}</span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ badges */
export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <span className="badge bg-red-500/10 text-[#c0392b]">স্টকে নেই</span>;
  }
  if (stock <= 10) {
    return <span className="badge bg-amber-500/15 text-[#a35c07]">মাত্র {stock}টি বাকি</span>;
  }
  return <span className="badge bg-neu-accent-soft text-neu-accent-strong">স্টকে আছে</span>;
}

export function Badge({ children, tone = "leaf" }: { children: ReactNode; tone?: "leaf" | "amber" | "red" | "neutral" }) {
  const tones = {
    leaf: "bg-neu-accent-soft text-neu-accent-strong",
    amber: "bg-amber-500/15 text-[#a35c07]",
    red: "bg-red-500/10 text-[#c0392b]",
    neutral: "bg-neu-sunken text-neu-muted",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

/* ------------------------------------------------------------------- empty */
export function EmptyState({
  icon = "🌱",
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="neu-raised grid h-16 w-16 place-items-center rounded-full text-3xl" aria-hidden>
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-neu-ink">{title}</h3>
      {body ? <p className="max-w-sm text-sm leading-relaxed text-neu-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- skeletons */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden p-3">
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function Shimmer({ children, loading }: { children: ReactNode; loading: boolean }) {
  if (!loading) return <>{children}</>;
  return <span className="inline-block h-4 w-16 animate-pulse rounded bg-neu-sunken" aria-hidden />;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}

/* -------------------------------------------------------------- pagination */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 2),
    Math.max(0, page - 2) + 5
  );

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="পেজিনেশন">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="neu-icon-btn h-9 w-9 disabled:opacity-40"
        aria-label="আগের পাতা"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`h-9 min-w-9 rounded-full px-2 text-sm font-semibold transition ${
            p === page
              ? "bg-neu-accent text-white shadow-neu-accent-sm"
              : "neu-icon-btn text-neu-muted hover:text-neu-accent-strong"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="neu-icon-btn h-9 w-9 disabled:opacity-40"
        aria-label="পরের পাতা"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------- back to top */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!visible) return null;
  return (
    <button
      onClick={toTop}
      aria-label="উপরে যান"
      className="neu-icon-btn print:hidden fixed bottom-24 right-4 z-40 h-11 w-11 sm:bottom-6 sm:right-6"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

/* ------------------------------------------------------------------- toast */
export function Toast({ message }: { message: string }) {
  return (
    <div
      className="neu-raised-lg fixed inset-x-4 z-50 animate-fade-up rounded-2xl px-4 py-3 text-sm text-neu-ink"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      {message}
    </div>
  );
}

/* ---------------------------------------------------------------- accordion */
export function Accordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="card divide-y divide-neu-line/50 overflow-hidden !rounded-xl p-2">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left transition hover:bg-white/60"
            >
              <span className="text-[15px] font-semibold text-neu-ink">{item.q}</span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-lg transition ${
                  isOpen ? "neu-inset-xs rotate-45 text-neu-accent-strong" : "neu-raised-xs text-neu-muted"
                }`}
                aria-hidden
              >
                +
              </span>
            </button>
            {isOpen ? (
              <div className="animate-fade-in px-4 pb-5 text-sm leading-7 text-neu-muted">{item.a}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ link btn */
export function ViewAll({ href, label = "সব দেখুন" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="btn-ghost btn-sm group">
      {label}
      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
