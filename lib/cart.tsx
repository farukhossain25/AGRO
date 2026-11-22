"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartKind = "product" | "combo";

export type CartLine = {
  id: string;
  kind: CartKind;
  slug: string;
  nameBn: string;
  nameEn: string;
  price: number;
  unit: string;
  image: string | null;
  quantity: number;
  stock: number;
};

type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, quantity: number) => void;
  clear: () => void;
  qtyOf: (id: string) => number;
  has: (id: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ba_cart_v1";

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.id === "string" && typeof l.price === "number")
      .map((l) => ({
        ...l,
        quantity: Math.max(1, Math.min(99, Number(l.quantity) || 1)),
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  // Keep tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((l) => l.id === line.id);
      if (existing) {
        return prev.map((l) =>
          l.id === line.id
            ? { ...l, quantity: Math.min(99, l.quantity + quantity) }
            : l
        );
      }
      return [...prev, { ...line, quantity: Math.min(99, Math.max(1, quantity)) }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const setQty = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, quantity: Math.min(99, quantity) } : l))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, l) => sum + l.quantity, 0);
    const subtotal = items.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return {
      items,
      count,
      subtotal,
      ready,
      add,
      remove,
      setQty,
      clear,
      qtyOf: (id: string) => items.find((l) => l.id === id)?.quantity ?? 0,
      has: (id: string) => items.some((l) => l.id === id),
    };
  }, [items, ready, add, remove, setQty, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
