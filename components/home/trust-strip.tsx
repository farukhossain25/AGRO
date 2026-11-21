"use client";

import { useLocale } from "@/lib/locale";
import { trustBadges } from "@/lib/site";

export function TrustStrip() {
  const { t } = useLocale();
  return (
    <div className="border-y border-white/[0.06] bg-ink-950/40">
      <div className="container-x no-scrollbar flex items-center justify-start gap-6 overflow-x-auto py-3.5 sm:justify-between">
        {trustBadges.map((b) => (
          <div key={b.bn} className="flex shrink-0 items-center gap-2">
            <span className="text-base" aria-hidden>{b.icon}</span>
            <span className="whitespace-nowrap text-[12px] font-medium text-sand-100/70">
              {t(b.bn, b.en)}
            </span>
          </div>
        ))}
        <div className="hidden items-center gap-2 lg:flex">
          <span className="text-base" aria-hidden>📞</span>
          <span className="whitespace-nowrap text-[12px] font-medium text-sand-100/70">
            {t("সকাল ৭টা–রাত ১০টা সাপোর্ট", "Support 7am–10pm")}
          </span>
        </div>
      </div>
    </div>
  );
}
