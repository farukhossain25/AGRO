"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart";
import { LocaleProvider } from "@/lib/locale";
import { ToastProvider } from "@/lib/toast";
import { PWAInstallPrompt } from "./pwa-install-prompt";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <ToastProvider>
        <CartProvider>
          {children}
          <PWAInstallPrompt />
        </CartProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
