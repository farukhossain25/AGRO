"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { money } from "@/lib/format";

/* ==========================================================================
   SearchBox — the header search, with live suggestions
   --------------------------------------------------------------------------
   Typing asks /api/search (debounced, one request per pause) and shows the six
   best matches with photo, price and unit. Enter always opens the full results
   page, so the menu is a shortcut and never a trap; ↑/↓ move through it, Esc
   closes it. Nothing is fetched for fewer than two characters.
   ========================================================================== */

type Suggestion = {
  slug: string;
  name_bn: string;
  name_en: string;
  price: number;
  unit: string;
  image: string | null;
  stock: number;
};

export function SearchBox({
  onSubmitted,
  autoFocus = false,
  className = "",
  initialValue = "",
}: {
  /** Called after a navigation (used to close the mobile search row). */
  onSubmitted?: () => void;
  autoFocus?: boolean;
  className?: string;
  initialValue?: string;
}) {
  const router = useRouter();
  const { t, isBn } = useLocale();
  const listId = useId();

  const [value, setValue] = useState(initialValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* focus on demand (the mobile row mounts only when opened) */
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* close when the pointer lands elsewhere */
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* debounced suggestion fetch */
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        setItems((json?.data?.items ?? []) as Suggestion[]);
      } catch {
        /* aborted or offline — keep whatever is on screen */
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  function go(term: string) {
    const q = term.trim();
    setOpen(false);
    setActive(-1);
    onSubmitted?.();
    inputRef.current?.blur();
    // `scroll: false` keeps the visitor where they are while results load.
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products", { scroll: false });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      if (!items.length) return;
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && active >= 0 && items[active]) {
        const item = items[active];
        setOpen(false);
        onSubmitted?.();
        router.push(`/products/${item.slug}`, { scroll: false });
        return;
      }
      go(value);
    }
  }

  const showMenu = open && value.trim().length >= 2;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
        role="search"
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neu-faint" />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={t("পণ্য খুঁজুন… (যেমন: আম, ইলিশ)", "Search products… (mango, fish)")}
            className="input !rounded-full !py-2.5 !pl-10 !pr-9 text-[16px] sm:text-[13px]"
            aria-label={t("পণ্য খুঁজুন", "Search products")}
            aria-controls={listId}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setItems([]);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-neu-faint transition hover:bg-white/70 hover:text-neu-ink"
              aria-label={t("মুছুন", "Clear")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </form>

      {showMenu ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] max-h-[62vh] overflow-y-auto overscroll-contain rounded-3xl border border-white/85 bg-neu-surface p-1.5 shadow-neu-lg animate-pop"
        >
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-neu-muted">
              {loading
                ? t("খোঁজা হচ্ছে…", "Searching…")
                : t("কিছু পাওয়া যায়নি — অন্য নামে চেষ্টা করুন।", "Nothing found — try another word.")}
            </p>
          ) : (
            <ul>
              {items.map((item, index) => (
                <li key={item.slug}>
                  <Link
                    href={`/products/${item.slug}`}
                    role="option"
                    aria-selected={index === active}
                    onClick={() => {
                      setOpen(false);
                      onSubmitted?.();
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={`flex items-center gap-2.5 rounded-xl px-2 py-2 transition ${
                      index === active ? "bg-neu-accent-soft/70" : "hover:bg-white/60"
                    }`}
                  >
                    <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-neu-sunken">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 object-cover"
                          unoptimized
                        />
                      ) : (
                        <Search className="h-3.5 w-3.5 text-sand-100/30" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-sand-100">
                        {isBn ? item.name_bn : item.name_en || item.name_bn}
                      </span>
                      <span className="block truncate text-[10.5px] text-sand-100/40">
                        {money(item.price)} / {item.unit}
                        {item.stock <= 0 ? ` · ${t("স্টকে নেই", "out of stock")}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => go(value)}
            className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border-t border-white/[0.07] px-3 py-2.5 text-[12px] font-semibold text-leaf-700 hover:bg-leaf-600/15"
          >
            <span className="truncate">
              “{value.trim()}” {t("এর সব ফলাফল", "matching products")}
            </span>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span aria-hidden>→</span>}
          </button>
        </div>
      ) : null}
    </div>
  );
}
