import Link from "next/link";
import { CheckCircle2, Package, Phone, Truck } from "lucide-react";
import { getOrderByNo } from "@/lib/data";
import { formatDateBn, money } from "@/lib/format";
import { orderStatusSteps, site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; paid?: string }>;
}) {
  const { order: orderNo } = await searchParams;
  const order = orderNo ? await getOrderByNo(orderNo).catch(() => null) : null;

  return (
    <div className="container-x py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-600/20">
            <CheckCircle2 className="h-8 w-8 text-leaf-300" />
          </span>
          <h1 className="mt-5 text-[26px] font-bold sm:text-3xl">অর্ডার সফলভাবে গ্রহণ করা হয়েছে!</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-sand-100/60">
            ধন্যবাদ! আমাদের টিম কিছুক্ষণের মধ্যে কল করে অর্ডার নিশ্চিত করবে।
            {order ? " নিচে আপনার অর্ডারের বিস্তারিত দেখুন।" : ""}
          </p>
        </div>

        {order ? (
          <div className="card mt-7 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">অর্ডার নম্বর</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-leaf-200">{order.order_no}</p>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">তারিখ</p>
                <p className="mt-0.5 text-[13px] font-medium">{formatDateBn(order.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] uppercase tracking-wider text-sand-100/40">মোট</p>
                <p className="mt-0.5 text-lg font-bold text-leaf-200">{money(Number(order.total), true)}</p>
              </div>
            </div>

            {/* status timeline */}
            <div className="mt-5">
              <p className="mb-3 text-[12px] font-semibold text-sand-100/60">অর্ডার স্টেটাস</p>
              <ol className="flex items-start justify-between gap-1">
                {orderStatusSteps.map((s, i) => {
                  const currentIndex = orderStatusSteps.findIndex((x) => x.key === order.status);
                  const active = i <= (currentIndex === -1 ? 0 : currentIndex);
                  return (
                    <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
                      {i < orderStatusSteps.length - 1 ? (
                        <span
                          className={`absolute left-1/2 top-3.5 h-0.5 w-full ${
                            i < currentIndex ? "bg-leaf-500" : "bg-white/10"
                          }`}
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-[11px] ${
                          active ? "bg-leaf-500 text-ink-900" : "bg-ink-700 text-sand-100/40"
                        }`}
                      >
                        {s.icon}
                      </span>
                      <span className={`mt-1.5 text-[10px] leading-tight ${active ? "text-leaf-200" : "text-sand-100/40"}`}>
                        {s.bn}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* items */}
            {order.order_items?.length ? (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="mb-2.5 text-[12px] font-semibold text-sand-100/60">
                  পণ্য ({order.order_items.length})
                </p>
                <ul className="space-y-1.5">
                  {order.order_items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 truncate text-sand-100/75">
                        {it.name_bn} <span className="text-sand-100/40">× {it.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium">{money(Number(it.price) * it.quantity, true)}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 text-[12.5px]">
                  <div className="flex justify-between">
                    <dt className="text-sand-100/50">সাবটোটাল</dt>
                    <dd>{money(Number(order.subtotal), true)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sand-100/50">ডেলিভারি</dt>
                    <dd>{Number(order.delivery_charge) === 0 ? "ফ্রি" : money(Number(order.delivery_charge), true)}</dd>
                  </div>
                  {Number(order.discount) > 0 ? (
                    <div className="flex justify-between text-leaf-300">
                      <dt>ছাড়</dt>
                      <dd>−{money(Number(order.discount), true)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-1 text-[14px] font-bold">
                    <dt>সর্বমোট</dt>
                    <dd className="text-leaf-200">{money(Number(order.total), true)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="mt-5 grid gap-2 border-t border-white/[0.06] pt-4 text-[12px] text-sand-100/60 sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-400" />
                {order.customer_name} · {order.phone}
              </p>
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-400" />
                {order.address}, {order.upazila}, {order.district}
              </p>
            </div>
          </div>
        ) : (
          <div className="card mt-7 p-6 text-center text-[13px] text-sand-100/55">
            অর্ডার নম্বরটি খুঁজে পাওয়া যায়নি।{" "}
            <Link href="/track" className="text-leaf-300 hover:underline">ট্র্যাকিং পেজে</Link> অর্ডার নম্বর দিয়ে খুঁজুন।
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {order ? (
            <Link href={`/track?order=${order.order_no}`} className="btn-primary">
              <Truck className="h-4 w-4" /> অর্ডার ট্র্যাক করুন
            </Link>
          ) : null}
          <Link href="/products" className="btn-ghost">আরও কিনুন</Link>
          <a href={`tel:${site.phone}`} className="btn-ghost">
            <Phone className="h-4 w-4" /> কল করুন
          </a>
        </div>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-sand-100/40">
          অর্ডার সংক্রান্ত কোনো প্রশ্ন থাকলে {site.phoneDisplay} নম্বরে কল করুন
          ({site.hoursBn})।
        </p>
      </div>
    </div>
  );
}
