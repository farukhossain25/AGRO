import Link from "next/link";

export function Logo({ size = 40, href = "/", showText = true }: { size?: number; href?: string | null; showText?: boolean }) {
  const mark = (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-2xl border border-white/40 bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-neu-accent-sm"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none">
        <path
          d="M16 27c0-7 0-11 0-11"
          stroke="#eefaf3"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M16 16C16 9.4 21 5 27 5c0 6.6-5 11-11 11Z"
          fill="#b7ead2"
        />
        <path
          d="M16 19C16 13.5 12 10 7 10c0 5.5 4 9 9 9Z"
          fill="#eefaf3"
          fillOpacity=".85"
        />
      </svg>
    </span>
  );

  /* On a 320–360px phone the mark + wordmark + five actions do not fit. The
     wordmark shrinks and truncates instead of pushing the header sideways. */
  const text = (
    <span className="flex min-w-0 flex-col leading-none">
      <span className="truncate text-[13px] font-bold tracking-tight text-neu-ink min-[400px]:text-[15px]">
        বিশ্বাস এগ্রো
      </span>
      <span className="mt-1 truncate text-[8.5px] font-semibold uppercase tracking-[0.18em] text-neu-accent-strong/80 min-[400px]:text-[9.5px] min-[400px]:tracking-[0.22em]">
        Farm to Family
      </span>
    </span>
  );

  const content = (
    <span className="inline-flex min-w-0 items-center gap-2 min-[400px]:gap-2.5">
      {mark}
      {showText ? text : null}
    </span>
  );

  if (!href) return content;
  /* No aria-label: the link's visible text ("বিশ্বাস এগ্রো · Farm to Family") is
     already a perfect accessible name, and overriding it with a shorter one
     fails label-content-name-mismatch — the name has to contain every word the
     sighted user reads. */
  return (
    <Link href={href} className="rounded-2xl">
      {content}
    </Link>
  );
}
