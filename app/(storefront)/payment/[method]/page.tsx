import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNo } from "@/lib/data";
import { PaymentInit } from "@/components/payment-init";
import { money } from "@/lib/format";
import { paymentMethods } from "@/lib/site";

export const dynamic = "force-dynamic";

const valid = ["bkash", "nagad", "sslcommerz"] as const;

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ method: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { method } = await params;
  const { order: orderNo } = await searchParams;

  if (!valid.includes(method as (typeof valid)[number])) notFound();
  if (!orderNo) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-2xl font-bold">অর্ডার নম্বর পাওয়া যায়নি</h1>
        <Link href="/products" className="btn-primary mt-5">পণ্য দেখুন</Link>
      </div>
    );
  }

  const order = await getOrderByNo(orderNo).catch(() => null);
  const meta = paymentMethods.find((m) => m.id === method);

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="card w-full max-w-md p-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-leaf-600/20 text-2xl">
          {meta?.emoji ?? "💳"}
        </span>

        <h1 className="mt-4 text-xl font-bold">
          {meta?.bn ?? method} {method === "sslcommerz" ? "" : "দিয়ে পেমেন্ট"}
        </h1>
        <p className="mt-1.5 text-[12.5px] text-sand-100/50">
          অর্ডার নম্বর: <span className="font-semibold text-leaf-200">{orderNo}</span>
        </p>

        {order ? (
          <p className="mt-4 text-[13px] text-sand-100/60">
            পরিশোধযোগ্য পরিমাণ
            <br />
            <span className="text-2xl font-bold text-leaf-200">{money(Number(order.total), true)}</span>
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200/90">
            অর্ডারের বিস্তারিত পাওয়া যায়নি — তবে পেমেন্ট শুরু করা যাবে।
          </p>
        )}

        <PaymentInit orderNo={orderNo} method={method} />

        <div className="mt-5 space-y-1.5 text-left text-[11px] leading-relaxed text-sand-100/40">
          <p>• টেস্ট মোডে কোনো আসল টাকা কাটা হবে না।</p>
          <p>• পেমেন্ট সম্পন্ন হলে অর্ডার স্বয়ংক্রিয়ভাবে আপডেট হবে।</p>
          <p>• সমস্যা হলে কল করুন: ০১৭০০-০০০০০০</p>
        </div>

        <Link href={`/track?order=${orderNo}`} className="mt-4 inline-block text-[12px] text-leaf-300 hover:underline">
          পরে ট্র্যাক করুন →
        </Link>
      </div>
    </div>
  );
}
