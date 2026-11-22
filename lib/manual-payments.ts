/* ==========================================================================
   lib/manual-payments.ts — manual (bKash / Nagad / bank) payment engine
   --------------------------------------------------------------------------
   The automatic gateway flow is replaced by: customer sends money to the
   receiving number, submits the TrxID, an admin verifies it. This file holds
   everything both halves share — validation, the anti-fraud rules, and the
   single function that is allowed to say "verified".

   Invariants (do not weaken these):
     1. `status` is only ever written by `decidePayment()` running as the
        service role, or by the customer re-submitting evidence (which forces
        the row back to `pending`). A client can never approve itself.
     2. A TrxID is globally unique on `trx_norm`. One receipt clears one thing.
     3. `expected_amount` is snapshotted at submission and never re-read from
        the order, so repricing an order later cannot retro-approve a shortfall.
     4. Approving is the ONLY path that marks an order paid or activates a
        premium plan, and it is idempotent.
   ========================================================================== */

import { db } from "./db";
import { notify } from "./notify";
import type { Order, PaymentMethodRow, PaymentRow, PremiumSubscription } from "./types";
import { ADMIN_BASE } from "@/lib/paths";

/* ------------------------------------------------------------- normalising */

/**
 * Canonical form for a TrxID. bKash shows `8N7A2K4L`, Nagad `8N7A2K4L9P`,
 * banks are messier. We compare on uppercase alphanumerics only, so
 * `8n7a-2k 4l` and `8N7A2K4L` are the same receipt (and collide as they must).
 */
export function normaliseTrx(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40);
}

/** Bangladeshi mobile number → `01XXXXXXXXX`, or null when it cannot be one. */
export function normaliseBdPhone(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("880") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("0") && digits.length === 11) return digits;
  if (digits.length === 10 && /^1[3-9]/.test(digits)) return `0${digits}`;
  return null;
}

export function isValidBdPhone(input: string): boolean {
  return normaliseBdPhone(input) !== null;
}

/** Operator prefix → which wallets this number could belong to (nagad vs bkash). */
export function guessOperator(phone: string): "bkash" | "nagad" | "rocket" | "other" {
  const digits = normaliseBdPhone(phone) ?? phone;
  if (!/^01[3-9]/.test(digits)) return "other";
  // These are nominal — both bKash and Nagad issue on most prefixes now, so
  // this is a display hint only. Never use it to accept or reject a payment.
  const prefix = digits.slice(0, 3);
  if (["017", "013"].includes(prefix)) return "bkash";
  if (prefix === "016" || prefix === "018") return "nagad";
  if (prefix === "019") return "rocket";
  return "other";
}

/** Default TrxID shape when a method does not define its own pattern. */
const DEFAULT_TRX = /^[A-Z0-9]{6,40}$/;

export function trxMatches(method: Pick<PaymentMethodRow, "trx_pattern"> | null, trx: string): boolean {
  const norm = normaliseTrx(trx);
  if (!norm) return false;
  if (!method?.trx_pattern) return DEFAULT_TRX.test(norm);
  try {
    return new RegExp(method.trx_pattern).test(norm);
  } catch {
    // A bad pattern in the admin panel must not lock customers out.
    return DEFAULT_TRX.test(norm);
  }
}

/* --------------------------------------------------------------- anti-fraud */

export type PaymentRules = {
  max_submits_per_hour: number;
  max_rejected_before_block: number;
  block_hours: number;
  auto_trx_regex: boolean;
};

const DEFAULT_RULES: PaymentRules = {
  max_submits_per_hour: 5,
  max_rejected_before_block: 3,
  block_hours: 24,
  auto_trx_regex: true,
};

export async function getPaymentRules(): Promise<PaymentRules> {
  try {
    const { data } = await db().from("settings").select("value").eq("key", "payments").maybeSingle();
    return { ...DEFAULT_RULES, ...((data?.value as Partial<PaymentRules>) ?? {}) };
  } catch {
    return DEFAULT_RULES;
  }
}

export type SubmitVerdict =
  | { allowed: true; attemptNo: number }
  | { allowed: false; reason: string; retryAfter?: number };

/**
 * Decides whether this customer may submit another payment right now.
 * Three separate limits, cheapest first:
 *   • too many submissions in the last hour (flooding)
 *   • too many rejections in the block window (repeated bogus receipts)
 *   • the same target already has a pending claim (double-submit)
 */
export async function checkSubmitAllowed(
  userId: string,
  target: { orderId?: string | null; subscriptionId?: string | null }
): Promise<SubmitVerdict> {
  const rules = await getPaymentRules();
  const client = db();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

  const { count: recent } = await client
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgo);

  if ((recent ?? 0) >= rules.max_submits_per_hour) {
    return {
      allowed: false,
      reason: "এক ঘণ্টায় অনেকবার পেমেন্ট জমা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      retryAfter: 900,
    };
  }

  if (target.orderId || target.subscriptionId) {
    const query = client
      .from("payments")
      .select("id")
      .eq("status", "pending")
      .eq("user_id", userId)
      .limit(1);

    const { data: open } = target.orderId
      ? await query.eq("order_id", target.orderId)
      : await query.eq("subscription_id", target.subscriptionId!);

    if (open?.length) {
      return { allowed: false, reason: "এই অর্ডারের একটি পেমেন্ট এখনো যাচাইয়ের অপেক্ষায় আছে।" };
    }
  }

  const blockFrom = new Date(Date.now() - rules.block_hours * 3_600_000).toISOString();
  const { count: rejected } = await client
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "rejected")
    .gte("created_at", blockFrom);

  if ((rejected ?? 0) >= rules.max_rejected_before_block) {
    return {
      allowed: false,
      reason: `${rules.block_hours} ঘণ্টায় ${rules.max_rejected_before_block}টি পেমেন্ট বাতিল হয়েছে। অস্থায়ীভাবে জমা বন্ধ আছে — হটলাইনে যোগাযোগ করুন।`,
    };
  }

  const { count: total } = await client
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return { allowed: true, attemptNo: (total ?? 0) + 1 };
}

/* ---------------------------------------------------------------- numbering */

export function paymentNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `PM-${stamp}${rand}`;
}

/* -------------------------------------------------------------- data access */

export async function getActiveMethods(includeInactive = false): Promise<PaymentMethodRow[]> {
  let query = db().from("payment_methods").select("*").order("sort_order", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PaymentMethodRow[];
}

export async function getMethodByCode(code: string): Promise<PaymentMethodRow | null> {
  const { data, error } = await db()
    .from("payment_methods")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentMethodRow | null) ?? null;
}

/**
 * Resolves what the customer is paying for and how much. Always recomputed on
 * the server: the browser's `amount` is only ever compared, never trusted.
 */
export async function resolveTarget(params: {
  userId: string;
  orderNo?: string;
  subNo?: string;
}): Promise<
  | {
      ok: true;
      purpose: "order" | "premium";
      order: Order | null;
      subscription: PremiumSubscription | null;
      expected: number;
      alreadyPaid: boolean;
    }
  | { ok: false; status: number; message: string }
> {
  const client = db();

  if (params.orderNo) {
    const { data: order } = await client
      .from("orders")
      .select("*")
      .eq("order_no", params.orderNo.toUpperCase())
      .maybeSingle();

    if (!order) return { ok: false, status: 404, message: "অর্ডার পাওয়া যায়নি" };
    if (order.user_id && order.user_id !== params.userId) {
      return { ok: false, status: 403, message: "এই অর্ডারের জন্য আপনার অনুমতি নেই" };
    }
    const paid = ["paid", "verified"].includes(String(order.payment_status));
    return {
      ok: true,
      purpose: "order",
      order: order as Order,
      subscription: null,
      expected: Number(order.total),
      alreadyPaid: paid || ["cancelled", "returned"].includes(String(order.status)),
    };
  }

  if (params.subNo) {
    const { data: sub } = await client
      .from("premium_subscriptions")
      .select("*")
      .eq("sub_no", params.subNo.toUpperCase())
      .maybeSingle();

    if (!sub) return { ok: false, status: 404, message: "সাবস্ক্রিপশন পাওয়া যায়নি" };
    if (sub.user_id !== params.userId) {
      return { ok: false, status: 403, message: "এই সাবস্ক্রিপশনের জন্য আপনার অনুমতি নেই" };
    }
    return {
      ok: true,
      purpose: "premium",
      order: null,
      subscription: sub as PremiumSubscription,
      expected: Number(sub.amount),
      alreadyPaid: sub.status === "active",
    };
  }

  return { ok: false, status: 422, message: "অর্ডার নম্বর অথবা সাবস্ক্রিপশন নম্বর দিন" };
}

export async function getPaymentByNo(paymentNo: string): Promise<PaymentRow | null> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("payment_no", paymentNo.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentRow | null) ?? null;
}

export async function getPaymentsForUser(userId: string, limit = 30): Promise<PaymentRow[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PaymentRow[];
}

export type PaymentTimelineStep = {
  key: "submitted" | "reviewing" | "verified" | "rejected" | "needs_info";
  labelBn: string;
  at: string | null;
  done: boolean;
};

/**
 * The four-step story shown to the customer. Deliberately simple: "জমা হয়েছে
 * → যাচাই চলছে → ভেরিফাইড". A rejection replaces the last two steps.
 */
export function buildTimeline(payment: PaymentRow): PaymentTimelineStep[] {
  const submitted = payment.created_at ?? null;
  const reviewed = payment.reviewed_at ?? null;
  const isVerified = payment.status === "verified";
  const isRejected = payment.status === "rejected";

  return [
    { key: "submitted", labelBn: "পেমেন্ট জমা হয়েছে", at: submitted, done: true },
    {
      key: "reviewing",
      labelBn: "যাচাই চলছে",
      at: submitted,
      done: true,
    },
    {
      key: "verified",
      labelBn: isRejected ? "বাতিল হয়েছে" : "ভেরিফাইড",
      at: reviewed,
      done: isVerified || isRejected,
    },
  ];
}

/* ============================================================================
   decidePayment — the only function allowed to change a payment's verdict.
   ----------------------------------------------------------------------------
   Runs with the service role because it also writes the order / subscription
   side-effects, which the customer must never be able to trigger.
   ========================================================================== */

export type Decision = "verified" | "rejected" | "needs_info";

export type DecisionInput = {
  paymentId: string;
  decision: Decision;
  reason?: string | null;
  adminNote?: string | null;
  actor: { id: string; role: string; name?: string | null };
  ip?: string | null;
  via?: "single" | "bulk";
};

export type DecisionResult =
  | { ok: true; payment: PaymentRow; effects: string[] }
  | { ok: false; status: number; message: string };

export async function decidePayment(input: DecisionInput): Promise<DecisionResult> {
  const client = db();

  const { data: payment, error } = await client
    .from("payments")
    .select("*")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (error) throw error;
  if (!payment) return { ok: false, status: 404, message: "পেমেন্ট পাওয়া যায়নি" };

  const row = payment as PaymentRow;

  if (row.status === input.decision) {
    return { ok: true, payment: row, effects: [] }; // idempotent
  }
  if (row.status === "verified" && input.decision !== "verified") {
    return { ok: false, status: 409, message: "ভেরিফাইড পেমেন্ট আর বদলানো যাবে না" };
  }
  if (input.decision === "rejected" && !input.reason?.trim()) {
    return { ok: false, status: 422, message: "বাতিলের কারণ লিখুন" };
  }

  // ---- guard: a second receipt claiming the same TrxID may not be approved.
  if (input.decision === "verified" && row.trx_norm) {
    const { data: clash } = await client
      .from("payments")
      .select("payment_no")
      .eq("trx_norm", row.trx_norm)
      .eq("status", "verified")
      .neq("id", row.id)
      .limit(1);

    if (clash?.length) {
      return {
        ok: false,
        status: 409,
        message: `এই TrxID আগে অন্য পেমেন্টে (${clash[0].payment_no}) ব্যবহার হয়েছে`,
      };
    }
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await client
    .from("payments")
    .update({
      status: input.decision,
      reject_reason: input.decision === "rejected" ? input.reason?.trim() : null,
      admin_note: input.adminNote?.trim() || null,
      reviewed_by: input.actor.id,
      reviewed_at: now,
    })
    .eq("id", row.id)
    .select()
    .single();

  if (updateError) throw updateError;
  const next = updated as PaymentRow;

  const effects: string[] = [];

  // ---- side effects only on approval
  if (input.decision === "verified") {
    if (row.purpose === "order" && row.order_id) {
      const applied = await settleOrder(row.order_id, row.payment_no, next.amount);
      if (applied) effects.push(...applied);
    } else if (row.purpose === "premium" && row.subscription_id) {
      const applied = await activatePremium(row.subscription_id, row.payment_no);
      if (applied) effects.push(...applied);
    }
  }

  // ---- append-only trail
  await client.from("payment_logs").insert({
    payment_id: row.id,
    actor_id: input.actor.id,
    actor_role: input.actor.role,
    action:
      input.decision === "verified"
        ? input.via === "bulk"
          ? "bulk_approved"
          : "approved"
        : input.decision === "rejected"
          ? "rejected"
          : "needs_info",
    from_status: row.status,
    to_status: input.decision,
    note: input.reason?.trim() || input.adminNote?.trim() || null,
    ip: input.ip ?? null,
  });

  // ---- the mirror table the audit screen reads
  await client
    .from("audit_logs")
    .insert({
      actor_id: input.actor.id,
      actor_role: input.actor.role,
      action: `payment.${input.decision}`,
      entity: "payments",
      entity_id: row.id,
      meta: {
        payment_no: row.payment_no,
        trx: row.trx_norm,
        amount: row.amount,
        via: input.via ?? "single",
        ip: input.ip ?? null,
      },
    })
    .then(() => null, () => null);

  // ---- tell the customer
  const verdictBn =
    input.decision === "verified"
      ? "পেমেন্ট ভেরিফাইড হয়েছে ✅"
      : input.decision === "rejected"
        ? "পেমেন্ট বাতিঘোষিত হয়েছে ❌"
        : "পেমেন্টে আরও তথ্য দরকার";

  await notify({
    userId: row.user_id,
    kind: "payment",
    title: `${verdictBn} — ${row.payment_no}`,
    body:
      input.decision === "rejected"
        ? input.reason?.trim() || "TrxID মেলেনি। সঠিক তথ্য দিয়ে আবার জমা দিন।"
        : input.decision === "needs_info"
          ? "স্ক্রিনশট বা TrxID আবার যাচাই করে জমা দিন।"
          : `৳${row.amount} নিশ্চিত হয়েছে${effects.length ? ` — ${effects.join(", ")}` : ""}`,
    link: `/payment/status/${row.payment_no}`,
    phone: row.sender_number,
  }).catch(() => null);

  return { ok: true, payment: next, effects };
}

/** Marks the order paid and pushes it into the seller/parcel flow. */
async function settleOrder(orderId: string, paymentNo: string, amount: number): Promise<string[]> {
  const client = db();
  const effects: string[] = [];

  const { data: order } = await client
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return effects;

  const { error } = await client
    .from("orders")
    .update({
      payment_status: "paid",
      status: order.status === "received" ? "confirmed" : order.status,
      payment_ref: paymentNo,
    })
    .eq("id", orderId)
    .neq("payment_status", "paid");

  // `neq` makes the write a no-op when it was already paid — the effects below
  // still run, but each is idempotent on its own.
  if (error) throw error;
  effects.push(`অর্ডার #${order.order_no} পরিশোধিত`);

  // Parcel + seller fan-out. The parcel already exists (created at checkout),
  // so this only needs to unblock it.
  await client
    .from("parcels")
    .update({ status: "ready" })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .then(() => null, () => null);

  await notify({
    userId: order.user_id,
    kind: "order",
    title: `অর্ডার #${order.order_no} নিশ্চিত হয়েছে`,
    body: "পেমেন্ট ভেরিফাইড। এখন প্যাকিং শুরু হচ্ছে।",
    link: `/track?order=${order.order_no}`,
    phone: order.phone,
  }).catch(() => null);

  await notifyAdminsOfPayment(order.order_no, amount).catch(() => null);

  return effects;
}

/** Activates a premium subscription and issues an access code. */
async function activatePremium(subscriptionId: string, paymentNo: string): Promise<string[]> {
  const client = db();
  const effects: string[] = [];

  const { data: sub } = await client
    .from("premium_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!sub) return effects;

  const now = new Date();

  /* Term comes from the plan the customer bought — basic/full monthly are 30
     days, half-yearly 182, yearly 365. (The previous hard-coded 30 days gave a
     ৳2,899 yearly customer a single month.) Fall back to 30 only if the plan
     row is missing, so a deleted plan cannot leave a sub with no expiry. */
  const { data: plan } = await client
    .from("premium_plans")
    .select("duration_days")
    .eq("id", sub.plan_id)
    .maybeSingle();
  const durationDays = Number(plan?.duration_days) > 0 ? Number(plan?.duration_days) : 30;

  const base = sub.expires_at && new Date(sub.expires_at) > now ? new Date(sub.expires_at) : now;
  const expires = new Date(base.getTime() + durationDays * 86_400_000);

  await client
    .from("premium_subscriptions")
    .update({
      status: "active",
      payment_ref: paymentNo,
      started_at: sub.started_at ?? now.toISOString(),
      expires_at: expires.toISOString(),
    })
    .eq("id", subscriptionId);

  if (sub.user_id) {
    await client
      .from("users")
      .update({ role: "premium", premium_until: expires.toISOString() })
      .eq("id", sub.user_id)
      .neq("role", "admin");
  }

  // Premium access code — lets the customer sign in on the Android app.
  const code = generateCode();
  const { error: codeError } = await client.from("premium_access_codes").insert({
    code,
    plan_id: sub.plan_id,
    user_id: sub.user_id,
    status: "unused",
    expires_at: expires.toISOString(),
    meta: { issued_for: paymentNo, sub_no: sub.sub_no },
  });

  effects.push(`প্রিমিয়াম সক্রিয় (${sub.plan_name_bn})`);
  if (!codeError) effects.push(`অ্যাক্সেস কোড ${code}`);

  await notify({
    userId: sub.user_id,
    kind: "premium",
    title: "প্রিমিয়াম সক্রিয় হয়েছে ✅",
    body: codeError
      ? `${sub.plan_name_bn} — ${expires.toISOString().slice(0, 10)} পর্যন্ত`
      : `${sub.plan_name_bn} — অ্যাক্সেস কোড: ${code}`,
    link: "/live",
  }).catch(() => null);

  return effects;
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4).join(""), chars.slice(4, 8).join(""), chars.slice(8, 12).join("")].join("-");
}

async function notifyAdminsOfPayment(orderNo: string, amount: number) {
  const { notifyAdmins } = await import("./notify");
  await notifyAdmins({
    kind: "order",
    title: `পেমেন্ট ভেরিফাইড — #${orderNo}`,
    body: `৳${amount} নিশ্চিত হয়েছে, প্যাকিংয়ের জন্য প্রস্তুত`,
    link: `${ADMIN_BASE}/orders`,
  });
}

/* ------------------------------------------------------- reconciliation CSV */

export type ReconciliationRow = {
  day: string;
  method_code: string;
  verified_count: number;
  verified_amount: number;
  rejected_count: number;
  pending_count: number;
};

export async function getReconciliation(days = 14): Promise<ReconciliationRow[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("v_payment_reconciliation")
    .select("*")
    .gte("day", since);
  if (error) throw error;
  return (data ?? []) as ReconciliationRow[];
}

/** RFC-4180 CSV with a BOM so Excel opens Bangla correctly. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const head = columns.map(escape).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(",")).join("\n");
  return `\uFEFF${head}\n${body}\n`;
}
