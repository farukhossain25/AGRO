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

/**
 * Does the TrxID match the method's configured pattern?
 *
 * This used to return TRUE when the pattern failed to compile, i.e. a typo in
 * the admin panel turned the check off for every customer. Validation that
 * behaves like that is worse than no validation: it reads as enforced. A
 * pattern that does not compile is a configuration error on our side, so the
 * caller treats it as "cannot verify" and refuses — see trxPatternValid().
 */
function trxMatches(pattern: string, trx: string): boolean {
  try {
    return new RegExp(pattern).test(trx);
  } catch {
    return false;
  }
}

/** Compiles the pattern once so the route can distinguish "invalid" from "no match". */
function trxPatternValid(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
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
        .select("id, payment_status, status, user_id, customer_phone, payment_method, payment_ref")
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
        .select("id, status, user_id, payment_method, payment_ref, sub_no")
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

    /* ---- the TrxID must look like a TrxID ---------------------------------
       Two failure modes are fixed here. A pattern that does not compile used
       to switch the check OFF (see trxMatches above) — now it is a loud
       configuration error and the submit is refused, because silently
       accepting an unverifiable reference is exactly the hole. */
    const trx = body.trx_id.trim();

    if (target.payment_method) {
      const { data: method, error: methodError } = await db()
        .from("payment_methods")
        .select("trx_pattern, requires_trx")
        .eq("code", target.payment_method)
        .maybeSingle();
      if (methodError) throw methodError;

      if (method?.requires_trx && !trx) {
        return fail("TrxID দিন", 422);
      }

      if (method?.trx_pattern) {
        if (!trxPatternValid(method.trx_pattern)) {
          console.error(
            "[payments/submit] payment_methods.trx_pattern does not compile:",
            target.payment_method
          );
          return fail("পেমেন্ট যাচাই করা যাচ্ছে না — অ্যাডমিনের সাথে যোগাযোগ করুন", 503);
        }
        if (!trxMatches(method.trx_pattern, trx)) {
          return fail("TrxID ফরম্যাট ঠিক নয় — নির্দেশনা অনুসরণ করুন", 422);
        }
      }
    }

    const ref = body.sender_number ? `${trx} | ${body.sender_number}` : trx;

    /* ---- claim the TrxID --------------------------------------------------
       One TrxID, one order — across orders AND premium subscriptions. The
       claim is a single INSERT against a unique index, so two customers
       submitting the same reference at the same instant cannot both win; the
       loser gets `duplicate` and a clear message.

       This must happen BEFORE payment_ref is written: writing first and
       claiming after would leave a reference on the order that the ledger
       rejects, and the admin would then approve a payment the system already
       knows is reused. */
    const { data: claim, error: claimError } = await db().rpc("payment_claim" as never, {
      p_ref: ref,
      p_kind: target.table === "orders" ? "order" : "subscription",
      p_target: target.id,
      p_user: target.user_id,
    } as never);
    if (claimError) throw claimError;

    const claimResult = claim as { ok: boolean; reason?: string } | null;
    if (!claimResult?.ok) {
      if (claimResult?.reason === "duplicate") {
        return fail(
          "এই TrxID আগেই অন্য একটি অর্ডারে ব্যবহার করা হয়েছে — সঠিক TrxID দিন", 409
        );
      }
      return fail("পেমেন্ট রেকর্ড করা যাচ্ছে না — একটু পরে আবার চেষ্টা করুন", 503);
    }

    /* ---- conditional write ------------------------------------------------
       The status was checked a few lines up, but another request (or the
       admin) can move it in between. Re-asserting "still unpaid" in the same
       UPDATE closes that window: if the order was paid while we were claiming
       the TrxID, this matches zero rows and we say so instead of overwriting
       a confirmed payment with a fresh reported one. */
    /* The "still unpaid" column is NOT the same on the two tables:
         orders              → payment_status  ('pending' | 'paid' | …)
         user_subscriptions  → status          ('pending' | 'active' | …)
       `orders.status` is the DELIVERY status and must not be used here — an
       order sitting at 'packing' would have been treated as unpaid forever. */
    const isOrder = target.table === "orders";

    const query = db()
      .from(target.table)
      .update({ payment_ref: ref, updated_at: new Date().toISOString() })
      .eq("id", target.id);

    const { data: written, error: updateError } = await (isOrder
      ? query
          .in("payment_status", ["pending", "failed"] as const)
          .select("id, order_no, payment_status, payment_ref")
      : query
          .in("status", ["pending"] as const)
          .select("id, sub_no, status, payment_ref")
    ).maybeSingle();

    if (updateError) throw updateError;

    if (!written) {
      return fail("এই পেমেন্ট ইতিমধ্যে পরিশোধিত হয়েছে — নতুন করে জমা দেওয়ার দরকার নেই", 409);
    }

    return ok({
      ref: written,
      message: "TrxID জমা দেওয়া হয়েছে — অ্যাডমিন যাচাই করবেন",
    });
  } catch (error) {
    return handleError(error);
  }
}
