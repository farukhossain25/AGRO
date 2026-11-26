import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import {
  clientKey,
  created,
  currentUser,
  fail,
  handleError,
  ok,
  rateLimit,
  sanitizeText,
  tooMany,
} from "@/lib/api";
import { notifyAdmins } from "@/lib/notify";
import { adminHref } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/support/chat — the customer's side of live chat
   --------------------------------------------------------------------------
   GET    ?guest=<key>   → the caller's live chat + transcript (rejoin)
   POST   { body }       → send a message (opens the chat on the first one)
   PATCH  ?guest=<key>   → close my chat            { reason: "customer" }
   DELETE ?guest=<key>   → the widget's timeout sweep, then re-read

   Identity: a signed-in customer is keyed by user_id, a visitor by a random
   `guest_key` kept in localStorage. The guest key is a bearer token for one
   transcript and nothing else — it is never used to read anything but the
   chat it created, and the transcript is selected by that key, never by chat
   id, so guessing an id gets you nowhere.
   ========================================================================== */

const GUEST_RE = /^[A-Za-z0-9_-]{16,64}$/;
/** How long the store may stay silent before the chat closes itself. */
const REPLY_WINDOW_MIN = 15;

const postSchema = z.object({
  body: z.string().trim().min(1, "কিছু লিখুন").max(2000, "বার্তা ২০০০ অক্ষরের মধ্যে রাখুন"),
  guest: z.string().regex(GUEST_RE).optional(),
  pagePath: z.string().max(300).optional(),
  /** Sent with the first message so the panel shows a phone number to call back. */
  phone: z.string().max(30).optional(),
  name: z.string().max(80).optional(),
});

type ChatRow = {
  id: string;
  user_id: string | null;
  guest_key: string | null;
  status: "open" | "claimed" | "closed";
  claimed_by: string | null;
  claimed_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  reply_window_min: number;
  last_customer_at: string;
  last_staff_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  author_role: "customer" | "staff";
  author_name: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
};

/**
 * The name the customer should see next to a reply. This is what makes
 * "বিশ্বাস এগ্রো ও ফয়সাল connected" possible: the staff row carries the claim,
 * the profile carries the human name.
 */
async function claimerName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await db().from("profiles").select("full_name, email").eq("id", id).maybeSingle();
  const name = (data?.full_name ?? "").trim() || (data?.email ?? "").split("@")[0] || "";
  return name || null;
}

function shape(chat: ChatRow, messages: MessageRow[], staffName: string | null) {
  return {
    id: chat.id,
    status: chat.status,
    claimed_by_name: staffName,
    /** seconds left before the sweep closes it — the widget counts down */
    reply_window_min: chat.reply_window_min ?? REPLY_WINDOW_MIN,
    last_customer_at: chat.last_customer_at,
    closed_reason: chat.closed_reason,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.author_role,
      name: m.author_name,
      body: m.body,
      system: m.is_system,
      at: m.created_at,
    })),
  };
}

async function loadMessages(chatId: string): Promise<MessageRow[]> {
  const { data } = await db()
    .from("support_messages")
    .select("id, author_role, author_name, body, is_system, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (data ?? []) as MessageRow[];
}

/** The live chat for this caller, if any. Closed chats are never rejoined. */
async function findLiveChat(userId: string | null, guest: string | null) {
  let query = db().from("support_chats").select("*").neq("status", "closed");
  query = userId ? query.eq("user_id", userId) : query.eq("guest_key", guest ?? "__none__");
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data ?? null) as ChatRow | null;
}

export async function GET(req: Request) {
  try {
    if (!isDbConfigured()) return ok({ chat: null });

    const url = new URL(req.url);
    const guest = url.searchParams.get("guest");
    if (guest && !GUEST_RE.test(guest)) return fail("সঠিক চ্যাট আইডি দিন", 400);

    const user = await currentUser();
    if (!user && !guest) return ok({ chat: null });

    const chat = await findLiveChat(user?.id ?? null, guest);
    if (!chat) return ok({ chat: null });

    const [messages, staff] = await Promise.all([loadMessages(chat.id), claimerName(chat.claimed_by)]);
    return ok({ chat: shape(chat, messages, staff) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    if (!isDbConfigured()) return fail("চ্যাট এখনো চালু হয়নি", 503);

    const limited = rateLimit(clientKey(req, "support-chat-send"), 20, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? "বার্তাটি সঠিক নয়", 422);
    }
    const { body, guest, pagePath, phone, name } = parsed.data;

    const user = await currentUser();
    if (!user && !guest) return fail("চ্যাট শুরু করতে আগে পেজটি রিলোড করুন", 400);

    const clean = sanitizeText(body, 2000);
    if (!clean) return fail("বার্তাটি খালি", 422);

    let chat = await findLiveChat(user?.id ?? null, guest ?? null);

    // ── first message: open the chat and tell the whole team it arrived ──
    if (!chat) {
      const { data: profile } = user
        ? await db().from("profiles").select("full_name, phone, email").eq("id", user.id).maybeSingle()
        : { data: null };

      const insert = {
        user_id: user?.id ?? null,
        guest_key: user ? null : (guest as string),
        customer_name: sanitizeText(name ?? profile?.full_name ?? "", 80) || null,
        customer_phone: sanitizeText(phone ?? profile?.phone ?? "", 30) || null,
        customer_email: profile?.email ?? user?.email ?? null,
        page_path: pagePath ? sanitizeText(pagePath, 300) : null,
        subject: clean.slice(0, 120),
        reply_window_min: REPLY_WINDOW_MIN,
      };

      const { data, error } = await db().from("support_chats").insert(insert).select("*").single();

      if (error) {
        /* Two tabs sending their first message at the same instant: the partial
           unique index rejects the loser, which should then simply join the
           chat the winner created rather than showing an error. */
        if ((error as { code?: string }).code === "23505") {
          chat = await findLiveChat(user?.id ?? null, guest ?? null);
        }
        if (!chat) throw error;
      } else {
        chat = data as ChatRow;

        /* Everyone on the team hears about it — this is the "সব স্টাফ দেখবে"
           requirement. Best effort: a failed push must not lose the message. */
        await notifyAdmins({
          kind: "system",
          title: "নতুন লাইভ চ্যাট",
          body: `${insert.customer_name ?? "একজন কাস্টমার"}: ${insert.subject}`,
          link: adminHref("chats"),
          meta: { chat_id: chat.id, page: insert.page_path },
        }).catch(() => {});
      }
    }

    const { data: message, error: msgError } = await db()
      .from("support_messages")
      .insert({
        chat_id: chat.id,
        author_role: "customer",
        author_id: user?.id ?? null,
        author_name: sanitizeText(name ?? "", 80) || "কাস্টমার",
        body: clean,
      })
      .select("id, author_role, author_name, body, is_system, created_at")
      .single();

    if (msgError) throw msgError;

    const messages = await loadMessages(chat.id);
    const staff = await claimerName(chat.claimed_by);
    return created({ chat: shape(chat, messages, staff) , message });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    if (!isDbConfigured()) return fail("চ্যাট এখনো চালু হয়নি", 503);

    const url = new URL(req.url);
    const guest = url.searchParams.get("guest");
    const user = await currentUser();
    if (!user && !guest) return fail("কোনো চ্যাট নেই", 404);

    const chat = await findLiveChat(user?.id ?? null, guest);
    if (!chat) return ok({ closed: true });

    if (chat.user_id && chat.user_id !== user?.id) return fail("এই চ্যাটটি আপনার নয়", 403);

    await db()
      .from("support_chats")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_reason: "customer", updated_at: new Date().toISOString() })
      .eq("id", chat.id);

    await db().from("support_messages").insert({
      chat_id: chat.id,
      author_role: "customer",
      author_id: user?.id ?? null,
      body: "কাস্টমার চ্যাটটি শেষ করেছেন।",
      is_system: true,
    });

    return ok({ closed: true });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * The auto-close sweep. The customer's widget calls this every 30 s while it is
 * open, which is exactly when it matters — a chat has never needed closing at a
 * moment nobody has the tab open. Also callable from the panel.
 */
export async function DELETE() {
  try {
    if (!isDbConfigured()) return ok({ closed: 0 });
    const { data, error } = await db().rpc("chat_sweep" as never);
    if (error) throw error;
    return ok((data as { closed?: number } | null) ?? { closed: 0 });
  } catch (error) {
    return handleError(error);
  }
}
