import Link from "next/link";

export function Logo({ size = 40, href = "/", showText = true }: { size?: number; href?: string | null; showText?: boolean }) {
  const mark = (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf-500 to-leaf-700 shadow-[0_8px_24px_-10px_rgba(31,122,77,.9)]"
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

  const text = (
    <span className="flex flex-col leading-none">
      <span className="text-[15px] font-bold tracking-tight text-sand-100">বিশ্বাস এগ্রো</span>
      <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-leaf-300/80">
        Farm to Family
      </span>
    </span>
  );

  const content = (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      {showText ? text : null}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label="বিশ্বাস এগ্রো — হোম" className="rounded-2xl">
      {content}
    </Link>
  );
}
