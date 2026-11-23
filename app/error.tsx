"use client";

import Link from "next/link";
import { useEffect } from "react";

/* Root error boundary (500). Shows a safe Bangla sentence; the real reason is
   logged for the owner and never rendered to a customer. */

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error.message, error.digest ?? "");
  }, [error]);

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
