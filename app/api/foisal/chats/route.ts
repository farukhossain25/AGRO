import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { currentUser, fail, handleError, ok, requirePermission, sanitizeText } from "@/lib/api";
import { isStaffRole } from "@/lib/permissions";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/chats — the team's side of live chat
   --------------------------------------------------------------------------
   GET   ?status=all|open|mine  → the queue + the open chat's transcript
   POST  { action: "claim" }    → take ownership (only one wins)
   POST  { action: "reply" }    → send as staff (only the owner may)
   POST  { action: "close" }    → end the chat
   POST  { action: "sweep" }    → close timed-out chats, refresh the list

   Why the checks live here and not only in SQL: the panel is a client
   component and every button hits this route, so this is the single place that
   decides "may this person type". The RPC `chat_claim()` then makes the
   one-owner rule race-proof at the database level.
   ========================================================================== */

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), chatId: z.string().uuid() }),
  z.object({ action: z.literal("reply"), chatId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("close"), chatId: z.string().uuid(), reason: z.enum(["staff", "customer"]).default("staff") }),
  z.object({ action: z.literal("sweep") }),
]);

type ChatRow = {
  id: string;
  /** Signed-in customer; null for a guest chat. Needed for the notify() calls. */
  user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  page_path: string | null;
  subject: string | null;
  status: "open" | "claimed" | "closed";
  claimed_by: string | null;
  claimed_at: string | null;
  closed_reason: string | null;
  closed_at: string | null;
  last_customer_at: string;
  last_staff_at: string | null;
  reply_window_min: number;
  message_count: number;
  created_at: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  author_role: "customer" | "staff";
  author_name: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
};

/**
 * The human name shown to the customer.
 *
 * Three shapes reach this function: a `profiles` row (`full_name`), a
 * SessionUser (`name`), and a bare user object from the auth layer
 * (`user_metadata.full_name`). Only handling `full_name` meant a staff reply
 * was signed with the email handle — the customer saw "foysal" where the
 * "connected" sentence promised "ফয়সাল". This reads all three.
 */
function displayName(
  row:
    | {
        full_name?: string | null;
        name?: string | null;
        email?: string | null;
        user_metadata?: { full_name?: string | null } | null;
      }
    | null
): string {
  const candidates = [row?.full_name, row?.name, row?.user_metadata?.full_name];
  for (const candidate of candidates) {
    const value = (candidate ?? "").trim();
    if (value) return value;
  }
  const handle = (row?.email ?? "").split("@")[0];
  return handle || "টিম সদস্য";
}

/** One lookup for every staff name in the list — never N queries for N chats. */
async function staffNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!unique.length) return new Map();
  const { data } = await db().from("profiles").select("id, full_name, email").in("id", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.id as string, displayName(row));
  return map;
}

function shapeChat(chat: ChatRow, names: Map<string, string>) {
  return {
    ...chat,
    claimed_by_name: chat.claimed_by ? (names.get(chat.claimed_by) ?? "টিম সদস্য") : null,
  };
}

export async function GET(req: Request) {
  try {
    // Read access is for anyone who may open the panel: every staff member must
    // be able to SEE an incoming chat. Replying still requires the claim.
    const user = await currentUser();
    if (!user || !isStaffRole(user.role)) return fail("এই পেজে ঢোকার অনুমতি নেই", 403);
    if (!isDbConfigured()) return ok({ chats: [], messages: [], me: user.id });

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "live";
    const chatId = url.searchParams.get("chatId");

    /* The default list is the live queue: open + claimed, newest question on
       top. `all` adds the closed transcripts, which is where "what did we tell
       them last time" lives. */
    let query = db().from("support_chats").select("*");
    if (status === "open") query = query.eq("status", "open");
    else if (status === "mine") query = query.eq("claimed_by", user.id).neq("status", "closed");
    else if (status !== "all") query = query.neq("status", "closed");

    const { data, error } = await query
      .order("status", { ascending: true })
      .order("last_customer_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const chats = (data ?? []) as ChatRow[];
    const names = await staffNames(chats.map((c) => c.claimed_by));

    let messages: MessageRow[] = [];
    const openId = chatId ?? chats.find((c) => c.id === chatId)?.id ?? chats[0]?.id ?? null;
    if (openId) {
      const { data: rows } = await db()
        .from("support_messages")
        .select("id, chat_id, author_role, author_name, body, is_system, created_at")
        .eq("chat_id", openId)
        .order("created_at", { ascending: true })
        .limit(400);
      messages = (rows ?? []) as MessageRow[];
    }

    return ok({
      chats: chats.map((c) => shapeChat(c, names)),
      messages,
      activeId: openId,
      me: user.id,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission("chats.handle");
    if (!isDbConfigured()) return fail("চ্যাট এখনো চালু হয়নি", 503);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "অনুরোধ সঠিক নয়", 422);
    const input = parsed.data;

    // ── sweep: the panel's own timer. Closes chats nobody answered in time. ──
    if (input.action === "sweep") {
      const { data, error } = await db().rpc("chat_sweep" as never);
      if (error) throw error;
      return ok((data as { closed?: number } | null) ?? { closed: 0 });
    }

    const { data: chatRow, error: chatError } = await db()
      .from("support_chats")
      .select("*")
      .eq("id", input.chatId)
      .maybeSingle();
    if (chatError) throw chatError;
    if (!chatRow) return fail("চ্যাটটি পাওয়া যায়নি", 404);
    const chat = chatRow as ChatRow;

    if (input.action === "claim") {
      if (chat.status === "closed") return fail("চ্যাটটি ইতিমধ্যে বন্ধ", 409);

      // Atomic at the database level: one UPDATE … WHERE claimed_by IS NULL.
      const { data, error } = await db().rpc("chat_claim" as never, { p_chat: input.chatId } as never);
      if (error) throw error;
      const result = (data ?? {}) as { ok?: boolean; reason?: string; claimed_by_name?: string };

      if (!result.ok) {
        if (result.reason === "taken") {
          return fail(
            `${result.claimed_by_name ?? "অন্য একজন"} ইতিমধ্যে এই চ্যাটটি নিয়েছেন — আপনি দেখতে পারবেন, লিখতে পারবেন না।`,
            409
          );
        }
        if (result.reason === "closed") return fail("চ্যাটটি বন্ধ হয়ে গেছে", 409);
        return fail("চ্যাটটি নেওয়া যায়নি", 409);
      }

      /* Tell the customer a human is on it. This is the sentence the owner
         asked for: "বিশ্বাস এগ্রো ও <নাম> connected". */
      await notify({
        userId: chat.user_id,
        kind: "system",
        title: "আপনার চ্যাটে সাড়া পাওয়া গেছে",
        body: `${result.claimed_by_name ?? "আমাদের টিম"} আপনার প্রশ্নটি নিয়েছেন — এখনই উত্তর দিচ্ছেন।`,
        link: "/support",
      }).catch(() => {});

      return ok({ claimed_by: user.id, claimed_by_name: result.claimed_by_name ?? displayName(user) });
    }

    // ── everything below is the owner's (or an admin's) business ──────────
    const isOwner = chat.claimed_by === user.id;
    const canOverride = user.role === "admin" || user.role === "manager";
    if (!isOwner && !canOverride && input.action !== "close") {
      return fail(
        chat.claimed_by
          ? "এই চ্যাটটি অন্য একজন নিয়েছেন — আপনি শুধু দেখতে পারবেন।"
          : "আগে চ্যাটটি নিন (গ্রহণ করুন), তারপর উত্তর দিন।",
        403
      );
    }

    if (input.action === "reply") {
      if (chat.status === "closed") return fail("চ্যাটটি বন্ধ — নতুন চ্যাট শুরু হলে উত্তর দেওয়া যাবে", 409);

      const clean = sanitizeText(input.body, 2000);
      if (!clean) return fail("বার্তাটি খালি", 422);

      const { data: message, error } = await db()
        .from("support_messages")
        .insert({
          chat_id: chat.id,
          author_role: "staff",
          author_id: user.id,
          author_name: displayName(user),
          body: clean,
        })
        .select("id, chat_id, author_role, author_name, body, is_system, created_at")
        .single();
      if (error) throw error;

      await notify({
        userId: chat.user_id,
        kind: "system",
        title: "নতুন বার্তা — বিশ্বাস এগ্রো",
        body: clean.slice(0, 120),
        link: "/support",
      }).catch(() => {});

      return ok({ message });
    }

    // ── close ────────────────────────────────────────────────────────────
    const { data, error } = await db().rpc("chat_close" as never, {
      p_chat: chat.id,
      p_reason: input.reason,
    } as never);
    if (error) throw error;
    return ok(data ?? { ok: true });
  } catch (error) {
    return handleError(error);
  }
}
