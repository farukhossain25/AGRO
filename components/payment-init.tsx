"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { Spinner } from "./ui";

/**
 * Calls /api/payments/initiate then redirects to the gateway (or to the local
 * simulated checkout when merchant credentials are absent).
 */
export function PaymentInit({ orderNo, method }: { orderNo: string; method: string }) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_no: orderNo, method }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "পেমেন্ট শুরু করা যায়নি");
      window.location.href = json.data.redirect;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  useEffect(() => {
    // auto-start once on mount for a checkout-like feel
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="mt-5">
        <p className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-left text-[12px] text-red-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
        <button onClick={start} className="btn-primary mt-3 w-full">
          <RefreshCw className="h-4 w-4" /> {t("আবার চেষ্টা করুন", "Try again")}
        </button>
      </div>
    );
  }

  return (
    <button onClick={start} disabled={loading} className="btn-primary mt-5 w-full">
      {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
      {loading ? t("গেটওয়েতে পাঠানো হচ্ছে…", "Redirecting to gateway…") : t("পেমেন্ট শুরু করুন", "Start payment")}
    </button>
  );
}
