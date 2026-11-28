"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/* ==========================================================================
   BackLink — "ফিরে যান" for pages you arrive at from somewhere else
   --------------------------------------------------------------------------
   A product, a category, an order receipt: these are reached by clicking, and
   until now the only way back was the browser's own back button. On a phone
   that lives in a chrome bar that scrolls away, so the way out was invisible.

   WHY router.back() AND NOT ALWAYS A LINK
     Going back should restore the list the visitor was looking at — scroll
     position, the active filter, the category they were browsing. A hardcoded
     href="/products" throws all of that away and is a worse answer than the
     gesture people already expect.

     But history can be empty (a shared link opened in a fresh tab), and
     `history.length` cannot be trusted for that — it counts entries from other
     sites too. So the fallback matters: `fallback` is a real URL that always
     works, and it is used whenever there is no in-app page to return to.
     `document.referrer` is checked for the same reason: a visitor arriving
     from Google should not be sent "back" into Google's search results.

   The component renders a real <a> so it works before hydration and can be
   opened in a new tab — the click handler only upgrades it to a history hop.
   ========================================================================== */

export function BackLink({
  fallback = "/",
  label = "ফিরে যান",
  className = "",
}: {
  /** Where to go when there is no in-app page to return to. */
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // honour middle-click / ctrl-click / "open in new tab"
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const referrer = typeof document !== "undefined" ? document.referrer : "";
    const cameFromThisSite = referrer !== "" && referrer.startsWith(window.location.origin);

    if (cameFromThisSite) {
      e.preventDefault();
      router.back();
    }
    // otherwise let the <a href={fallback}> behave normally
  }

  return (
    <Link
      href={fallback}
      onClick={handleClick}
      className={`group inline-flex items-center gap-1.5 text-[13px] font-semibold text-neu-muted transition-colors hover:text-neu-accent-strong ${className}`}
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
