import { db } from "@/lib/db";
import {
  clientKey,
  currentUser,
  fail,
  handleError,
  ok,
  rateLimit,
  tooMany,
} from "@/lib/api";
import { paymentSubmitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/* ==========================================================================
   POST /api/payments/submit — the customer reports a sent payment
   --------------------------------------------------------------------------
   The customer sends money to the receiving number shown on the payment page,
   then enters their TrxID here. The TrxID + sender number are stored on the
   order's (or subscription's) `payment_ref` column. The owner verifies the
   payment from the admin panel and marks it paid.

   There is no automatic "verified" state: the TrxID is only a report, the
   admin's confirm is the only thing that moves payment_status to paid.
   ========================================================================== */

function normalisePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.slice(-10);
}

/** A TrxID pattern like ^[A-Za-z0-9]{8,12}$ — compiled once, cached per call. */
function trxMatches(pattern: string | null, trx: string): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(trx);
  } catch {
    return true; // a broken pattern must never block a legitimate payment
  }
}

type Target = {
  table: "orders" | "user_subscriptions";
  id: string;
  ref: string | null;
  status: string;
  user_id: string | null;
  /** subscriptions have no phone column — only orders carry one */
  customer_phone?: string | null;
  payment_method: string | null;
};

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "payment-submit"), 6, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = paymentSubmitSchema.parse(await req.json());
    const user = await currentUser().catch(() => null);

    // Resolve the order or subscription the payment belongs to.
    let target: Target | null = null;

    if (body.order_no) {
      const { data, error } = await db()
        .from("orders")
        .select("id, payment_status, user_id, customer_phone, payment_method, payment_ref")
        .eq("order_no", body.order_no.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) return fail("এই অর্ডার নম্বরে কোনো অর্ডার পাওয়া যায়নি", 404);
      target = {
        table: "orders",
        id: data.id,
        ref: data.payment_ref,
        status: data.payment_status,
        user_id: data.user_id,
        customer_phone: data.customer_phone,
        payment_method: data.payment_method,
      };
    } else if (body.sub_no) {
      const { data, error } = await db()
        .from("user_subscriptions")
        .select("id, status, user_id, payment_method, payment_ref")
        .eq("sub_no", body.sub_no.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) return fail("এই সাব নম্বরে কোনো সাবস্ক্রিপশন পাওয়া যায়নি", 404);
      target = {
        table: "user_subscriptions",
        id: data.id,
        ref: data.payment_ref,
        status: data.status,
        user_id: data.user_id,
        payment_method: data.payment_method,
      };
    }

    if (!target) return fail("অর্ডার নম্বর বা সাব নম্বর দিন", 422);

    // Only the owner may report a payment — a logged-in user must own the
    // order/sub; a guest must match the phone it was placed with.
    if (target.user_id) {
      if (!user || user.id !== target.user_id) {
        return fail("এই অর্ডারে পেমেন্ট জমা দেওয়ার অনুমতি আপনার নেই", 403);
      }
    } else {
      const phone = body.sender_number ?? "";
      if (!phone || normalisePhone(target.customer_phone ?? "") !== normalisePhone(phone)) {
        return fail("অর্ডারের মোবাইল নম্বর দিন", 403);
      }
    }

    if (target.status === "paid" || target.status === "active") {
      return fail("এই পেমেন্ট ইতিমধ্যে পরিশোধিত", 409);
    }

    // Validate the TrxID against the method's pattern when one is configured.
    const { data: method } = target.payment_method
      ? await db()
          .from("payment_methods")
          .select("trx_pattern")
          .eq("code", target.payment_method)
          .maybeSingle()
      : { data: null };

    if (method && !trxMatches(method.trx_pattern, body.trx_id)) {
      return fail("TrxID ফরম্যাট ঠিক নয় — নির্দেশনা অনুসরণ করুন", 422);
    }

    const ref = body.sender_number
      ? `${body.trx_id} | ${body.sender_number}`
      : body.trx_id;

    const updated = await db()
      .from(target.table)
      .update({ payment_ref: ref, updated_at: new Date().toISOString() })
      .eq("id", target.id)
      .select(target.table === "orders" ? "id, order_no, payment_status, payment_ref" : "id, sub_no, status, payment_ref")
      .single();

    const { error: updateError } = updated;
    if (updateError) throw updateError;

    return ok({
      ref: updated.data,
      message: "TrxID জমা দেওয়া হয়েছে — অ্যাডমিন যাচাই করবেন",
    });
  } catch (error) {
    return handleError(error);
  }
}
