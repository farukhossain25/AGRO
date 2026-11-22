import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  FileDown,
  MessageSquareWarning,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getPaymentByNo, buildTimeline } from "@/lib/manual-payments";
import { formatDateTimeBn, money } from "@/lib/format";
import { PrintButton } from "@/components/admin/print-button";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "পেমেন্টের অবস্থা",
  robots: { index: false, follow: false },
};

/* ==========================================================================
   /payment/status/[paymentNo] — the customer's live view
   --------------------------------------------------------------------------
   Timeline: পেমেন্ট জমা হয়েছে → যাচাই চলছে → ভেরিফাইড (or বাতিঘোষিত).

   Access: the payment's owner, or staff. Anyone else gets a 404 rather than a
   403, so a guessed payment number does not confirm that it exists.

   The receipt is a print stylesheet away from a PDF — the browser's "Save as
   PDF" is the export, which avoids shipping a PDF library to every visitor.
   ========================================================================== */
export default async function PaymentStatusPage({
  params,
}: {
  params: Promise<{ paymentNo: string }>;
}) {
  const { paymentNo } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/payment/status/${paymentNo}`);

  const payment = await getPaymentByNo(paymentNo);
  if (!payment) notFound();

  const isOwner = payment.user_id === user.id;
  const isStaff = ["staff", "manager", "admin"].includes(user.role);
  if (!isOwner && !isStaff) notFound();

  const steps = buildTimeline(payment);

  /* Which order / plan this payment settles, for the receipt header. */
  const { data: order } = payment.order_id
    ? await db().from("orders").select("order_no, total, customer_name, phone, address, district").eq("id", payment.order_id).maybeSingle()
    : { data: null };

  const { data: subscription } = payment.subscription_id
    ? await db().from("premium_subscriptions").select("sub_no, plan_name_bn, amount, expires_at").eq("id", payment.subscription_id).maybeSingle()
    : { data: null };

  const verified = payment.status === "verified";
  const rejected = payment.status === "rejected";
  const needsInfo = payment.status === "needs_info";

  return (
    <div className="container-x max-w-2xl py-6 sm:py-10">
      <Link href="/account" className="no-print inline-flex items-center gap-1 text-[11.5px] text-sand-100/40 hover:text-leaf-200">
        <ArrowLeft className="h-3.5 w-3.5" /> আমার অর্ডার
      </Link>

      {/* ---- hero state ---- */}
      <div
        className={`mt-3 overflow-hidden rounded-2xl border p-5 text-center ${
          verified
            ? "border-leaf-500/40 bg-leaf-600/10"
            : rejected
              ? "border-red-500/40 bg-red-500/10"
              : needsInfo
                ? "border-sky-500/40 bg-sky-500/10"
                : "border-amber-500/35 bg-amber-500/10"
        }`}
      >
        <span
          className={`mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full ${
            verified
              ? "bg-leaf-600/25 text-leaf-200"
              : rejected
                ? "bg-red-500/20 text-red-300"
                : needsInfo
                  ? "bg-sky-500/20 text-sky-300"
                  : "bg-amber-500/20 text-amber-300"
          }`}
        >
          {verified ? (
            <CheckCircle2 className="h-7 w-7" />
          ) : rejected ? (
            <Ban className="h-7 w-7" />
          ) : needsInfo ? (
            <MessageSquareWarning className="h-7 w-7" />
          ) : (
            <Clock className="h-7 w-7" />
          )}
        </span>

        <h1 className="text-lg font-bold sm:text-xl">
          {verified
            ? "Payment Verified ✅"
            : rejected
              ? "পেমেন্ট বাতিল হয়েছে"
              : needsInfo
                ? "আরও তথ্য দরকার"
                : "যাচাই চলছে"}
        </h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-sand-100/60">
          {verified
            ? order
              ? "ধন্যবাদ! টাকা পাওয়া গেছে — এখন প্যাকিং শুরু হচ্ছে।"
              : "ধন্যবাদ! প্রিমিয়াম সক্রিয় হয়েছে।"
            : rejected
              ? payment.reject_reason ?? "TrxID মেলানো যায়নি। সঠিক তথ্য দিয়ে আবার জমা দিন।"
              : needsInfo
                ? "আমাদের টিম আরও তথ্য চাইছে — নিচে দেখুন।"
                : "সাধারণত ১৫ মিনিটের মধ্যে যাচাই শেষ হয় (কাজের সময়ে)।"}
        </p>

        {rejected || needsInfo ? (
          <Link
            href={
              order
                ? `/payment/manual?order=${order.order_no}&method=${payment.method_code}`
                : `/subscription`
            }
            className="btn-primary no-print mt-3 inline-flex"
          >
            আবার জমা দিন
          </Link>
        ) : null}
      </div>

      {/* ---- timeline ---- */}
      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          const done = step.done;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    done
                      ? step.key === "verified" && rejected
                        ? "bg-red-500/25 text-red-300"
                        : "bg-leaf-600/30 text-leaf-100"
                      : "bg-white/[0.07] text-sand-100/35"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                {!last ? <span className={`my-0.5 w-0.5 flex-1 ${done ? "bg-leaf-600/40" : "bg-white/10"}`} /> : null}
              </div>
              <div className={`pb-4 ${last ? "" : ""}`}>
                <p className={`text-[12.5px] font-semibold ${done ? "" : "text-sand-100/40"}`}>{step.labelBn}</p>
                {step.at ? (
                  <p className="text-[10.5px] text-sand-100/35">{formatDateTimeBn(step.at)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* ---- receipt ---- */}
      <div className="card mt-2 p-4 print:border-0 print:bg-white print:text-black" id="receipt">
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-bold">
              <Receipt className="h-4 w-4 text-leaf-300 print:hidden" /> রিসিট
            </p>
            <p className="mt-0.5 text-[10.5px] text-sand-100/40 print:text-gray-600">
              {site.nameBn} · {site.phoneDisplay}
            </p>
          </div>
          <span className="font-mono text-[11px] text-sand-100/50 print:text-gray-700">{payment.payment_no}</span>
        </div>

        <dl className="mt-3 space-y-1.5 text-[11.5px]">
          <Line label="মাধ্যম" value={payment.method_name_bn ?? payment.method_code} />
          <Line label="TrxID" value={payment.trx_id ?? "—"} mono />
          <Line label="প্রেরকের নম্বর" value={payment.sender_number ?? "—"} mono />
          <Line label="পরিমাণ" value={money(payment.amount)} />
          <Line label="প্রত্যাশিত" value={money(payment.expected_amount)} />
          <Line label="জমা দেওয়া" value={formatDateTimeBn(payment.created_at)} />
          {payment.reviewed_at ? <Line label="যাচাই" value={formatDateTimeBn(payment.reviewed_at)} /> : null}
          {order ? <Line label="অর্ডার" value={`#${order.order_no}`} /> : null}
          {subscription ? <Line label="প্ল্যান" value={subscription.plan_name_bn} /> : null}
          <Line
            label="অবস্থা"
            value={
              <span className={verified ? "font-semibold text-leaf-300 print:text-black" : ""}>
                {verified ? "ভেরিফাইড ✅" : rejected ? "বাতিল" : needsInfo ? "তথ্য দরকার" : "যাচাই চলছে"}
              </span>
            }
          />
        </dl>

        {verified ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-leaf-600/15 px-2.5 py-2 text-[10.5px] text-leaf-200 print:bg-gray-100 print:text-black">
            <ShieldCheck className="h-3.5 w-3.5" /> এই পেমেন্ট আমাদের টিম যাচাই করেছেন — {payment.reviewed_by ? "অনুমোদিত" : "ভেরিফাইড"}।
          </p>
        ) : null}
      </div>

      {verified ? (
        <div className="no-print mt-3 flex gap-2">
          <PrintButton label="রিসিট ডাউনলোড (PDF)" />
          {order ? (
            <Link href={`/track?order=${order.order_no}`} className="btn-ghost btn-sm">
              অর্ডার ট্র্যাক করুন
            </Link>
          ) : null}
        </div>
      ) : null}

      <p className="no-print mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-sand-100/30">
        <FileDown className="mt-0.5 h-3 w-3 shrink-0" />
        &ldquo;PDF হিসেবে সংরক্ষণ&rdquo; বেছে নিলে এই রিসিটটি ফাইল হিসেবে সেভ হবে (প্রিন্ট ডায়ালগে)।
      </p>
    </div>
  );
}

function Line({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-1.5 last:border-0 print:border-gray-200">
      <dt className="shrink-0 text-sand-100/40 print:text-gray-600">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
