"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/lib/toast";
import type { PremiumPlan } from "@/lib/types";

/* ==========================================================================
   PlanCheckout — method picker + POST /api/premium/subscribe
   --------------------------------------------------------------------------
   • signed-out visitors are bounced to /login with a next= back-link
   • sandbox gateways return a redirect URL to the simulated checkout
   • COD/manual creates an immediately-active subscription (bKash "manual")
   ========================================================================== */

const METHODS = [
  { id: "bkash", label: "bKash", icon: "🟣", note: "সবচেয়ে জনপ্রিয়" },
  { id: "nagad", label: "Nagad", icon: "🟠", note: "" },
  { id: "sslcommerz", label: "কার্ড / SSLCommerz", icon: "💳", note: "ভিসা, মাস্টারকার্ড" },
] as const;

export function PlanCheckout({
  plan,
  signedIn,
  compact = false,
}: {
  plan: PremiumPlan;
  signedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("bkash");
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/live/plans?plan=${plan.slug}`)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/premium/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planSlug: plan.slug, method }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("সাবস্ক্রিপশন তৈরি হয়নি", json?.message);
        return;
      }

      if (json.data.redirect) {
        window.location.href = json.data.redirect;
        return;
      }

      success("প্রিমিয়াম সক্রিয় হয়েছে", "এখন লাইভ ক্যামেরা দেখতে পারবেন");
      router.push("/live/farms");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা", "আবার চেষ্টা করুন");
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button type="button" onClick={start} disabled={loading} className="btn-primary btn-sm w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {loading ? "প্রস্তুত হচ্ছে…" : `৳${plan.price} — নিন`}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        {METHODS.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] transition ${
              method === m.id
                ? "border-mint/50 bg-mint/8 text-white"
                : "border-white/8 bg-white/[0.02] text-sand-100/65 hover:border-white/15"
            }`}
          >
            <input
              type="radio"
              name={`method-${plan.id}`}
              value={m.id}
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
              className="sr-only"
            />
            <span className="text-sm">{m.icon}</span>
            <span className="flex-1">{m.label}</span>
            {m.note && <span className="text-[10px] text-sand-100/35">{m.note}</span>}
            <span
              className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                method === m.id ? "border-mint bg-mint" : "border-white/25"
              }`}
            >
              {method === m.id && <span className="h-1.5 w-1.5 rounded-full bg-green-950" />}
            </span>
          </label>
        ))}
      </div>

      <button type="button" onClick={start} disabled={loading} className="btn-mint w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {loading ? "প্রস্তুত হচ্ছে…" : `৳${plan.price} — সাবস্ক্রাইব করুন`}
      </button>

      {!signedIn && (
        <p className="text-center text-[10.5px] text-sand-100/40">লগইন করে তারপর পেমেন্ট করবেন</p>
      )}
    </div>
  );
}
