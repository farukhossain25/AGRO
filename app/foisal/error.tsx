"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ADMIN_BASE } from "@/lib/paths";

/* Admin error boundary — tells the admin what to do (reload / run SQL file)
   without ever showing a stack trace or a customer-facing message. */

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[foisal-error]", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="text-4xl" aria-hidden>
        ⚠️
      </span>
      <h1 className="mt-4 text-xl font-bold">প্যানেলের এই অংশটি লোড হয়নি</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-sand-100/55">
        ডেটাবেস সংযোগ বা একটি কুয়েরি ব্যর্থ হয়েছে। আবার চেষ্টা করুন। বারবার হলে{" "}
        <Link href={`${ADMIN_BASE}/system-check`} className="text-leaf-300 underline">
          সিস্টেম চেক
        </Link>{" "}
        চালান।
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary btn-sm">
          আবার চেষ্টা করুন
        </button>
        <Link href={ADMIN_BASE} className="btn-ghost btn-sm">
          ড্যাশবোর্ড
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-5 font-mono text-[10.5px] text-sand-100/25">রেফারেন্স: {error.digest}</p>
      ) : null}
    </div>
  );
}
