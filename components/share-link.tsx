"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   ShareLink — every share carries the sharer's referral code
   --------------------------------------------------------------------------
   The goal is simple: if a customer shares a product, the friend who opens
   that link must be able to become *their* referral. So the link we put on the
   clipboard is:

       https://site/products/<slug>?ref=<their-code>

   The code arrives on any page, is parked in a cookie by ReferralCatcher, and
   is claimed the moment the friend signs up — no extra step for them.

   Signed-out visitors still get a plain share (no code): crediting a share
   needs an account to credit. /api/referral/share-code answers with the code
   for the current session, and with an influencer's promo token when they have
   one, so an influencer's product links carry their promo code.
   ========================================================================== */

export function ShareLink({
  path,
  title,
  label,
  className,
  /** "icon" renders the 36 px round button used over the product gallery. */
  variant = "button",
}: {
  /** the page to share, e.g. "/products/ripe-mango" */
  path: string;
  title?: string;
  label?: string;
  className?: string;
  variant?: "button" | "icon";
}) {
  const toast = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/referral/share-code", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setCode(json.data?.code ?? null);
      } catch {
        /* no code → a plain share still works */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  async function share() {
    const base = `${window.location.origin}${path}`;
    const url = code ? `${base}${base.includes("?") ? "&" : "?"}ref=${code}` : base;

    if (variant === "icon" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* the user cancelled — fall through to copy */
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(
        code ? "লিংক কপি হয়েছে — আপনার কোডসহ" : "লিংক কপি হয়েছে",
        code ? "এই লিংকে কেউ অ্যাকাউন্ট খুললে সে আপনার রেফারেল" : undefined
      );
    } catch {
      toast.error("কপি করা গেল না", url);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={share}
        className={className}
        aria-label="শেয়ার করুন"
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button type="button" onClick={share} className={className}>
      <Copy className="h-4 w-4" />
      {label ?? "লিংক কপি করুন"}
    </button>
  );
}
