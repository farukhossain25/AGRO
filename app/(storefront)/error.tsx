"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

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
