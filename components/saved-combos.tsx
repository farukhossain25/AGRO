"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import { useCart } from "@/lib/cart";
import { money, toBn } from "@/lib/format";

type SavedCombo = {
  id: string;
  name_bn: string;
  item_count: number;
  price_cached: number;
  repeat_interval: string;
  created_at: string;
  items: Array<{
    productId: string;
    name_bn: string;
    unit: string;
    price: number;
    qty: number;
    image?: string | null;
  }>;
};

const REPEAT_BN: Record<string, string> = {
  none: "একবার",
  weekly: "সাপ্তাহিক",
  monthly: "মাসিক",
};

export function SavedCombos({ initial }: { initial: SavedCombo[] }) {
  const router = useRouter();
  const cart = useCart();
  const { success, error: errorToast } = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const reorder = (combo: SavedCombo) => {
    for (const item of combo.items) {
      cart.add(
        {
          id: item.productId,
          kind: "product",
          slug: item.productId,
          nameBn: item.name_bn,
          nameEn: item.name_bn,
          price: item.price,
          unit: item.unit,
          image: item.image ?? null,
          stock: 99,
        },
        item.qty
      );
    }
    success("কার্টে যোগ হয়েছে", `${combo.items.length}টি পণ্য`);
    router.push("/cart");
  };

  const remove = async (combo: SavedCombo) => {
    if (!confirm(`"${combo.name_bn}" মুছে ফেলবেন?`)) return;
    setBusy(combo.id);
    try {
      const res = await fetch("/api/combos/custom", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: combo.id }),
      });
      if (!res.ok) {
        errorToast("মুছা যায়নি");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== combo.id));
      success("কম্বো মুছে ফেলা হয়েছে");
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="card border-dashed p-10 text-center">
        <ShoppingBag className="mx-auto h-7 w-7 text-sand-100/25" />
        <p className="mt-3 text-[13px] text-sand-100/60">এখনো কোনো কম্বো সেভ করা হয়নি</p>
        <Link href="/combos/build" className="btn-mint btn-sm mt-4">
          কম্বো বানান
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((combo) => (
        <li key={combo.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-neu-ink">{combo.name_bn}</p>
              <p className="mt-0.5 text-[11.5px] text-sand-100/45">
                {toBn(combo.item_count)}টি পণ্য · {money(combo.price_cached, true)} ·{" "}
                {REPEAT_BN[combo.repeat_interval] ?? "একবার"}
              </p>
              <p className="mt-1 line-clamp-1 text-[11px] text-sand-100/35">
                {combo.items.map((i) => i.name_bn).join(", ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => reorder(combo)}
                className="btn-primary btn-sm"
                title="আবার অর্ডার করুন"
              >
                <RefreshCw className="h-3.5 w-3.5" /> অর্ডার
              </button>
              <button
                type="button"
                onClick={() => remove(combo)}
                disabled={busy === combo.id}
                className="rounded-lg p-2 text-red-300/70 hover:bg-red-500/10 disabled:opacity-40"
                aria-label="মুছুন"
              >
                {busy === combo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
