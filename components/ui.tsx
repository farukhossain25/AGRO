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
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
}) {
  return (
    <div
      className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${
        align === "center" ? "text-center sm:flex-col sm:items-center sm:text-center" : ""
      }`}
    >
      <div className={align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}>
        {eyebrow ? <span className="eyebrow mb-3">{eyebrow}</span> : null}
        <h2 className="h-section">{title}</h2>
        {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-sand-100/60">{subtitle}</p> : null}
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
            className={filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-white/25"}
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
    return <span className="badge bg-red-500/15 text-red-300">স্টকে নেই</span>;
  }
  if (stock <= 10) {
    return <span className="badge bg-amber-500/15 text-amber-300">মাত্র {stock}টি বাকি</span>;
  }
  return <span className="badge bg-leaf-600/20 text-leaf-200">স্টকে আছে</span>;
}

export function Badge({ children, tone = "leaf" }: { children: ReactNode; tone?: "leaf" | "amber" | "red" | "neutral" }) {
  const tones = {
    leaf: "bg-leaf-600/20 text-leaf-200",
    amber: "bg-amber-500/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
    neutral: "bg-white/[0.07] text-sand-100/70",
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
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body ? <p className="max-w-sm text-sm leading-relaxed text-sand-100/55">{body}</p> : null}
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
  return (
    <span className="inline-block h-4 w-16 animate-pulse rounded bg-white/10" aria-hidden />
  );
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
        className="btn-ghost btn-sm !rounded-xl disabled:opacity-40"
        aria-label="আগের পাতা"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition ${
            p === page
              ? "bg-leaf-600 text-white"
              : "border border-white/10 bg-white/[0.03] text-sand-100/70 hover:border-leaf-500/40"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="btn-ghost btn-sm !rounded-xl disabled:opacity-40"
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
      className="fixed bottom-24 right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-ink-800/90 text-leaf-200 shadow-soft backdrop-blur transition hover:border-leaf-500/60 hover:bg-ink-700 sm:bottom-6 sm:right-6"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

/* ------------------------------------------------------------------- toast */
export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 animate-fade-up rounded-2xl border border-leaf-500/40 bg-ink-850/95 px-4 py-3 text-sm shadow-soft backdrop-blur">
      {message}
    </div>
  );
}

/* ---------------------------------------------------------------- accordion */
export function Accordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-850/60">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <span className="text-[15px] font-semibold">{item.q}</span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-leaf-200 transition ${
                  isOpen ? "rotate-45 bg-leaf-600/20" : ""
                }`}
                aria-hidden
              >
                +
              </span>
            </button>
            {isOpen ? (
              <div className="animate-fade-in px-5 pb-5 text-sm leading-7 text-sand-100/65">{item.a}</div>
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
