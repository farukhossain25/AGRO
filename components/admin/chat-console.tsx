"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleDot, Headset, Lock, Phone, Send, UserRound } from "lucide-react";
import { useRealtimeTable } from "@/lib/use-realtime";
import { useToast } from "@/lib/toast";

/* ==========================================================================
   components/admin/chat-console.tsx
   --------------------------------------------------------------------------
   The team's live-chat desk.

   The rule the owner set is visible in the layout itself:
     LEFT  — every live chat, whoever owns it. Read-only rows are not hidden,
             they are marked with who claimed them. Everyone can see the work.
     RIGHT — the transcript. The reply box only unlocks for the ONE staff
             member who claimed the chat; everyone else sees a locked bar
             naming the owner.

   Two timers keep it honest:
     • realtime + a 15 s poll refresh the list without a click
     • a 60 s sweep closes chats nobody answered, so the queue cannot fill with
       dead conversations the team is ignoring
   ========================================================================== */

export type AdminChat = {
  id: string;
  status: "open" | "claimed" | "closed";
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  page_path: string | null;
  subject: string | null;
  claimed_by: string | null;
  claimed_by_name: string | null;
  last_customer_at: string;
  last_staff_at: string | null;
  reply_window_min: number;
  message_count: number;
  closed_reason: string | null;
  created_at: string;
};

export type AdminMessage = {
  id: string;
  chat_id: string;
  author_role: "customer" | "staff";
  author_name: string | null;
  body: string;
  /** The API returns the raw column name from the DB and a `system` alias for
   *  the customer widget; accept either so the bubble logic cannot silently
   *  render a "joined" note as if the staff member had typed it. */
  is_system?: boolean;
  system?: boolean;
  created_at: string;
};

const FILTERS = [
  { key: "live", label: "চলমান" },
  { key: "open", label: "কেউ নেয়নি" },
  { key: "mine", label: "আমার" },
  { key: "all", label: "সব" },
] as const;

/**
 * Minutes before the sweep closes this chat. Shown in the queue because the
 * whole promise is time-limited — a staff member deciding what to answer first
 * needs to see which customer is closest to giving up.
 */
function minutesLeft(chat: AdminChat): number {
  const anchor = new Date(chat.last_staff_at ?? chat.created_at).getTime();
  const elapsed = Math.max(0, (Date.now() - anchor) / 60000);
  return Math.max(0, Math.ceil(chat.reply_window_min - elapsed));
}

function timeBn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 1) return "এখনই";
  if (diff < 60) return `${Math.round(diff)} মিনিট আগে`;
  if (diff < 60 * 24) return `${Math.round(diff / 60)} ঘণ্টা আগে`;
  return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
}

export function ChatConsole({ me }: { me: string }) {
  const toast = useToast();
  const [filter, setFilter] = useState<string>("live");
  const [chats, setChats] = useState<AdminChat[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scroller = useRef<HTMLDivElement | null>(null);

  const active = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);
  const iOwnIt = !!active && active.claimed_by === me;
  const canType = !!active && iOwnIt && active.status !== "closed";

  const load = useCallback(
    async (status = filter, chatId?: string) => {
      try {
        const params = new URLSearchParams({ status });
        if (chatId) params.set("chatId", chatId);
        const res = await fetch(`/api/foisal/chats?${params}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.message ?? "লিস্ট আনা যায়নি");
        setChats(json.data.chats ?? []);
        setMessages(json.data.messages ?? []);
        setActiveId((prev) => {
          const next = json.data.activeId ?? null;
          // keep the chat the user is reading, unless it fell out of the filter
          if (prev && (json.data.chats ?? []).some((c: AdminChat) => c.id === prev)) return prev;
          return next;
        });
      } catch (err) {
        toast.error("চ্যাট লোড হয়নি", (err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filter, toast]
  );

  useEffect(() => {
    void load(filter, activeId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useRealtimeTable({
    table: "support_chats",
    pollMs: 15_000,
    onChange: () => void load(filter, activeId ?? undefined),
  });
  useRealtimeTable({
    table: "support_messages",
    pollMs: 0,
    onChange: () => void load(filter, activeId ?? undefined),
  });

  /* Sweep + refresh: closes timed-out chats and re-reads the list. Runs while
     the desk is open, which is the only time it can help. */
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/foisal/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sweep" }),
      }).catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  async function act(body: Record<string, unknown>, successMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/foisal/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "কাজটি হয়নি");
      if (successMsg) toast.success(successMsg);
      await load(filter, activeId ?? undefined);
      return json.data;
    } catch (err) {
      toast.error("সমস্যা", (err as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function claim(chatId: string) {
    const data = await act({ action: "claim", chatId }, "চ্যাটটি আপনার — এখন উত্তর দিন");
    if (data) setActiveId(chatId);
  }

  async function reply() {
    if (!active || !text.trim()) return;
    const body = text.trim();
    setText("");
    await act({ action: "reply", chatId: active.id, body });
  }

  async function close() {
    if (!active) return;
    await act({ action: "close", chatId: active.id, reason: "staff" }, "চ্যাট বন্ধ হয়েছে");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      {/* ── LEFT: the queue ─────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <header className="border-b border-neu-line/60 px-4 py-3">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-neu-ink">
            <Headset className="h-4 w-4 text-neu-accent" />
            লাইভ চ্যাট
          </h2>
          <p className="mt-0.5 text-[11.5px] text-neu-muted">
            সব স্টাফ সব চ্যাট দেখতে পান — উত্তর দিতে একটি চ্যাট নিতে হবে।
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  filter === f.key ? "bg-neu-accent text-white" : "bg-neu-sunken/70 text-neu-muted hover:text-neu-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <ul className="max-h-[70vh] divide-y divide-neu-line/50 overflow-y-auto">
          {loading ? (
            <li className="px-4 py-6 text-center text-[12px] text-neu-muted">লোড হচ্ছে…</li>
          ) : chats.length === 0 ? (
            <li className="px-4 py-8 text-center text-[12px] text-neu-muted">
              এখন কোনো চ্যাট নেই। কাস্টমার লিখলেই এখানে দেখা যাবে।
            </li>
          ) : (
            chats.map((c) => {
              const isActive = c.id === activeId;
              const mine = c.claimed_by === me;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(c.id);
                      void load(filter, c.id);
                    }}
                    className={`w-full px-4 py-3 text-left transition ${isActive ? "bg-neu-accent/[0.08]" : "hover:bg-neu-sunken/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-bold text-neu-ink">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-neu-muted" />
                        <span className="truncate">{c.customer_name ?? "অতিথি"}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-neu-faint">
                        {c.status === "closed"
                          ? timeBn(c.last_customer_at)
                          : `${minutesLeft(c)} মিনিট বাকি`}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-neu-muted">{c.subject ?? "—"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {c.status === "open" ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          <CircleDot className="h-2.5 w-2.5" /> কেউ নেয়নি
                        </span>
                      ) : c.status === "closed" ? (
                        <span className="rounded-full bg-neu-sunken px-1.5 py-0.5 text-[10px] font-semibold text-neu-faint">
                          বন্ধ{c.closed_reason === "timeout" ? " (সময় শেষ)" : ""}
                        </span>
                      ) : (
                        <span
                          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            mine ? "bg-neu-accent/15 text-neu-accent-strong" : "bg-neu-sunken text-neu-muted"
                          }`}
                        >
                          <Lock className="h-2.5 w-2.5" />
                          {mine ? "আপনি" : c.claimed_by_name ?? "অন্য একজন"}
                        </span>
                      )}
                      {c.page_path ? (
                        <span className="truncate rounded-full bg-neu-sunken px-1.5 py-0.5 text-[10px] text-neu-faint">
                          {c.page_path}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* ── RIGHT: the conversation ─────────────────────────────────────── */}
      <section className="card flex min-h-[28rem] flex-col overflow-hidden">
        {!active ? (
          <div className="grid flex-1 place-items-center px-6 py-16 text-center text-[12.5px] text-neu-muted">
            বাঁ দিক থেকে একটি চ্যাট বেছে নিন।
          </div>
        ) : (
          <>
            <header className="border-b border-neu-line/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-neu-ink">
                    {active.customer_name ?? "অতিথি"}
                    {active.customer_phone ? (
                      <span className="ml-2 font-normal text-[11.5px] tabular-nums text-neu-muted">
                        {active.customer_phone}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neu-muted">
                    {active.page_path ?? "—"} · শুরু {timeBn(active.created_at)} · {active.message_count} বার্তা
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {active.customer_phone ? (
                    <a
                      href={`tel:${active.customer_phone}`}
                      className="flex items-center gap-1 rounded-full border border-neu-line/70 px-2.5 py-1 text-[11px] font-semibold text-neu-ink"
                    >
                      <Phone className="h-3 w-3 text-neu-accent" /> কল
                    </a>
                  ) : null}
                  {active.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => void claim(active.id)}
                      disabled={busy}
                      className="btn-primary !px-3 !py-1.5 !text-[11.5px]"
                    >
                      গ্রহণ করুন
                    </button>
                  ) : active.status === "claimed" && iOwnIt ? (
                    <button
                      type="button"
                      onClick={() => void close()}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-full border border-neu-line/70 px-2.5 py-1 text-[11px] font-semibold text-neu-ink"
                    >
                      <CheckCircle2 className="h-3 w-3" /> শেষ করুন
                    </button>
                  ) : null}
                </div>
              </div>

              {/* who owns it — visible to EVERY staff member */}
              {active.status === "claimed" ? (
                <p
                  className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                    iOwnIt ? "bg-neu-accent/12 text-neu-accent-strong" : "bg-neu-sunken/70 text-neu-muted"
                  }`}
                >
                  {iOwnIt
                    ? "এই চ্যাটটি আপনি নিয়েছেন — এখন উত্তর দিতে পারবেন।"
                    : `${active.claimed_by_name ?? "অন্য একজন"} এই চ্যাটটি নিয়েছেন — আপনি শুধু দেখতে পারবেন।`}
                </p>
              ) : active.status === "closed" ? (
                <p className="mt-2 rounded-lg bg-neu-sunken/70 px-2.5 py-1.5 text-[11px] text-neu-muted">
                  চ্যাটটি বন্ধ
                  {active.closed_reason === "timeout" ? " — সময়ের মধ্যে উত্তর দেওয়া হয়নি" : ""}।
                </p>
              ) : null}
            </header>

            <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
              {messages.map((m) =>
                (m.is_system ?? m.system) ? (
                  <p key={m.id} className="text-center text-[10.5px] text-neu-faint">
                    {m.body}
                  </p>
                ) : (
                  <div key={m.id} className={`flex ${m.author_role === "staff" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                        m.author_role === "staff"
                          ? "bg-neu-accent text-white"
                          : "border border-neu-line/70 bg-neu-sunken/40 text-neu-ink"
                      }`}
                    >
                      <span className="mb-0.5 block text-[10px] font-bold opacity-70">
                        {m.author_role === "staff" ? m.author_name ?? "টিম" : active.customer_name ?? "কাস্টমার"}
                      </span>
                      {m.body}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* composer — locked for everyone but the owner */}
            <div className="border-t border-neu-line/60 p-3">
              {canType ? (
                <div className="flex items-end gap-1.5">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void reply();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="উত্তর লিখুন…"
                    className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-neu-line/70 bg-neu-bg px-3 py-2 text-[12.5px] text-neu-ink outline-none focus:border-neu-accent/60"
                  />
                  <button
                    type="button"
                    onClick={() => void reply()}
                    disabled={busy || !text.trim()}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-neu-accent text-white disabled:opacity-40"
                    aria-label="পাঠান"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-lg bg-neu-sunken/60 px-3 py-2 text-[11.5px] text-neu-muted">
                  <Lock className="h-3.5 w-3.5" />
                  {active.status === "closed"
                    ? "চ্যাটটি বন্ধ — নতুন চ্যাটে উত্তর দেওয়া যাবে।"
                    : active.status === "open"
                      ? "উত্তর দিতে আগে চ্যাটটি গ্রহণ করুন।"
                      : `${active.claimed_by_name ?? "অন্য একজন"} উত্তর দিচ্ছেন — আপনি পড়তে পারবেন, লিখতে পারবেন না।`}
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
