"use client";

import { Component, type ReactNode } from "react";

/**
 * ONE SECTION CANNOT TAKE THE PAGE DOWN.
 *
 * Every homepage block is already individually recoverable at the DATA layer —
 * `safe()` in lib/data.ts returns an empty array rather than throwing,
 * `timed()` in lib/content.ts returns built-in content, /faq falls back to its
 * seed copy. What was missing is the same guarantee at the RENDER layer: the
 * blocks share one component tree, so a single exception while rendering one of
 * them — a malformed price, a null a component did not expect, a client
 * component throwing during hydration — reached `app/(storefront)/error.tsx`
 * and replaced the ENTIRE homepage, hero included.
 *
 * This is the difference between "the blog strip is missing" and "the site is
 * down". A throwing child is caught here and logged with its section key; the
 * rest of the page keeps its content.
 *
 * WHY A CLASS IN A CLIENT FILE
 *   React only offers `getDerivedStateFromError` / `componentDidCatch` as class
 *   APIs, and a class boundary must live in a client component — Next refuses
 *   to compile one inside a server module. `"use client"` here does NOT make
 *   the children client components: they are already-rendered server elements
 *   passed through as `children`, so the RSC output and the HTML are unchanged.
 *
 * WHY THE FALLBACK IS `null`
 *   A section that fails should disappear, not leave a hole with an apology.
 *   The page around it is intact and the visitor can still shop; a second error
 *   message inside a page that otherwise works draws attention to the wrong
 *   thing. The log line is the honest record.
 */
export class SectionBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    /* Server console (Vercel function log) or the browser console on a
       hydration failure. Never sent to the visitor: they get the surrounding
       page, not a stack trace. */
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[home] section failed key=${this.props.name} err=${message.slice(0, 200)}`);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
