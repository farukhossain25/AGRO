"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isChunkLoadError, recoverFromStaleChunks } from "@/lib/chunk-recovery";

/* Root error boundary (500). Shows a safe Bangla sentence; the real reason is
   logged for the owner and never rendered to a customer.

   A chunk that will not load is not a page error — it means the browser holds a
   previous build (an old service worker, a cached document pointing at hashed
   files that no longer exist). The storefront boundary has handled that since
   #86; this one covers the routes outside that group (the panel, auth), which
   would otherwise show "the page could not be loaded" with a retry that
   re-renders the same broken chunk state. */

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    console.error("[app-error]", error.message, error.digest ?? "");
    if (attempted.current) return;
    attempted.current = true;
    if (!isChunkLoadError(error)) return;
    setRecovering(true);
    void recoverFromStaleChunks();
  }, [error]);

  if (recovering) {
    return (
      <main className="container-x flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl" aria-hidden>🥕</span>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">এক মুহূর্ত…</h1>
        <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
          নতুন সংস্করণ এসেছে — পৃষ্ঠাটি নিজে থেকেই রিফ্রেশ হচ্ছে।
        </p>
      </main>
    );
  }

  return (
    <main className="container-x flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl" aria-hidden>
        🥕
      </span>
      <h1 className="mt-5 text-2xl font-bold sm:text-3xl">কিছু একটা ভুল হয়েছে</h1>
      <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-sand-100/55">
        দুঃখিত, পৃষ্ঠাটি লোড করা যায়নি। আবার চেষ্টা করুন — সমস্যা থাকলে একটু পরে দেখুন।
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          আবার চেষ্টা করুন
        </button>
        <Link href="/" className="btn-ghost">
          হোমে ফিরুন
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-[10.5px] text-sand-100/25">রেফারেন্স: {error.digest}</p>
      ) : null}
    </main>
  );
}
