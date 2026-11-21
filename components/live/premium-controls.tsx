"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { useToast } from "@/lib/toast";

/** Cancel / stop-renewal control for a live premium subscription. */
export function PremiumControls({
  subNo,
  canCancel,
  autoRenew,
}: {
  subNo: string;
  canCancel: boolean;
  autoRenew: boolean;
}) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!canCancel) return null;

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/premium/activate", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subNo }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("বাতিল করা যায়নি", json?.message);
        return;
      }

      success("সাবস্ক্রিপশন বাতিল হয়েছে", "মেয়াদ শেষ পর্যন্ত অ্যাক্সেস থাকবে");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      {!confirmed ? (
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="inline-flex items-center gap-1 text-[11px] text-sand-100/40 hover:text-red-300"
        >
          <XCircle className="h-3 w-3" /> সাবস্ক্রিপশন বাতিল করুন
          {autoRenew ? " (অটো-রিনিউ বন্ধ হবে)" : ""}
        </button>
      ) : (
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3">
          <p className="text-[11.5px] leading-relaxed text-red-200">
            নিশ্চিত? মেয়াদ শেষ পর্যন্ত লাইভ দেখা যাবে, এরপর আর রিনিউ হবে না।
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={cancel} disabled={busy} className="btn-primary btn-sm">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} হ্যাঁ, বাতিল করুন
            </button>
            <button type="button" onClick={() => setConfirmed(false)} className="btn-ghost btn-sm">
              না
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
