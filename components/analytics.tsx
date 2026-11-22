"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/* ==========================================================================
   GA4 — consent-first, zero cost when unconfigured
   --------------------------------------------------------------------------
   Section D wants real traffic data; section G (security/privacy) rules out
   dropping a third-party analytics script on people who never agreed to it.

   Behaviour:
     • NEXT_PUBLIC_GA_ID unset  → nothing renders, no request, no cookie.
     • No stored choice         → a small Bangla banner asks once; declining
                                  stores "denied" and GA never loads.
     • "granted"                → gtag.js loads after hydration (afterInteractive)
                                  so it never competes with LCP.
   ========================================================================== */

const STORAGE_KEY = "ba_ga_consent";

export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "granted" || stored === "denied") setConsent(stored);
    setReady(true);
  }, [id]);

  if (!id) return null;

  function choose(value: "granted" | "denied") {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  return (
    <>
      {consent === "granted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {ready && consent === null && (
        <div
          role="dialog"
          aria-label="কুকি অনুমতি"
          className="fixed inset-x-3 bottom-3 z-[70] rounded-2xl border border-white/10 bg-[#161a18]/95 p-4 shadow-2xl backdrop-blur md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm"
        >
          <p className="text-[13.5px] leading-relaxed text-white/80">
            সাইটটি কীভাবে ব্যবহার হচ্ছে তা বুঝতে আমরা অ্যানালিটিক্স কুকি ব্যবহার করি।
            ব্যক্তিগত তথ্য বিক্রি করা হয় না।
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => choose("granted")}
              className="btn-primary min-h-[44px] flex-1 rounded-xl px-4 text-[13.5px] font-semibold"
            >
              সম্মতি দিচ্ছি
            </button>
            <button
              type="button"
              onClick={() => choose("denied")}
              className="min-h-[44px] flex-1 rounded-xl border border-white/15 px-4 text-[13.5px] font-medium text-white/70 transition hover:bg-white/5"
            >
              না
            </button>
          </div>
        </div>
      )}
    </>
  );
}
