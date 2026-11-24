"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* ==========================================================================
   HeadMirror — keeps <head> valid on routes whose metadata is streamed
   --------------------------------------------------------------------------
   Every storefront route renders an async layout, so Next streams the page
   (loading.tsx) and React delivers the Metadata API's tags as an HTML chunk at
   the END OF <body> instead of inside <head>. That markup is invalid, invisible
   to crawlers that read <head>, and it is why Lighthouse reported "Document
   does not have a meta description" for a page that clearly had one.

   React owns those nodes, so moving them would break reconciliation on the next
   navigation. Instead we mirror them: clone every head-only tag that landed in
   <body> into <head>, and drop the previous mirror on each route change.

   Costs nothing when the metadata already lands in <head> (nothing to mirror).
   ========================================================================== */

const MARK = "data-head-mirror";

/** tags that are only valid inside <head> */
const SELECTOR = [
  "title",
  "meta",
  "link[rel='canonical']",
  "link[rel='alternate']",
  "link[rel='icon']",
  "link[rel='apple-touch-icon']",
].join(", ");

export function HeadMirror() {
  const pathname = usePathname();

  useEffect(() => {
    for (const stale of document.head.querySelectorAll(`[${MARK}]`)) stale.remove();

    const stray = document.body.querySelectorAll<HTMLElement>(`:scope > ${SELECTOR}`);
    for (const el of stray) {
      // A meta with neither name nor property (e.g. charset) is already in the
      // document head; mirroring it would duplicate it.
      if (el.tagName === "META" && !el.getAttribute("name") && !el.getAttribute("property")) continue;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.setAttribute(MARK, "");
      document.head.appendChild(clone);
    }
  }, [pathname]);

  return null;
}
