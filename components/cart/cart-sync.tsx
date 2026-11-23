"use client";

import { useEffect, useRef } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useCart, type CartLine } from "@/lib/cart";

/* ==========================================================================
   CartSync — makes the cart survive a device change
   --------------------------------------------------------------------------
   The cart itself lives in localStorage (one store, shared by the header badge,
   /cart and /checkout, hydrated without an SSR mismatch). For a signed-in
   customer we also mirror it into `cart_items` (RLS: user_id = auth.uid()):

     • on login   : DB rows are merged into the local cart (union of both, the
                    larger quantity wins) so a cart built on the phone is there
                    on the laptop, and the merged cart is written back
     • on change  : the whole set is replaced — 2–15 rows, so a delete+insert
                    is cheaper and safer than diffing
     • on logout  : nothing is deleted; the guest keeps their local cart

   Any failure is logged (never silent) but must not break shopping: the local
   cart is the source of truth for the current device.
   ========================================================================== */

type CartRow = { item_id: string; kind: string; slug: string | null; quantity: number };

export function CartSync() {
  const { user } = useAuth();
  const cart = useCart();
  const mergedFor = useRef<string | null>(null);
  const skipWrite = useRef(false);

  /* ------------------------------------------------- merge on login ------ */
  useEffect(() => {
    if (!supabaseConfigured || !user?.id || !cart.ready) return;
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;

    let alive = true;
    void (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("cart_items")
          .select("item_id, kind, slug, quantity")
          .eq("user_id", user.id);
        if (error) throw error;

        const rows = (data ?? []) as CartRow[];
        const byId = new Map<string, CartLine>(cart.items.map((line) => [line.id, line]));
        let added = 0;

        for (const row of rows) {
          const existing = byId.get(row.item_id);
          if (existing) {
            existing.quantity = Math.max(existing.quantity, row.quantity);
            continue;
          }
          // A row whose product no longer exists locally keeps its id; the cart
          // page re-validates it and shows the reason if it is gone.
          added += 1;
          byId.set(row.item_id, {
            id: row.item_id,
            kind: row.kind === "combo" ? "combo" : "product",
            slug: row.slug ?? "",
            nameBn: "সেভ করা পণ্য",
            nameEn: "Saved item",
            price: 0,
            unit: "",
            image: null,
            quantity: Math.max(1, Math.min(99, row.quantity)),
            stock: 99,
          });
        }

        if (!alive) return;
        if (added > 0 || rows.length > 0) {
          skipWrite.current = true;
          cart.replaceAll(Array.from(byId.values()));
        }
      } catch (err) {
        console.warn("[cart] DB merge failed, staying with the local cart:", err);
      }
    })();

    return () => {
      alive = false;
    };
    // cart.replaceAll and cart.items are intentionally excluded: this runs once
    // per signed-in user, not on every quantity tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cart.ready]);

  /* ------------------------------------------------ mirror on change ----- */
  useEffect(() => {
    if (!supabaseConfigured || !user?.id || !cart.ready) return;
    if (skipWrite.current) {
      // The change came from the merge itself; write it back on the next tick.
      skipWrite.current = false;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          const del = await supabase.from("cart_items").delete().eq("user_id", user.id);
          if (del.error) throw del.error;
          if (cart.items.length === 0) return;

          const rows = cart.items
            .filter((line) => /^[0-9a-f-]{36}$/i.test(line.id))
            .map((line) => ({
              user_id: user.id,
              item_id: line.id,
              kind: line.kind,
              slug: line.slug || null,
              quantity: Math.max(1, Math.min(99, line.quantity)),
            }));
          if (!rows.length) return;

          const ins = await supabase.from("cart_items").insert(rows);
          if (ins.error) throw ins.error;
        } catch (err) {
          console.warn("[cart] DB mirror failed:", err);
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
  }, [user?.id, cart.items, cart.ready]);

  return null;
}
