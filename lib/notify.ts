import { db } from "./db";
import { sendSms } from "./sms";
import type { NotificationKind } from "./types";

/* ==========================================================================
   Notification fan-out
   --------------------------------------------------------------------------
   Every event writes an in-app row first (that is the source of truth and the
   notification centre reads it). Then best-effort channels fire in parallel:

     • web push  → push_subscriptions (VAPID, see lib/push.ts)
     • email     → Resend (lib/email.ts)
     • SMS       → lib/sms.ts (SSLWireless / BulkSMSBD)
     • FCM       → fcm_tokens (Capacitor Android app)

   A failing channel never blocks the order or the in-app row.
   ========================================================================== */

export type NotifyInput = {
  userId: string | null;
  audience?: "user" | "seller" | "admin";
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  meta?: Record<string, unknown>;
  /** extra channels */
  email?: string | null;
  phone?: string | null;
  push?: boolean;
  /** false = skip the in-app row (already written by a DB function/RPC). */
  storeInApp?: boolean;
};

export async function notify(input: NotifyInput): Promise<void> {
  const {
    userId,
    audience = "user",
    kind,
    title,
    body,
    link,
    meta = {},
    email,
    phone,
    push = true,
    storeInApp = true,
  } = input;

  // 1) store the in-app notification (unless the caller already did)
  if (userId && storeInApp) {
    /* `notifications` carries `kind`/`title_bn`/`body_bn`/`link`/`meta`. These
       match 05_premium_reviews_tables.sql exactly; a stale insert shape is
       logged here instead of being swallowed (supabase-js returns `error`
       rather than throwing). */
    const { error } = await db().from("notifications").insert({
      user_id: userId,
      audience,
      kind,
      title_bn: title,
      body_bn: body ?? null,
      link: link ?? null,
      meta: meta as unknown as import("./database.types").Json,
    });
    if (error) console.error("[notify] in-app insert failed:", error.message, error.details ?? "");
  }

  const tasks: Promise<unknown>[] = [];

  if (push && userId) tasks.push(sendWebPush(userId, { title, body: body ?? "", link, kind }).catch(() => {}));

  if (email) tasks.push(sendEmail(email, title, body ?? "", link).catch(() => {}));

  if (phone) tasks.push(sendSms(phone, `${title}${body ? ` — ${body}` : ""}`).catch(() => {}));

  if (kind === "order" || kind === "status" || kind === "premium") {
    if (userId) tasks.push(sendFcm(userId, title, body ?? "", { link: link ?? "", kind }).catch(() => {}));
  }

  await Promise.allSettled(tasks);
}

/** Fan-out to every admin user. Used for new orders and approval queues. */
export async function notifyAdmins(input: Omit<NotifyInput, "userId" | "audience">): Promise<void> {
  /* Roles live in `profiles`; the legacy `users` table is a stale copy and was
     the reason no admin ever received an in-app alert. */
  const { data, error } = await db().from("profiles").select("id").eq("role", "admin");
  if (error) {
    console.error("[notify] admin lookup failed:", error.message);
    return;
  }
  await Promise.all((data ?? []).map((u) => notify({ ...input, userId: u.id, audience: "admin" })));
}

export async function notifySeller(sellerUserId: string, input: Omit<NotifyInput, "userId" | "audience">) {
  await notify({ ...input, userId: sellerUserId, audience: "seller" });
}

/* --------------------------------- push --------------------------------- */

type PushPayload = { title: string; body: string; link?: string; kind?: string };

async function sendWebPush(userId: string, payload: PushPayload): Promise<void> {
  const { data: subs } = await db()
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const { sendPushToSubscription } = await import("./push");
  await Promise.allSettled(
    subs.map((s) =>
      sendPushToSubscription(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );
}

/* --------------------------------- FCM ---------------------------------- */

async function sendFcm(userId: string, title: string, body: string, data: Record<string, string>) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) return;

  const { data: tokens } = await db().from("fcm_tokens").select("token").eq("user_id", userId);
  if (!tokens?.length) return;

  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens.map((t) => t.token),
      notification: { title, body, sound: "default" },
      data,
      priority: "high",
    }),
  }).catch(() => {});
}

/* -------------------------------- email --------------------------------- */

async function sendEmail(to: string, subject: string, text: string, link?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.info("[email:dev]", { to, subject, text, link });
    return;
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,'Hind Siliguri',sans-serif;background:#111312;padding:28px;color:#e9efe9">
      <div style="max-width:520px;margin:0 auto;background:#171d19;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:26px">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7fd3a5">বিশ্বাস এগ্রো</p>
        <h1 style="margin:0 0 12px;font-size:19px;color:#fff">${subject}</h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#c9d6cc;white-space:pre-line">${text}</p>
        ${
          link
            ? `<a href="${link}" style="display:inline-block;margin-top:20px;background:#1f7a4d;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">এখনই দেখুন →</a>`
            : ""
        }
        <p style="margin:22px 0 0;font-size:11px;color:#6d7c72">খামার থেকে আপনার ঘরে · bishwasagro.com</p>
      </div>
    </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "বিশ্বাস এগ্রো <no-reply@bishwasagro.com>",
      to: [to],
      subject,
      html,
    }),
  });
}

/* ------------------------------ unread count ---------------------------- */

export async function unreadCount(userId: string): Promise<number> {
  const { count } = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

/* --------------------------- ready-made bodies -------------------------- */

export function orderPlacedBody(orderNo: string, total: string, items: number) {
  return {
    title: `নতুন অর্ডার ${orderNo}`,
    body: `${items}টি পণ্য · মোট ${total}`,
  };
}

export function statusChangedBody(orderNo: string, statusBn: string) {
  return {
    title: `${orderNo} — ${statusBn}`,
    body: `আপনার অর্ডারটি এখন "${statusBn}" অবস্থায় আছে।`,
  };
}
