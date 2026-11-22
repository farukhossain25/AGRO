"use client";

import { useState } from "react";
import { Pause, Play, XCircle } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { Spinner } from "./ui";

export function SubscriptionControls({ subNo, status }: { subNo: string; status: string }) {
  const { t } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function act(action: "pause" | "resume" | "cancel") {
    setLoading(action);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub_no: subNo, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "সমস্যা হয়েছে");
      toast.success(
        action === "pause" ? t("সাবস্ক্রিপশন পজ হয়েছে", "Subscription paused")
          : action === "resume" ? t("সাবস্ক্রিপশন চালু হয়েছে", "Subscription resumed")
          : t("সাবস্ক্রিপশন বাতিল হয়েছে", "Subscription cancelled")
      );
      router.refresh();
    } catch (err) {
      toast.error(t("সমস্যা হয়েছে", "Something went wrong"), (err as Error).message);
    } finally {
      setLoading(null);
      setConfirming(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
      {status === "active" ? (
        <button onClick={() => act("pause")} disabled={loading !== null} className="btn-ghost btn-sm">
          {loading === "pause" ? <Spinner /> : <Pause className="h-3.5 w-3.5" />}
          {t("পজ করুন", "Pause")}
        </button>
      ) : (
        <button onClick={() => act("resume")} disabled={loading !== null} className="btn-ghost btn-sm">
          {loading === "resume" ? <Spinner /> : <Play className="h-3.5 w-3.5" />}
          {t("চালু করুন", "Resume")}
        </button>
      )}

      {confirming ? (
        <div className="flex items-center gap-2">
          <button onClick={() => act("cancel")} disabled={loading !== null} className="btn-ghost btn-sm !border-red-500/40 !text-red-300">
            {loading === "cancel" ? <Spinner /> : null}
            {t("নিশ্চিত বাতিল", "Confirm cancel")}
          </button>
          <button onClick={() => setConfirming(false)} className="text-[11.5px] text-sand-100/50">
            {t("না", "No")}
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="btn-ghost btn-sm !text-red-300/80">
          <XCircle className="h-3.5 w-3.5" />
          {t("বাতিল করুন", "Cancel")}
        </button>
      )}
    </div>
  );
}
