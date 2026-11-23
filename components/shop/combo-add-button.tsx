"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale";
import { useToast } from "@/lib/toast";

/**
 * Adds a combo to the cart. The cart line is hydrated from the API route so the
 * server remains the source of truth for pricing.
 */
export function ComboAddButton({
  comboId: _comboId,
  comboSlug,
  label,
  className = "btn-primary btn-sm",
}: {
  comboId: string;
  comboSlug: string;
  label?: string;
  className?: string;
}) {
  const cart = useCart();
  const toast = useToast();
  const { t } = useLocale();
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    // Optimistically resolve from the combos API (cached by the route handler)
    try {
      const res = await fetch(`/api/combos/${comboSlug}`);
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.message || "কম্বো পাওয়া যায়নি");
      const combo = json.data;

      cart.add(
        {
          id: combo.id,
          kind: "combo",
          slug: combo.slug,
          nameBn: combo.name_bn,
          nameEn: combo.name_en ?? combo.name_bn,
          price: Number(combo.price),
          unit: t("বক্স", "box"),
          image: combo.image,
          stock: 99,
        },
        1
      );
      setAdded(true);
      toast.success(t("কম্বো কার্টে যোগ হয়েছে", "Combo added to cart"), combo.name_bn);
      window.setTimeout(() => setAdded(false), 1200);
    } catch (err) {
      toast.error(t("যোগ করা যায়নি", "Could not add"), (err as Error).message);
    }
  }

  return (
    <button onClick={handleAdd} className={className} aria-label={label ?? "যোগ করুন"}>
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {label ?? t("যোগ করুন", "Add")}
    </button>
  );
}
