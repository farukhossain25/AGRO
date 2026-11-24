import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Info,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getOrderByNo } from "@/lib/data";
import { getMethodByCode } from "@/lib/payment-methods";
import { money } from "@/lib/format";
import { PaymentInstructions } from "@/components/payment/payment-instructions";
import { PaymentSubmitForm } from "@/components/payment/payment-submit-form";
import { db } from "@/lib/db";

/* Private surface — keep it out of the index and out of snippets. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

const METHOD_EMOJI: Record<string, string> = {
  bkash: "🟢",
  nagad: "🟡",
  rocket: "🚀",
  upay: "💳",
  bank: "🏦",
  cod: "💵",
  sslcommerz: "🏦",
};

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ method: string }>;
  searchParams: Promise<{ order?: string; sub?: string }>;
}) {
  const { method: methodCode } = await params;
  const { order: orderNo, sub: subNo } = await searchParams;

  if (!orderNo && !subNo) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-2xl font-bold">অর্ডার নম্বর পাওয়া যায়নি</h1>
        <Link href="/products" className="btn-primary mt-5">পণ্য দেখুন</Link>
      </div>
    );
  }

  // Resolve the method from the admin-managed list. Any active method code
  // works — the owner can add bKash, Nagad, Rocket, Upay, a bank account…
  const method = await getMethodByCode(methodCode).catch(() => null);
  if (!method) notFound();

  // The amount is always resolved server-side — never read from the URL, so a
  // tampered link cannot change what the customer pays.
  const order = orderNo ? await getOrderByNo(orderNo).catch(() => null) : null;
  const sub = subNo ? await getSubscription(subNo).catch(() => null) : null;

  const target = order ?? sub;
  const isCod = method.kind === "cod";
  const alreadyPaid =
    order?.payment_status === "paid" || sub?.status === "active";

  const amount = order ? Number(order.total) : sub ? Number(sub.amount) : null;
  const refLabel = order ? `#${order.order_no}` : sub ? sub.sub_no : "";
  const trackHref = order ? `/track?order=${order.order_no}` : "/account";

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        {/* ── header ────────────────────────────────────────────────────── */}
        <div className="mb-5 flex items-center justify-between">
          <Link href={trackHref} className="inline-flex items-center gap-1 text-[11.5px] text-sand-100/40 hover:text-leaf-200">
            <ArrowLeft className="h-3.5 w-3.5" /> ফিরে যান
          </Link>
          <span className="text-[11px] uppercase tracking-wider text-sand-100/35">
            পেমেন্ট · {refLabel}
          </span>
        </div>

        {/* ── success state (already paid / COD) ────────────────────────── */}
        {alreadyPaid || isCod ? (
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-leaf-600/25 to-leaf-700/10 px-6 py-8 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-500/20">
                <CheckCircle2 className="h-8 w-8 text-leaf-300" />
              </span>
              <h1 className="mt-4 text-xl font-bold">
                {isCod
                  ? "ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন"
                  : "পেমেন্ট পরিশোধিত হিসেবে নথিভুক্ত"}
              </h1>
              <p className="mt-1.5 text-[13px] text-sand-100/55">
                {isCod
                  ? "পণ্য ডেলিভারির সময় ডেলিভারি ম্যানকে ঠিক পরিমাণ টাকা দিন।"
                  : "আপনার অর্ডারটি পরিশোধিত হিসেবে চিহ্নিত হয়েছে। ধন্যবাদ!"}
              </p>
            </div>
            <div className="p-5">
              {target ? (
                <>
                  <SummaryRow label="রেফারেন্স" value={refLabel} mono />
                  <SummaryRow label="পেমেন্ট মাধ্যম" value={method.name_bn} />
                  {amount != null ? (
                    <SummaryRow label="পরিশোধিত পরিমাণ" value={money(amount, true)} accent />
                  ) : null}
                </>
              ) : null}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link href={trackHref} className="btn-primary flex-1">
                  <BadgeCheck className="h-4 w-4" /> {order ? "অর্ডার ট্র্যাক করুন" : "অ্যাকাউন্ট দেখুন"}
                </Link>
                <Link href="/products" className="btn-ghost flex-1">প্রয়োজন হলে আরও দেখুন</Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── method hero ─────────────────────────────────────────────── */}
            <div className="card mb-4 overflow-hidden">
              <div className="flex items-center gap-4 bg-gradient-to-r from-neu-sunken to-neu-line/60 px-6 py-5">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/10 text-2xl">
                  {method.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={method.logo_url} alt={method.name_bn} className="h-full w-full object-contain" />
                  ) : (
                    <span aria-hidden>{METHOD_EMOJI[method.code] ?? "💳"}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <h1 className="text-[18px] font-bold sm:text-xl">{method.name_bn}</h1>
                  {method.name_en ? <p className="text-[12px] text-sand-100/45">{method.name_en}</p> : null}
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-leaf-300/80">
                    <Wallet className="h-3 w-3" /> টাকা পাঠানোর নির্দেশনা নিচে দেওয়া হয়েছে
                  </p>
                </div>
              </div>

              {/* amount */}
              <div className="px-6 py-4">
                <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">
                  পরিশোধযোগ্য পরিমাণ
                </p>
                <p className="mt-0.5 text-[30px] font-bold leading-tight text-leaf-200">
                  {amount != null ? money(amount, true) : "—"}
                </p>
                {target ? (
                  <p className="mt-1 text-[11.5px] text-sand-100/40">
                    {order ? `অর্ডার #${order.order_no}` : `সাবস্ক্রিপশন ${sub!.sub_no}`}
                  </p>
                ) : (
                  <p className="mt-1 text-[11.5px] text-amber-200/80">
                    অর্ডারের বিস্তারিত পাওয়া যায়নি — নিচের নম্বরে টাকা পাঠানো যাবে
                  </p>
                )}
              </div>

              {/* receiving number */}
              {method.kind !== "cod" && method.account_number ? (
                <div className="border-t border-white/[0.06] px-6 py-4">
                  <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">
                    টাকা পাঠানোর নম্বর
                  </p>
                  <PaymentInstructions method={method} />
                </div>
              ) : null}

              {/* instructions */}
              {method.instruction_bn ? (
                <div className="border-t border-white/[0.06] px-6 py-4">
                  <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">
                    কীভাবে পেমেন্ট করবেন
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {method.instruction_bn
                      .split(/(?:\n|；|;)\s*/)
                      .filter((s) => s.trim())
                      .map((line, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-sand-100/70">
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-leaf-600/20 text-[10px] font-bold text-leaf-700">
                            {i + 1}
                          </span>
                          <span className="whitespace-pre-wrap">{line.replace(/^\d+[.、]\s*/, "")}</span>
                        </li>
                      ))}
                  </ol>
                </div>
              ) : null}
            </div>

            {/* ── TrxID submission (non-COD methods only) ─────────────────── */}
            {method.kind !== "cod" ? (
              <PaymentSubmitForm
                orderNo={orderNo ?? undefined}
                subNo={subNo ?? undefined}
                amount={amount}
                methodName={method.name_bn}
                requiresTrx={method.requires_trx}
                requiresSender={method.requires_sender}
                phone={order?.phone ?? undefined}
              />
            ) : null}

            {/* ── reassurance + actions ───────────────────────────────────── */}
            <div className="card p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-400" />
                <div className="text-[12px] leading-relaxed text-sand-100/55">
                  <p>টাকা পাঠানোর পর আমাদের অ্যাডমিন অর্ডারটি যাচাই করে পরিশোধিত হিসেবে চিহ্নিত করবেন।</p>
                  <p className="mt-1 text-sand-100/40">
                    ট্র্যান্সফার শেষ হলে অপেক্ষা করুন — আমরা কিছুক্ষণের মধ্যে অর্ডার আপডেট করব।
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Link href={trackHref} className="btn-secondary w-full">
                  <Info className="h-4 w-4" /> {order ? "অর্ডার স্টেটাস দেখুন" : "অ্যাকাউন্ট দেখুন"}
                </Link>
                <Link href="/products" className="btn-ghost w-full">প্রোডাক্টে ফিরে যান</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

async function getSubscription(subNo: string) {
  const { data, error } = await db()
    .from("user_subscriptions")
    .select("sub_no, amount, status, plan_name_bn, user_id, payment_method")
    .eq("sub_no", subNo.toUpperCase())
    .maybeSingle();
  if (error) return null;
  return data;
}

function SummaryRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <dt className="text-[12px] text-sand-100/50">{label}</dt>
      <dd
        className={`text-[13px] font-semibold ${
          accent ? "text-leaf-200" : mono ? "font-mono" : "text-sand-100/85"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
