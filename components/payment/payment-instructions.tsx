"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/lib/toast";
import type { PaymentMethodRow } from "@/lib/types";

/* ==========================================================================
   PaymentInstructions — the copyable receiving number block
   --------------------------------------------------------------------------
   Shown on the payment page: a large, one-tap-copyable receiving number with
   the account name underneath. The customer sends exactly this amount to
   exactly this number.
   ========================================================================== */

export function PaymentInstructions({ method }: { method: PaymentMethodRow }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const number = method.account_number ?? "";
  const label = method.account_name || method.bank_name || method.name_bn;

  async function copy() {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      toast.success("নম্বর কপি হয়েছে", number);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("কপি করা যায়নি", "আবার চেষ্টা করুন");
    }
  }

  if (!number) {
    return (
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-sand-100/60">
        {method.instruction_bn ?? "নিচের নির্দেশনা অনুসরণ করে পেমেন্ট করুন।"}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group mt-2 block w-full overflow-hidden rounded-xl border border-leaf-500/30 bg-leaf-600/[0.06] p-4 text-left transition hover:border-leaf-500/60 hover:bg-leaf-600/[0.10]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">{label}</p>
          <p className="mt-0.5 break-all font-mono text-[18px] font-bold leading-tight text-leaf-200 sm:text-[20px]">
            {number}
          </p>
        </div>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${
            copied ? "bg-leaf-500 text-ink-900" : "bg-white/10 text-sand-100/60 group-hover:text-leaf-200"
          }`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-sand-100/40">
        {copied ? "কপি করা হয়েছে — এখন পেমেন্ট অ্যাপে প্যাস্ট করুন" : "টেপ করে নম্বরটি কপি করুন"}
      </p>
    </button>
  );
}
