"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";

/** Admin-only confirmation shown on the /p/<token> rider page. */
export function MarkDelivered({ token }: { token: string }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/foisal/parcels/deliver", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("মার্ক করা যায়নি", json?.message);
        return;
      }

      success("ডেলিভারি সম্পন্ন হিসেবে মার্ক করা হয়েছে");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={submit}
      disabled={loading}
      className="btn-primary mt-1 w-full"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      ডেলিভারি সম্পন্ন করুন
    </button>
  );
}
