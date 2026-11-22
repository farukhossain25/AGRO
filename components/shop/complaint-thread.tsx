"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui";
import { formatDateBn } from "@/lib/format";

/* ==========================================================================
   ComplaintThread — the customer's view of a ticket conversation
   ========================================================================== */

export type ThreadMessage = {
  id: string;
  author_role: string;
  body: string;
  created_at: string;
};

const ROLE_STYLE: Record<string, { name: string; bubble: string }> = {
  customer: { name: "আপনি", bubble: "bg-leaf-600/15 border-leaf-400/25 ml-auto" },
  seller: { name: "সেলার", bubble: "bg-white/[0.05] border-white/10" },
  admin: { name: "সহায়তা দল", bubble: "bg-amber-500/10 border-amber-400/25" },
};

export function ComplaintThread({
  complaintId,
  initialMessages,
  closed,
}: {
  complaintId: string;
  initialMessages: ThreadMessage[];
  closed: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = text.trim();
    if (!body) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; id?: string; created_at?: string };
      if (!res.ok) throw new Error(json.message ?? "বার্তা পাঠানো যায়নি");

      setMessages((prev) => [
        ...prev,
        {
          id: json.id ?? crypto.randomUUID(),
          author_role: "customer",
          body,
          created_at: json.created_at ?? new Date().toISOString(),
        },
      ]);
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-2.5">
        {messages.length === 0 ? (
          <li className="text-[12px] text-sand-100/40">এখনো কোনো বার্তা নেই।</li>
        ) : null}

        {messages.map((m) => {
          const style = ROLE_STYLE[m.author_role] ?? ROLE_STYLE.seller;
          return (
            <li
              key={m.id}
              className={`max-w-[92%] rounded-xl border px-3 py-2 sm:max-w-[80%] ${style.bubble}`}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-sand-100/45">
                {style.name} · {formatDateBn(m.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-6 text-sand-100/85">
                {m.body}
              </p>
            </li>
          );
        })}
      </ol>

      {closed ? (
        <p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-[11.5px] text-sand-100/45">
          এই টিকিটটি বন্ধ করা হয়েছে। নতুন সমস্যা হলে অর্ডার থেকে আবার অভিযোগ করুন।
        </p>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="আপনার উত্তর লিখুন…"
            className="input text-[16px] sm:text-[13.5px]"
          />
          {error ? (
            <p role="alert" className="text-[11.5px] text-red-300">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !text.trim()}
            className="btn-primary btn-sm min-h-[44px]"
          >
            {busy ? <Spinner /> : null} পাঠান
          </button>
        </div>
      )}
    </div>
  );
}
