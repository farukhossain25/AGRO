"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "bn" | "en";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
  isBn: boolean;
  /** pick a Bangla or English string */
  t: (bn: string, en?: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "ba_locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("bn");

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "bn") setLocaleState(stored);
      }
    } catch {
      /* storage unavailable — keep default bn */
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.lang = locale === "bn" ? "bn" : "en";
        document.documentElement.dataset.locale = locale;
        document.documentElement.dir = "ltr";
      }
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore private-mode failures */
    }
  }, []);

  const toggle = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === "bn" ? "en" : "bn";
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const t = useCallback(
    (bn: string, en?: string) => {
      if (!bn && !en) return "";
      if (!bn) return en ?? "";
      if (locale === "bn" || !en) return bn;
      return en;
    },
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggle,
      isBn: locale === "bn",
      t,
    }),
    [locale, setLocale, toggle, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Graceful fallback: never throw on the login page if provider is missing
    // (e.g. during static prerender or error boundary). Default to bn.
    const noop = () => {};
    return {
      locale: "bn" as Locale,
      setLocale: noop as unknown as (l: Locale) => void,
      toggle: noop as unknown as () => void,
      isBn: true,
      t: (bn: string, en?: string) => bn ?? en ?? "",
    };
  }
  return ctx;
}

/** Inline bilingual text: <T bn="পণ্য" en="Products" /> */
export function T({ bn, en }: { bn: string; en?: string }) {
  const { t } = useLocale();
  return <>{t(bn, en)}</>;
}
