"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { Spinner } from "./ui";

export function SimulatePayment({ orderNo, gateway }: { orderNo: string; gateway: string }) {
  const { t } = useLocale();
  const toast = useToast();
  const [loading, setLoading] = useState<"success" | "fail" | null>(null);

  async function confirm(outcome: "success" | "fail") {
    setLoading(outcome);
    try {
      const res = await fetch("/api/payments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_no: orderNo, gateway, outcome }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "পেমেন্ট আপডেট হয়নি");

      if (outcome === "success") {
        window.location.href = `/order-success?order=${orderNo}&paid=1`;
      } else {
        toast.error(t("পেমেন্ট ব্যর্থ হয়েছে", "Payment failed"), t("অর্ডার সংরক্ষিত আছে, আবার চেষ্টা করুন।", "Your order is saved — try again."));
        setLoading(null);
      }
    } catch (err) {
      toast.error(t("সমস্যা হয়েছে", "Something went wrong"), (err as Error).message);
      setLoading(null);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        onClick={() => confirm("success")}
        disabled={loading !== null}
        className="btn-mint w-full"
      >
        {loading === "success" ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />}
        {t("পেমেন্ট সফল হিসেবে নিশ্চিত করুন", "Confirm successful payment")}
      </button>
      <button
        onClick={() => confirm("fail")}
        disabled={loading !== null}
        className="btn-ghost w-full !text-red-300"
      >
        {loading === "fail" ? <Spinner /> : <XCircle className="h-4 w-4" />}
        {t("পেমেন্ট ব্যর্থ সিমুলেট করুন", "Simulate failure")}
      </button>
    </div>
  );
}
