"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isChunkLoadError, recoverFromStaleChunks } from "@/lib/chunk-recovery";

/**
 * Storefront error boundary.
 *
 * A chunk that will not load is not a page error — it means the browser is
 * holding a previous build (an old service worker, or an HTTP-cached document
 * referencing hashed files that no longer exist). The right response is to
 * clear that state and reload, not to show "কিছু একটা ভুল হয়েছে" and hope the
 * visitor taps retry. `lib/chunk-recovery.ts` does the clearing; this component
 * notices the case, shows a short message while it happens, and stays out of
 * the way for every other kind of failure.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    console.error("[app-error]", error);
    if (attempted.current) return;
    attempted.current = true;
    if (!isChunkLoadError(error)) return;
    setRecovering(true);
    void recoverFromStaleChunks();
  }, [error]);

  if (recovering) {
    return (
      <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl" aria-hidden>🥕</span>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">এক মুহূর্ত…</h1>
        <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
          নতুন সংস্করণ এসেছে — পৃষ্ঠাটি নিজে থেকেই রিফ্রেশ হচ্ছে।
        </p>
      </div>
    );
  }

  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl" aria-hidden>🥕</span>
      <h1 className="mt-5 text-2xl font-bold sm:text-3xl">কিছু একটা ভুল হয়েছে</h1>
      <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
        দুঃখিত, এই পৃষ্ঠাটি লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন অথবা হোমে ফিরে যান।
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn-primary">আবার চেষ্টা করুন</button>
        <Link href="/" className="btn-ghost">হোমে ফিরুন</Link>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-[10.5px] text-sand-100/25">রেফারেন্স: {error.digest}</p>
      ) : null}
    </div>
  );
}
