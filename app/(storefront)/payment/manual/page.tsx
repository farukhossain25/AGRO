import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { currentUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getActiveMethods, resolveTarget } from "@/lib/manual-payments";
import { ManualPaymentForm } from "@/components/payments/manual-payment-form";
import type { PublicPaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "পেমেন্ট পাঠান",
  robots: { index: false, follow: false },
};

/**
 * /payment/manual?order=BA-…&method=bkash
 * /payment/manual?sub=PS-…
 *
 * Both the order total and the customer's identity are resolved on the server.
 * The page never accepts an amount from the URL — a query string is not a
 * price.
 */
export default async function ManualPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; sub?: string; method?: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();

  if (!user) {
    const next = `/payment/manual?${new URLSearchParams(
      Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][]
    ).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!params.order && !params.sub) {
    return (
      <div className="container-x py-16 text-center">
        <p className="text-[14px] font-semibold">কোনো অর্ডার বা প্ল্যান বাছাই করা হয়নি</p>
        <Link href="/products" className="btn-primary mt-4 inline-flex">
          পণ্য দেখুন
        </Link>
      </div>
    );
  }

  const target = await resolveTarget({ userId: user.id, orderNo: params.order, subNo: params.sub });

  if (!target.ok) {
    return (
      <div className="container-x py-16">
        <div className="card mx-auto max-w-md p-6 text-center">
          <p className="text-[14px] font-semibold">{target.message}</p>
          <Link href="/account" className="btn-ghost mt-4 inline-flex">
            <ArrowLeft className="h-4 w-4" /> অ্যাকাউন্টে ফিরুন
          </Link>
        </div>
      </div>
    );
  }

  if (target.alreadyPaid) {
    return (
      <div className="container-x py-16">
        <div className="card mx-auto max-w-md p-6 text-center">
          <BadgeCheck className="mx-auto mb-2 h-8 w-8 text-leaf-400" />
          <p className="text-[14px] font-semibold">এই অর্ডারের পেমেন্ট আগেই সম্পন্ন হয়েছে</p>
          {target.order ? (
            <Link href={`/track?order=${target.order.order_no}`} className="btn-primary mt-4 inline-flex">
              অর্ডার ট্র্যাক করুন
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  let methods: PublicPaymentMethod[] = [];
  try {
    methods = (await getActiveMethods())
      .filter((row) => row.kind !== "cod")
      .map((row) => ({
        id: row.id,
        code: row.code,
        name_bn: row.name_bn,
        name_en: row.name_en,
        kind: row.kind,
        logo_url: row.logo_url,
        account_type: row.account_type,
        account_number: row.account_number,
        account_name: row.account_name,
        bank_name: row.bank_name,
        branch_name: row.branch_name,
        instruction_bn: row.instruction_bn,
        min_amount: Number(row.min_amount),
        max_amount: row.max_amount == null ? null : Number(row.max_amount),
        requires_trx: row.requires_trx,
        requires_sender: row.requires_sender,
      }));
  } catch {
    methods = [];
  }

  /* The customer's own phone is the best guess for the sender number. */
  const { data: profile } = await db()
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="container-x py-6 sm:py-9">
      <div className="mx-auto mb-4 max-w-lg">
        <Link href="/account" className="inline-flex items-center gap-1 text-[11.5px] text-sand-100/40 hover:text-leaf-200">
          <ArrowLeft className="h-3.5 w-3.5" /> ফিরে যান
        </Link>
        <h1 className="mt-2 text-[22px] font-bold sm:text-2xl">পেমেন্ট</h1>
        <p className="mt-0.5 text-[12px] text-sand-100/50">
          {target.order ? `অর্ডার #${target.order.order_no}` : `সাবস্ক্রিপশন ${target.subscription?.sub_no ?? ""}`}
          {" · "}
          মোট {new Intl.NumberFormat("bn-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(target.expected)}
        </p>
      </div>

      <ManualPaymentForm
        methods={methods}
        expected={target.expected}
        orderNo={target.order?.order_no}
        subNo={target.subscription?.sub_no}
        initialMethod={params.method}
        customer={{
          name: target.order?.customer_name ?? user.name ?? "গ্রাহক",
          phone: profile?.phone ?? target.order?.phone ?? user.phone ?? "",
        }}
      />
    </div>
  );
}
