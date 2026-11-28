"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearBuildCacheAndReload, isChunkLoadError, recoverFromStaleChunks } from "@/lib/chunk-recovery";

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

    /* Only claim to be refreshing when a reload is really happening — see the
       long note in lib/chunk-recovery.ts. When the once-per-build attempt is
       already spent this returns false, and the visitor gets the normal screen
       with its working buttons instead of a spinner that never ends. */
    void recoverFromStaleChunks().then((started) => {
      if (started) setRecovering(true);
    });
    const guard = window.setTimeout(() => setRecovering(false), 4000);
    return () => window.clearTimeout(guard);
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
      {/* One automatic cleanup per build; this is the visitor's own, always
          available, in case that attempt was already spent in this tab. */}
      <button
        type="button"
        onClick={() => void clearBuildCacheAndReload()}
        className="mt-3 text-[12px] font-semibold text-leaf-300 underline-offset-4 hover:underline"
      >
        তবু না হলে — পুরনো ক্যাশ মুছে আবার লোড করুন
      </button>
      {error.digest ? (
        <p className="mt-6 font-mono text-[10.5px] text-sand-100/25">রেফারেন্স: {error.digest}</p>
      ) : null}
    </main>
  );
}
