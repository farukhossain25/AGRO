"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headset, MessageCircle, Phone, Send, ShieldCheck, X } from "lucide-react";
import { useLocale } from "@/lib/locale";
import { useStoreInfo } from "@/lib/store-info";
import { useRealtimeTable } from "@/lib/use-realtime";
import { BackToTop } from "@/components/ui";

/* ==========================================================================
   components/chat/contact-bubble.tsx
   --------------------------------------------------------------------------
   The one floating bubble on the storefront. It used to open a popup holding
   two links with no numbers written on them — so the "যোগাযোগ" bubble told the
   visitor nothing until they had already tapped something. It now opens a
   panel where the phone number and the WhatsApp number are both spelled out,
   and where they can type a message and get a human in the panel.

   Three behaviours worth naming:

     • The numbers come from useStoreInfo(), i.e. whatever the owner saved in
       /foisal/settings. Nothing here is typed into this file.

     • A sent message opens a chat in the panel for the whole team. The status
       strip under the composer tells the customer the truth: "কেউ দেখছেন",
       "ফয়সাল উত্তর দিচ্ছেন", or "স্বয়ংক্রিয়ভাবে বন্ধ হয়েছে".

     • If nobody answers within reply_window_min (15 min, set on the row), the
       chat closes itself. The countdown is visible, so the customer is never
       left staring at a spinner.

   Polling every 15 s backs up realtime: a guest has no auth session for the
   realtime socket, and a customer on a flaky mobile connection should still see
   the reply arrive.
   ========================================================================== */

type ChatMessage = {
  id: string;
  role: "customer" | "staff";
  name: string | null;
  body: string;
  system: boolean;
  at: string;
};

type ChatState = {
  id: string;
  status: "open" | "claimed" | "closed";
  claimed_by_name: string | null;
  reply_window_min: number;
  last_customer_at: string;
  closed_reason: string | null;
  messages: ChatMessage[];
};

const GUEST_KEY_STORE = "ba_chat_guest";

/** A stable browser key for a visitor who is not signed in. */
function guestKey(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_KEY_STORE);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
    window.localStorage.setItem(GUEST_KEY_STORE, key);
    return key;
  } catch {
    return "";
  }
}

export function ContactBubble() {
  const { t } = useLocale();
  const store = useStoreInfo();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatState | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [guest, setGuest] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => setGuest(guestKey()), []);

  const withGuest = useCallback(
    (path: string) => (guest ? `${path}${path.includes("?") ? "&" : "?"}guest=${encodeURIComponent(guest)}` : path),
    [guest]
  );

  const load = useCallback(async () => {
    if (!guest) return;
    try {
      const res = await fetch(withGuest("/api/support/chat"), { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setChat(json.data.chat ?? null);
    } catch {
      /* offline: the last transcript stays on screen, which is better than a blank panel */
    }
  }, [guest, withGuest]);

  // first load + when the panel opens
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /* Realtime: a staff reply should land without the customer refreshing. The
     subscription also fires on the chat row itself, which is how "ফয়সাল
     উত্তর দিচ্ছেন" appears the moment a staff member claims it. */
  useRealtimeTable({
    table: "support_messages",
    enabled: open && !!guest,
    pollMs: 15_000,
    onChange: () => void load(),
  });
  useRealtimeTable({
    table: "support_chats",
    enabled: open && !!guest,
    pollMs: 0,
    onChange: () => void load(),
  });

  /* The auto-close clock. One interval keeps both the countdown ("উত্তর আসতে
     বাকি ১২ মিনিট") and the sweep honest; the sweep is what actually closes
     the row, this only displays it. */
  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const sweep = setInterval(() => {
      fetch(withGuest("/api/support/chat"), { method: "DELETE" })
        .then(() => load())
        .catch(() => {});
    }, 60_000);
    return () => {
      clearInterval(tick);
      clearInterval(sweep);
    };
  }, [open, load, withGuest]);

  // keep the newest message in view
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat?.messages.length, open]);

  const minutesLeft = useMemo(() => {
    if (!chat || chat.status === "closed") return null;
    /* The clock runs from whichever side spoke last: a staff reply resets the
       customer's expectation, so the countdown restarts when they answer. */
    const last = new Date(chat.last_customer_at).getTime();
    const elapsed = Math.max(0, (now - last) / 60000);
    return Math.max(0, Math.ceil(chat.reply_window_min - elapsed));
  }, [chat, now]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, guest: guest || undefined, pagePath: window.location.pathname }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "বার্তা পাঠানো যায়নি");
      setText("");
      setChat(json.data.chat);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function endChat() {
    await fetch(withGuest("/api/support/chat"), { method: "PATCH" }).catch(() => {});
    setChat(null);
    void load();
  }

  const waLink = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
    t(`আসসালামু আলাইকুম, ${store.name} থেকে জানতে চাই।`, `Hello ${store.name_en}, I have a question.`)
  )}`;

  const status = (() => {
    if (!chat) return null;
    if (chat.status === "closed") {
      return {
        tone: "muted" as const,
        text:
          chat.closed_reason === "timeout"
            ? t(
                `নির্ধারিত সময়ে উত্তর দেওয়া হয়নি — চ্যাটটি বন্ধ হয়েছে। আবার লিখলেই নতুন করে যুক্ত হব।`,
                "Nobody answered in time, so this chat closed. Send a message to start again."
              )
            : t("চ্যাটটি বন্ধ হয়েছে।", "This chat is closed."),
      };
    }
    if (chat.status === "claimed" && chat.claimed_by_name) {
      return {
        tone: "live" as const,
        /* The sentence the owner asked for, in the words a customer understands. */
        text: t(
          `${store.name} ও ${chat.claimed_by_name} connected হয়েছেন — উত্তর আসছে।`,
          `${store.name_en} and ${chat.claimed_by_name} are connected — a reply is coming.`
        ),
      };
    }
    return {
      tone: "wait" as const,
      text:
        minutesLeft !== null && minutesLeft <= 15
          ? t(
              `আপনার বার্তা টিমের কাছে পৌঁছেছে — обычно কয়েক মিনিটে উত্তর আসে। ${minutesLeft} মিনিটে উত্তর না এলে চ্যাটটি বন্ধ হয়ে যাবে।`,
              `Your message reached the team — usually a few minutes. It closes in ${minutesLeft} min if nobody answers.`
            )
          : t("আপনার বার্তা টিমের কাছে পৌঁছেছে।", "Your message reached the team."),
    };
  })();

  return (
    <>
      <BackToTop />

      <div
        className="print:hidden fixed left-4 z-40 flex flex-col items-start gap-2 sm:left-6"
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        {open ? (
          <div className="animate-fade-up w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-2xl border border-neu-line/70 bg-neu-bg shadow-2xl">
            {/* header — the brand and the fact that a human reads this */}
            <div className="flex items-start justify-between gap-2 border-b border-neu-line/60 bg-neu-sunken/40 px-3.5 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-neu-ink">
                  <Headset className="h-4 w-4 text-neu-accent" />
                  {t("কথা বলুন", "Talk to us")}
                </p>
                <p className="mt-0.5 text-[11px] text-neu-muted">
                  {t("সত্যিকারের মানুষ উত্তর দেন", "A real person replies")} · {t(store.hours_bn, store.hours_en)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("বন্ধ করুন", "Close")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-neu-muted hover:bg-neu-line/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* the two numbers, written out */}
            <div className="grid grid-cols-2 gap-2 border-b border-neu-line/60 p-3">
              <a
                href={`tel:${store.phone}`}
                className="rounded-xl border border-neu-line/70 px-2.5 py-2 transition hover:border-neu-accent/50"
              >
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-neu-muted">
                  <Phone className="h-3 w-3 text-neu-accent" />
                  {t("সরাসরি কল", "Call")}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] font-bold tabular-nums text-neu-ink">
                  {store.phone_display}
                </span>
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-neu-line/70 px-2.5 py-2 transition hover:border-[#25D366]/60"
              >
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-neu-muted">
                  <MessageCircle className="h-3 w-3 text-[#25D366]" />
                  {t("হোয়াটসঅ্যাপ", "WhatsApp")}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] font-bold tabular-nums text-neu-ink">
                  {store.phone_display}
                </span>
              </a>
            </div>

            {/* transcript */}
            <div ref={scroller} className="max-h-[15rem] space-y-2 overflow-y-auto px-3 py-3">
              {!chat?.messages.length ? (
                <p className="rounded-xl bg-neu-sunken/50 px-3 py-2.5 text-[12px] leading-relaxed text-neu-muted">
                  {t(
                    "নিচে লিখুন — অর্ডার, পণ্য বা ডেলিভারি নিয়ে যেকোনো প্রশ্ন। চ্যাটে উত্তর দিলে এখানেই দেখতে পাবেন।",
                    "Type below — anything about an order, a product or delivery. The answer appears right here."
                  )}
                </p>
              ) : (
                chat.messages.map((m) =>
                  m.system ? (
                    <p key={m.id} className="text-center text-[10.5px] leading-relaxed text-neu-faint">
                      {m.body}
                    </p>
                  ) : (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                          m.role === "customer"
                            ? "bg-neu-accent text-white"
                            : "border border-neu-line/70 bg-neu-sunken/40 text-neu-ink"
                        }`}
                      >
                        {m.role === "staff" ? (
                          <span className="mb-0.5 block text-[10px] font-bold opacity-70">
                            {m.name ?? t("টিম", "Team")}
                          </span>
                        ) : null}
                        {m.body}
                      </div>
                    </div>
                  )
                )
              )}

              {chat && chat.status !== "closed" && chat.messages.length > 0 ? (
                <p className="flex items-center justify-center gap-1 pt-0.5 text-[10.5px] text-neu-faint">
                  <ShieldCheck className="h-3 w-3" />
                  {t("আপনার কথোপকথন শুধু আমাদের টিম দেখতে পান", "Only our team can see this conversation")}
                </p>
              ) : null}
            </div>

            {/* status strip — the auto-close promise, in the customer's words */}
            {status ? (
              <p
                className={`border-t border-neu-line/60 px-3.5 py-2 text-[10.5px] leading-relaxed ${
                  status.tone === "live"
                    ? "bg-neu-accent/10 font-semibold text-neu-accent-strong"
                    : status.tone === "wait"
                      ? "text-neu-muted"
                      : "text-neu-faint"
                }`}
              >
                {status.text}
              </p>
            ) : null}

            {error ? (
              <p className="border-t border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[11px] text-red-600">{error}</p>
            ) : null}

            {/* composer */}
            <div className="border-t border-neu-line/60 p-2.5">
              <div className="flex items-end gap-1.5">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={t("আপনার প্রশ্ন লিখুন…", "Type your question…")}
                  className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-neu-line/70 bg-neu-bg px-3 py-2 text-[12.5px] text-neu-ink outline-none focus:border-neu-accent/60"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || !text.trim()}
                  aria-label={t("পাঠান", "Send")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neu-accent text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {chat && chat.status !== "closed" ? (
                <button
                  type="button"
                  onClick={() => void endChat()}
                  className="mt-1.5 text-[10.5px] text-neu-faint underline-offset-2 hover:underline"
                >
                  {t("চ্যাট শেষ করুন", "End chat")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={t("যোগাযোগ ও লাইভ চ্যাট", "Contact and live chat")}
          aria-expanded={open}
          className="neu-icon-btn h-12 w-12 !text-[#25D366]"
        >
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
