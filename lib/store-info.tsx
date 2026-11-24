"use client";

import { createContext, useContext, type ReactNode } from "react";
import { site } from "@/lib/site";
import { defaultStoreSettings, prettyPhoneBn, type StoreSettings } from "@/lib/store-info-model";

/* ==========================================================================
   lib/store-info.tsx — the storefront's contact block, from the admin panel
   --------------------------------------------------------------------------
   `getStoreSettings()` reads Supabase, so it can only run on the server. The
   header, footer, mobile drawer and floating buttons are client components,
   and they are exactly where customers read the phone number, the address and
   the opening hours. The storefront layout reads the row once and hands it
   down here; every client component then calls `useStoreInfo()`.

   Falls back to the same defaults as the server reader, so a component that
   renders outside the storefront layout (a preview, an error page) still shows
   a number instead of an empty string.
   ========================================================================== */

const StoreInfoContext = createContext<StoreSettings | null>(null);

export function StoreInfoProvider({
  value,
  children,
}: {
  value: StoreSettings | null | undefined;
  children: ReactNode;
}) {
  return <StoreInfoContext.Provider value={value ?? null}>{children}</StoreInfoContext.Provider>;
}

/**
 * Admin-managed where it exists, brand defaults where it does not. Never null,
 * so callers can interpolate without a guard.
 */
export function useStoreInfo(): StoreSettings {
  return useContext(StoreInfoContext) ?? fallbackStoreInfo();
}

/** Same shape as the server reader, derived from the hard-coded brand block. */
export function fallbackStoreInfo(): StoreSettings {
  const phone = site.phone || defaultStoreSettings.phone;
  return {
    name: site.nameBn,
    name_en: site.nameEn,
    email: site.email,
    phone,
    phone_display: site.phoneDisplay || prettyPhoneBn(phone) || defaultStoreSettings.phone_display,
    whatsapp: site.whatsapp || defaultStoreSettings.whatsapp,
    address_bn: site.addressBn,
    address_en: site.addressEn,
    hours_bn: site.hoursBn,
    hours_en: defaultStoreSettings.hours_en,
    map_embed: site.mapEmbed,
  };
}
