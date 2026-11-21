"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, CheckCheck } from "lucide-react";

type Item = {
  id: string;
  kind: string;
  title_bn: string;
  body_bn: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const KIND_ICON: Record<string, string> = {
  order: "📦",
  status: "🚚",
  premium: "✨",
  seller: "🏪",
  product: "🌿",
  camera: "📹",
  system: "🔔",
};

export function NotificationList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  const unread = items.filter((i) => !i.is_read).length;

  const markAll = async () => {
    setBusy(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    } finally {
      setBusy(false);
    }
  };

  const markOne = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  };

  if (items.length === 0) {
    return (
      <div className="card border-dashed p-10 text-center">
        <BellOff className="mx-auto h-7 w-7 text-sand-100/25" />
        <p className="mt-3 text-[13px] text-sand-100/55">এখনো কোনো নোটিফিকেশন নেই</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {unread > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-sand-100/45">{unread}টি অপঠিত</p>
          <button
            type="button"
            onClick={markAll}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] text-mint hover:underline disabled:opacity-50"
          >
            <CheckCheck className="h-3 w-3" /> সব পড়া হয়েছে
          </button>
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => {
          const content = (
            <>
              <span className="mt-0.5 text-base">{KIND_ICON[item.kind] ?? "🔔"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-2">
                  <span className={`text-[12.5px] ${item.is_read ? "font-medium text-sand-100/70" : "font-semibold text-white"}`}>
                    {item.title_bn}
                  </span>
                  {!item.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />}
                </span>
                {item.body_bn && (
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-sand-100/50">{item.body_bn}</span>
                )}
                <span className="mt-1 block text-[10px] text-sand-100/30">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString("bn-BD", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </span>
            </>
          );

          return (
            <li key={item.id}>
              {item.link ? (
                <Link
                  href={item.link}
                  onClick={() => markOne(item.id)}
                  className={`flex gap-2.5 rounded-xl border p-3 transition hover:border-mint/30 ${
                    item.is_read ? "border-white/5 bg-white/[0.01]" : "border-mint/20 bg-mint/[0.05]"
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => markOne(item.id)}
                  className={`flex w-full gap-2.5 rounded-xl border p-3 text-left transition ${
                    item.is_read ? "border-white/5 bg-white/[0.01]" : "border-mint/20 bg-mint/[0.05]"
                  }`}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
