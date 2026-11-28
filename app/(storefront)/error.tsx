"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearBuildCacheAndReload, isChunkLoadError, recoverFromStaleChunks } from "@/lib/chunk-recovery";

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

    /* Show the "refreshing" state only once a reload is genuinely under way.
       The previous version set it unconditionally and then called a recovery
       that returns early — by design — when this build had already used its
       one automatic attempt. The result was a screen promising a refresh that
       would never arrive, with no button to press: the reported "কিছুই কাজ
       করছে না" on every page. */
    void recoverFromStaleChunks().then((started) => {
      if (started) setRecovering(true);
    });

    /* Belt and braces: the reload should happen within a second, but a blocked
       `location.replace` (a WebView, a locked-down browser) must not leave a
       spinner on screen forever. Four seconds later the normal error screen
       with its buttons is shown even if `recovering` was set. */
    const guard = window.setTimeout(() => setRecovering(false), 4000);
    return () => window.clearTimeout(guard);
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
      {/* The automatic stale-build cleanup gets ONE try per build. If it was
          already spent (an earlier page in this tab), the visitor used to have
          no way to force it — so the fix for a stale worker was unreachable
          from the screen that exists to recover from it. */}
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
    </div>
  );
}
