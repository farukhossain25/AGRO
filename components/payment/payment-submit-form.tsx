"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import { useToast } from "@/lib/toast";
import { money } from "@/lib/format";

/* ==========================================================================
   <PaymentSubmitForm /> — TrxID entry on the payment page
   --------------------------------------------------------------------------
   After the customer sends money to the displayed receiving number, they
   type their TrxID here. The report is stored on the order (payment_ref);
   the admin panel is the only place that marks the order paid.
   ========================================================================== */

type Props = {
  orderNo?: string;
  subNo?: string;
  amount: number | null;
  methodName: string;
  requiresTrx: boolean;
  requiresSender: boolean;
  /** the customer's own phone, pre-filled for guest orders */
  phone?: string;
};

export function PaymentSubmitForm({
  orderNo,
  subNo,
  amount,
  methodName,
  requiresTrx,
  requiresSender,
  phone,
}: Props) {
  const toast = useToast();
  const [trxId, setTrxId] = useState("");
  const [sender, setSender] = useState(phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trxId.trim()) {
      toast.error("TrxID দিন");
      return;
    }
    if (requiresSender && !sender.trim()) {
      toast.error("আপনার মোবাইল নম্বর দিন");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_no: orderNo ?? undefined,
          sub_no: subNo ?? undefined,
          trx_id: trxId.trim(),
          sender_number: sender.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "জমা দেওয়া যায়নি");
      setDone(true);
      toast.success("TrxID জমা দেওয়া হয়েছে", json.message);
    } catch (err) {
      toast.error("জমা দেওয়া যায়নি", (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-leaf-600/25 to-leaf-700/10 px-6 py-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-leaf-500/20">
            <CheckCircle2 className="h-7 w-7 text-leaf-300" />
          </span>
          <h2 className="mt-3 text-[15px] font-bold">TrxID জমা দেওয়া হয়েছে</h2>
          <p className="mt-1 text-[12.5px] text-sand-100/55">
            আপনার পেমেন্ট অ্যাডমিনের কাছে পাঠানো হয়েছে। যাচাই হলে অর্ডার
            পরিশোধিত হিসেবে চিহ্নিত হবে।
          </p>
          {amount != null ? (
            <p className="mt-2 text-[13px] font-semibold text-leaf-200">
              {money(amount, true)} · {methodName}
            </p>
          ) : null}
        </div>
        <div className="p-4">
          <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-sand-100/40">
            <ShieldCheck className="h-3.5 w-3.5 text-leaf-400" />
            অর্ডার স্টেটাস দেখতে <a href={`/track?order=${orderNo}`} className="text-leaf-300 underline">ট্র্যাক পেজ</a> দেখুন
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <Send className="h-4 w-4 text-leaf-300" />
          {requiresTrx ? "পেমেন্ট জমা দিন" : "পেমেন্ট সম্পন্ন করুন"}
        </h2>
      </div>

      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label htmlFor="trx-id" className="mb-1.5 block text-[11.5px] font-medium text-sand-100/70">
            TrxID {requiresTrx ? "*" : "(যদি থাকে)"}
          </label>
          <input
            id="trx-id"
            type="text"
            value={trxId}
            onChange={(e) => setTrxId(e.target.value)}
            placeholder="যেমন: Q8X2MNP47LK9"
            autoComplete="off"
            className="input w-full"
          />
          <p className="mt-1 text-[10.5px] text-sand-100/40">
            ট্রান্সফার শেষে অ্যাপ/SMS-এ প্রাপ্ত TrxID দিন।
          </p>
        </div>

        {requiresSender ? (
          <div>
            <label htmlFor="sender" className="mb-1.5 block text-[11.5px] font-medium text-sand-100/70">
              আপনার মোবাইল নম্বর {requiresSender ? "*" : ""}
            </label>
            <input
              id="sender"
              type="tel"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="01XXXXXXXXX"
              autoComplete="tel"
              className="input w-full"
            />
          </div>
        ) : null}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> জমা দেওয়া হচ্ছে…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> TrxID জমা দিন
            </>
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-sand-100/40">
          <ShieldCheck className="h-3 w-3 text-leaf-400" />
          TrxID জমা দিলেই অর্ডার পরিশোধিত হবে না — অ্যাডমিন যাচাই করে চিহ্নিত করবেন
        </p>
      </form>
    </div>
  );
}
