"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { useToast } from "@/lib/toast";

/** Access-code card redemption (sold offline via shops / gift cards). */
export function RedeemCode({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      router.push("/login?next=/live/plans");
      return;
    }
    if (code.replace(/[^A-Za-z0-9]/g, "").length < 8) {
      errorToast("কোড ভুল", "সম্পূর্ণ কোডটি লিখুন");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/premium/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("কোড ব্যবহার করা যায়নি", json?.message);
        return;
      }

      success("কোড সফলভাবে ব্যবহৃত হয়েছে", `${json.data.days} দিনের প্রিমিয়াম সক্রিয়`);
      setCode("");
      router.refresh();
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
        <Ticket className="h-3.5 w-3.5 text-mint" /> অ্যাক্সেস কোড আছে?
      </p>
      <p className="mt-1 text-[11px] text-sand-100/45">দোকান থেকে কেনা কার্ডের কোডটি লিখুন (XXXX-XXXX-XXXX)</p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-EFGH-JKLM"
          className="input flex-1 font-mono text-[13px] tracking-widest"
          maxLength={16}
          aria-label="অ্যাক্সেস কোড"
        />
        <button type="submit" disabled={loading} className="btn-primary btn-sm shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ব্যবহার করুন"}
        </button>
      </div>
    </form>
  );
}
