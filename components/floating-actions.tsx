"use client";

import { useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { site } from "@/lib/site";
import { BackToTop } from "./ui";

export function FloatingActions() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const waLink = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
    t(
      "আসসালামু আলাইকুম, বিশ্বাস এগ্রো থেকে অর্ডার করতে চাই।",
      "Hello Biswas Agro, I'd like to place an order."
    )
  )}`;

  return (
    <>
      <BackToTop />

      <div
        className="fixed left-4 z-40 flex flex-col items-start gap-2 sm:left-6"
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        {open ? (
          <div className="animate-fade-up space-y-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="neu-raised-xs flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-semibold text-neu-ink transition hover:text-neu-accent-strong"
            >
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              {t("হোয়াটসঅ্যাপ", "WhatsApp")}
            </a>
            <a
              href={`tel:${site.phone}`}
              className="neu-raised-xs flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-semibold text-neu-ink transition hover:text-neu-accent-strong"
            >
              <Phone className="h-4 w-4 text-neu-accent" />
              {t("কল করুন", "Call us")}
            </a>
          </div>
        ) : null}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={t("যোগাযোগের অপশন", "Contact options")}
          aria-expanded={open}
          className="neu-icon-btn h-12 w-12 !text-[#25D366]"
        >
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
