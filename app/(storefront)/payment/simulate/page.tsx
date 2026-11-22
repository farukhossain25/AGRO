import type { Metadata } from "next";
import Link from "next/link";
import { money } from "@/lib/format";
import { SimulatePayment } from "@/components/simulate-payment";
import { paymentMethods } from "@/lib/site";

/* Private surface — keep it out of the index and out of snippets. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};


export const dynamic = "force-dynamic";

/** Local stand-in for a hosted gateway page while sandbox keys are unset. */
export default async function SimulatePage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string; order?: string; amount?: string }>;
}) {
  const { gateway = "bkash", order = "", amount = "0" } = await searchParams;
  const meta = paymentMethods.find((m) => m.id === gateway) ?? paymentMethods[0];

  return (
    <div className="container-x flex min-h-[75vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="rounded-t-3xl bg-gradient-to-r from-ink-800 to-ink-700 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sm">{meta.emoji}</span>
              <div>
                <p className="text-[13px] font-bold">{meta.bn}</p>
                <p className="text-[10px] text-sand-100/45">Sandbox Checkout</p>
              </div>
            </div>
            <span className="badge bg-amber-400/90 text-ink-900">টেস্ট</span>
          </div>
        </div>

        <div className="card rounded-t-none border-t-0 p-5">
          <p className="text-[11.5px] uppercase tracking-wider text-sand-100/40">মার্চেন্ট</p>
          <p className="text-[14px] font-semibold">বিশ্বাস এগ্রো (Biswas Agro)</p>

          <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-center">
            <p className="text-[11px] text-sand-100/45">পরিশোধযোগ্য</p>
            <p className="mt-1 text-3xl font-bold text-leaf-200">{money(Number(amount), true)}</p>
            <p className="mt-1 text-[11px] text-sand-100/40">অর্ডার: {order || "—"}</p>
          </div>

          <SimulatePayment orderNo={order} gateway={gateway} />

          <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-[10.5px] leading-relaxed text-amber-200/80">
            এটি একটি সিমুলেটেড পেমেন্ট স্ক্রিন। লাইভ গেটওয়ে চালু করতে <code className="font-mono">.env</code>-এ
            {" "}{gateway.toUpperCase()}_... কী যোগ করুন এবং <code className="font-mono">PAYMENTS_SANDBOX=false</code> করুন।
          </p>

          <Link href="/" className="mt-4 block text-center text-[11.5px] text-sand-100/40 hover:text-sand-100">
            বাতিল করে হোমে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}
