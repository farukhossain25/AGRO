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
              className="flex items-center gap-2.5 rounded-full bg-[#25D366] px-4 py-2.5 text-[13px] font-semibold text-white shadow-soft transition hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" />
              {t("হোয়াটসঅ্যাপ", "WhatsApp")}
            </a>
            <a
              href={`tel:${site.phone}`}
              className="flex items-center gap-2.5 rounded-full bg-leaf-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-soft transition hover:bg-leaf-500"
            >
              <Phone className="h-4 w-4" />
              {t("কল করুন", "Call us")}
            </a>
          </div>
        ) : null}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={t("যোগাযোগের অপশন", "Contact options")}
          aria-expanded={open}
          className="grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-10px_rgba(37,211,102,.8)] transition hover:scale-105 active:scale-95"
        >
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
