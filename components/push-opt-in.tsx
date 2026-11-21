"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   PushOptIn — browser notification permission + endpoint registration
   --------------------------------------------------------------------------
   VAPID keys are optional. With none configured the component explains that
   notifications are unavailable instead of silently failing.
   ========================================================================== */

type Status = "loading" | "unsupported" | "disabled" | "blocked" | "off" | "on";

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushOptIn({ signedIn }: { signedIn: boolean }) {
  const { success, error: errorToast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      const res = await fetch("/api/push/subscribe").catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      if (!json?.data?.publicKey) {
        if (!cancelled) setStatus("disabled");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      if (!cancelled) setStatus(sub ? "on" : "off");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!signedIn) {
      errorToast("লগইন করুন", "নোটিফিকেশন চালু করতে অ্যাকাউন্ট দরকার");
      return;
    }
    setBusy(true);
    try {
      const keyRes = await fetch("/api/push/subscribe");
      const keyJson = await keyRes.json();
      const publicKey: string = keyJson?.data?.publicKey ?? "";
      if (!publicKey) {
        errorToast("পুশ নোটিফিকেশন কনফিগার করা নেই");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      const payload = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: payload.endpoint, keys: payload.keys }),
      });

      if (!res.ok) {
        errorToast("সাবস্ক্রাইব করা যায়নি");
        return;
      }

      setStatus("on");
      success("নোটিফিকেশন চালু হয়েছে", "অর্ডার ও লাইভ আপডেট পাবেন");
    } catch {
      errorToast("নোটিফিকেশন চালু করা যায়নি");
    } finally {
      setBusy(false);
    }
  }, [signedIn, success, errorToast]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      success("নোটিফিকেশন বন্ধ হয়েছে");
    } finally {
      setBusy(false);
    }
  }, [success]);

  const copy: Record<Status, { title: string; body: string }> = {
    loading: { title: "নোটিফিকেশন", body: "লোড হচ্ছে…" },
    unsupported: { title: "আপনার ব্রাউজারে সমর্থিত নয়", body: "Chrome বা Safari-এর নতুন ভার্সন ব্যবহার করুন" },
    disabled: {
      title: "সার্ভারে চালু করা নেই",
      body: "VAPID কী সেট করা হলে নোটিফিকেশন চালু হবে",
    },
    blocked: { title: "ব্লক করা আছে", body: "ব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি দিন" },
    off: { title: "নোটিফিকেশন বন্ধ", body: "অর্ডার ও লাইভ ক্যামেরা আপডেট পেতে চালু করুন" },
    on: { title: "নোটিফিকেশন চালু", body: "আপনি অর্ডার আপডেট পাবেন" },
  };

  const info = copy[status];

  return (
    <div className="card flex items-center gap-3 p-4">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          status === "on" ? "bg-leaf-600/20 text-leaf-200" : "bg-white/[0.05] text-sand-100/50"
        }`}
      >
        {status === "on" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-white">{info.title}</p>
        <p className="text-[11px] text-sand-100/45">{info.body}</p>
      </div>
      {(status === "off" || status === "on") && (
        <button
          type="button"
          onClick={status === "on" ? disable : enable}
          disabled={busy}
          className={status === "on" ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {status === "on" ? "বন্ধ" : "চালু"}
        </button>
      )}
    </div>
  );
}
