"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart";
import { DeliveryProvider, type DeliveryConfig } from "@/lib/delivery-settings";
import { LocaleProvider } from "@/lib/locale";
import { ToastProvider } from "@/lib/toast";
import { PWAInstallPrompt } from "./pwa-install-prompt";

export function Providers({
  children,
  delivery,
}: {
  children: ReactNode;
  /** from `settings.delivery`, read server-side in the root layout */
  delivery?: DeliveryConfig | null;
}) {
  return (
    <DeliveryProvider value={delivery}>
    <LocaleProvider>
      <ToastProvider>
        <CartProvider>
          {children}
          <PWAInstallPrompt />
        </CartProvider>
      </ToastProvider>
    </LocaleProvider>
    </DeliveryProvider>
  );
}
