"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import { useCart } from "@/lib/cart";
import { money, toBn } from "@/lib/format";

type BuilderProduct = {
  id: string;
  name_bn: string;
  unit: string;
  price: number;
  image: string | null;
  stock: number;
  category_id: string | null;
};

type Priced = {
  total: number;
  subtotal: number;
  bundle_discount: number;
  bundle_percent: number;
  item_count: number;
};

/* ==========================================================================
   ComboBuilder — pick products, see live discount, add the bundle to cart
   --------------------------------------------------------------------------
   The 5% / 8% tier is previewed locally for instant feedback, then the server
   re-prices on POST /api/combos/custom so the client can never set the price.
   ========================================================================== */

export function ComboBuilder({
  products,
  categories,
}: {
  products: BuilderProduct[];
  categories: { id: string; name_bn: string }[];
}) {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const cart = useCart();

  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [repeat, setRepeat] = useState<"none" | "weekly" | "monthly">("none");
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (term && !p.name_bn.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, activeCat, search]);

  const lines = useMemo(
    () =>
      Object.entries(picked)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === id);
          return p ? { product: p, qty } : null;
        })
        .filter(Boolean) as { product: BuilderProduct; qty: number }[],
    [picked, products]
  );

  const priced: Priced = useMemo(() => {
    const subtotal = lines.reduce((n, l) => n + l.product.price * l.qty, 0);
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const pct = count >= 7 ? 8 : count >= 4 ? 5 : 0;
    const discount = Math.min(300, Math.round(subtotal * (pct / 100) * 100) / 100);
    return {
      subtotal,
      bundle_discount: discount,
      bundle_percent: pct,
      total: Math.round((subtotal - discount) * 100) / 100,
      item_count: count,
    };
  }, [lines]);

  const add = (p: BuilderProduct) =>
    setPicked((prev) => {
      const next = (prev[p.id] ?? 0) + 1;
      if (next > Math.min(p.stock, 50)) return prev;
      return { ...prev, [p.id]: next };
    });

  const sub = (p: BuilderProduct) =>
    setPicked((prev) => {
      const next = (prev[p.id] ?? 0) - 1;
      const copy = { ...prev };
      if (next <= 0) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });

  const clear = () => setPicked({});

  /** Everything goes into the normal cart, so checkout/coupons keep working. */
  const addToCart = () => {
    if (lines.length < 2) {
      errorToast("কম্বো বানাতে কমপক্ষে ২টি পণ্য বাছুন");
      return;
    }
    for (const line of lines) {
      cart.add(
        {
          id: line.product.id,
          kind: "product",
          slug: line.product.id,
          nameBn: line.product.name_bn,
          nameEn: line.product.name_bn,
          unit: line.product.unit,
          price: line.product.price,
          image: line.product.image,
          stock: line.product.stock,
        },
        line.qty
      );
    }
    success("কম্বো কার্টে যোগ হয়েছে", `${lines.length}টি পণ্য · ${money(priced.total, true)}`);
    router.push("/cart");
  };

  const saveCombo = async () => {
    if (lines.length < 2) {
      errorToast("কম্বো বানাতে কমপক্ষে ২টি পণ্য বাছুন");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/combos/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name_bn: "আমার কম্বো",
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          repeat_interval: repeat,
          save: true,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        errorToast("সেভ হয়নি", json?.message);
        return;
      }

      success("কম্বো সেভ হয়েছে", "অ্যাকাউন্ট থেকে যেকোনো সময় আবার অর্ডার করুন");
      router.push("/account/combos");
    } catch {
      errorToast("নেটওয়ার্ক সমস্যা");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* ---------------------------------------------------------- picker */}
      <div>
        <div className="mb-3 space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্য খুঁজুন…"
            className="input"
            aria-label="পণ্য খুঁজুন"
          />
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setActiveCat("all")}
              className={`chip shrink-0 whitespace-nowrap ${activeCat === "all" ? "chip-active" : ""}`}
            >
              সব
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={`chip shrink-0 whitespace-nowrap ${activeCat === c.id ? "chip-active" : ""}`}
              >
                {c.name_bn}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((p) => {
            const qty = picked[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className={`relative rounded-xl border p-2 transition ${
                  qty > 0 ? "border-mint/50 bg-mint/8" : "border-white/8 bg-white/[0.02]"
                }`}
              >
                <div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-ink-800">
                  {p.image ? (
                    <Image src={p.image} alt="" fill sizes="120px" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xl">🥬</div>
                  )}
                </div>
                <p className="line-clamp-2 min-h-[30px] text-[11.5px] leading-tight text-neu-ink/90">{p.name_bn}</p>
                <p className="mt-1 text-[11px] text-mint">
                  {money(p.price, true)}
                  <span className="text-sand-100/35">/{p.unit}</span>
                </p>

                {qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => add(p)}
                    className="mt-1.5 w-full rounded-lg bg-leaf-600/90 py-1 text-[11px] font-semibold text-white transition hover:bg-leaf-500"
                  >
                    + যোগ করুন
                  </button>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between rounded-lg bg-mint/15 p-0.5">
                    <button type="button" onClick={() => sub(p)} className="p-1 text-mint" aria-label="কমান">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-[12px] font-bold text-mint">{toBn(qty)}</span>
                    <button type="button" onClick={() => add(p)} className="p-1 text-mint" aria-label="বাড়ান">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="py-8 text-center text-[12.5px] text-sand-100/40">কোনো পণ্য পাওয়া যায়নি</p>
        )}
      </div>

      {/* ------------------------------------------------------- basket */}
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold text-neu-ink">
              <ShoppingBag className="h-3.5 w-3.5 text-mint" /> আপনার কম্বো
            </h2>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 text-[10.5px] text-sand-100/40 hover:text-red-300"
              >
                <Trash2 className="h-3 w-3" /> খালি করুন
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-sand-100/40">
              বাঁ দিক থেকে পণ্য বেছে নিন
              <br />
              <span className="text-[10.5px] text-sand-100/25">২টি থেকে কম্বো শুরু</span>
            </p>
          ) : (
            <>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {lines.map((l) => (
                  <li key={l.product.id} className="flex items-center gap-2 text-[11.5px]">
                    <span className="min-w-0 flex-1 truncate text-sand-100/70">
                      {l.product.name_bn} × {toBn(l.qty)}
                    </span>
                    <span className="text-mint">{money(l.product.price * l.qty, true)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 space-y-1.5 border-t border-white/8 pt-3 text-[11.5px]">
                <div className="flex justify-between text-sand-100/55">
                  <span>সাবটোটাল</span>
                  <span>{money(priced.subtotal, true)}</span>
                </div>
                {priced.bundle_discount > 0 && (
                  <div className="flex justify-between text-mint">
                    <span>বান্ডল ছাড় ({priced.bundle_percent}%)</span>
                    <span>−{money(priced.bundle_discount, true)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/8 pt-1.5 text-[13px] font-bold text-neu-ink">
                  <span>মোট</span>
                  <span>{money(priced.total, true)}</span>
                </div>
              </div>

              {priced.bundle_percent < 8 && (
                <p className="mt-2 rounded-lg bg-leaf-900/30 px-2 py-1.5 text-[10.5px] text-leaf-200/80">
                  {priced.bundle_percent === 0
                    ? `${toBn(4 - priced.item_count)}টি পণ্য আরও যোগ করলে ৫% ছাড়`
                    : `${toBn(7 - priced.item_count)}টি আরও যোগ করলে ৮% ছাড়`}
                </p>
              )}
            </>
          )}

          <div className="mt-3">
            <label className="label text-[11px]" htmlFor="repeat">
              রিপিট অর্ডার
            </label>
            <select
              id="repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as typeof repeat)}
              className="input py-2 text-[12px]"
            >
              <option value="none">একবারই</option>
              <option value="weekly">প্রতি সপ্তাহে</option>
              <option value="monthly">প্রতি মাসে</option>
            </select>
          </div>

          <button
            type="button"
            onClick={addToCart}
            disabled={lines.length < 2}
            className="btn-primary mt-3 w-full"
          >
            কার্টে যোগ করুন
          </button>
          <button
            type="button"
            onClick={saveCombo}
            disabled={lines.length < 2 || saving}
            className="btn-ghost btn-sm mt-2 w-full"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "সেভ হচ্ছে…" : "পরে অর্ডারের জন্য সেভ করুন"}
          </button>
          <p className="mt-2 text-center text-[10px] text-sand-100/30">
            <Link href="/account/combos" className="hover:text-mint">
              আমার সেভ করা কম্বো
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
