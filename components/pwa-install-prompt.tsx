"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useLocale } from "@/lib/locale";

/* ==========================================================================
   PWA install prompt (section E)
   --------------------------------------------------------------------------
   • Chromium fires `beforeinstallprompt` — we stash it and show our own card
   • iOS Safari never fires it → show the "Share → Add to Home Screen" hint
   • Dismissal is remembered for 30 days, and it never appears in the native
     Capacitor shell (the app is already installed there).
   ========================================================================== */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ba_install_dismissed";
const DISMISS_DAYS = 30;

export function PWAInstallPrompt() {
  const { t } = useLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // already installed (standalone) or inside the Android shell → nothing to do
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
      return;
    }

    // recently dismissed?
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < DISMISS_DAYS * 864e5) return;
    } catch {
      /* private mode */
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari: no event — show the manual hint after a short delay
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos && isSafari) {
      timer = setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 6000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md animate-fade-up sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3 rounded-2xl border border-leaf-500/30 bg-ink-850/98 p-3.5 shadow-soft backdrop-blur-xl">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-600/20 text-leaf-200">
          <Download className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold">
            {t("অ্যাপটি হোম স্ক্রিনে যোগ করুন", "Add the app to your home screen")}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-sand-100/55">
            {iosHint
              ? t(
                  "Safari-তে Share বাটন চেপে → “Add to Home Screen” নির্বাচন করুন।",
                  "Tap Share in Safari → “Add to Home Screen”."
                )
              : t(
                  "দ্রুত অর্ডার, অফলাইন ব্রাউজিং ও নোটিফিকেশন পাবেন।",
                  "Get faster ordering, offline browsing and notifications."
                )}
          </p>

          {!iosHint ? (
            <button onClick={install} className="btn-primary mt-2 !px-3 !py-1.5 !text-[11.5px]">
              {t("ইনস্টল করুন", "Install")}
            </button>
          ) : null}
        </div>

        <button
          onClick={dismiss}
          aria-label={t("বন্ধ করুন", "Dismiss")}
          className="shrink-0 text-sand-100/35 transition hover:text-sand-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
