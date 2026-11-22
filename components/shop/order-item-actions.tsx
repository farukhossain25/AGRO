"use client";

import Link from "next/link";
import { useState } from "react";
import { ComplaintForm } from "@/components/shop/complaint-form";

/* ==========================================================================
   OrderItemActions — "রিভিউ দিন" + "সমস্যা জানান" for a delivered order
   --------------------------------------------------------------------------
   Rendered only when the order (or its sub-order) is delivered. Each line gets
   its own problem-report button; tapping it opens the complaint form inline.
   ========================================================================== */

export function OrderItemActions({
  orderId,
  items,
}: {
  orderId: string;
  items: { id: string; productId: string | null; nameBn: string }[];
}) {
  const [openFor, setOpenFor] = useState<{ productId: string; nameBn: string } | null>(null);
  const [reported, setReported] = useState<string[]>([]);

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/account/orders/${orderId}/review`}
          className="btn-primary btn-sm min-h-[44px]"
        >
          ⭐ রিভিউ দিন
        </Link>
        <Link href="/account/complaints" className="btn-ghost btn-sm min-h-[44px]">
          অভিযোগসমূহ
        </Link>
      </div>

      <p className="mt-2 text-[10.5px] text-sand-100/40">
        কোনো পণ্যে সমস্যা? নিচের পণ্যে চাপ দিয়ে জানান —
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items
          .filter((it) => it.productId)
          .map((it) => {
            const done = reported.includes(it.productId as string);
            return (
              <button
                key={it.id}
                type="button"
                disabled={done}
                onClick={() =>
                  setOpenFor({ productId: it.productId as string, nameBn: it.nameBn })
                }
                className={`badge h-9 px-2.5 text-[11px] transition ${
                  done
                    ? "bg-leaf-600/15 text-leaf-200"
                    : "bg-white/[0.05] text-sand-100/60 hover:bg-amber-500/15 hover:text-amber-200"
                }`}
              >
                {done ? "✓ " : "⚠ "}
                {it.nameBn}
              </button>
            );
          })}
      </div>

      {openFor ? (
        <div className="mt-2.5">
          <ComplaintForm
            orderId={orderId}
            productId={openFor.productId}
            productNameBn={openFor.nameBn}
            compact
            onDone={() => {
              // keep the form mounted so its "টিকিট তৈরি হয়েছে" panel stays visible
              setReported((prev) =>
                prev.includes(openFor.productId) ? prev : [...prev, openFor.productId]
              );
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
