"use client";

import { createContext, useContext, type ReactNode } from "react";

/* ==========================================================================
   lib/delivery-settings.tsx — the delivery numbers, on the client
   --------------------------------------------------------------------------
   The cart, the drawer and the checkout all show "ফ্রি ডেলিভারি ৳1,200-এর পর"
   and estimate a charge before the order is submitted. Those three used to
   hard-code 1200 and 60/120, which meant /foisal/settings could change what the
   server charged while the customer was still being promised the old number.

   The values are read from `settings.delivery` on the server in the root
   layout and handed down here, so what the page promises and what
   `computeDelivery()` charges come from one row.
   ========================================================================== */

export type DeliveryConfig = {
  inside_dhaka: number;
  outside_dhaka: number;
  free_over: number;
};

export const defaultDeliveryConfig: DeliveryConfig = {
  inside_dhaka: 60,
  outside_dhaka: 120,
  free_over: 1200,
};

const DeliveryContext = createContext<DeliveryConfig>(defaultDeliveryConfig);

export function DeliveryProvider({
  value,
  children,
}: {
  value?: Partial<DeliveryConfig> | null;
  children: ReactNode;
}) {
  /* Merge over the defaults instead of replacing them: a settings row missing
     one field must not make that field `undefined` and render "৳undefined". */
  const merged: DeliveryConfig = { ...defaultDeliveryConfig, ...(value ?? {}) };
  return <DeliveryContext.Provider value={merged}>{children}</DeliveryContext.Provider>;
}

export function useDeliveryConfig(): DeliveryConfig {
  return useContext(DeliveryContext);
}
