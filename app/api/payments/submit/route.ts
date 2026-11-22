import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, requireUser } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { paymentSubmitSchema, trxId } from "@/lib/validation";
import {
  checkSubmitAllowed,
  getMethodByCode,
  normaliseBdPhone,
  normaliseTrx,
  paymentNumber,
  resolveTarget,
  trxMatches,
} from "@/lib/manual-payments";
import { notifyAdmins } from "@/lib/notify";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   POST /api/payments/submit
   --------------------------------------------------------------------------
   A customer claims "I sent money, here is the TrxID". This route only ever
   writes a `pending` row — it cannot approve anything. Everything the customer
   could lie about (the total, the verdict) is recomputed or hard-coded here.

   Order of checks matters:
     1. rate limit (per IP, per instance)
     2. session            — anonymous claims are not accepted at all
     3. target ownership   — the order/plan must belong to this customer
     4. method + amount    — the amount must match what is actually owed
     5. TrxID shape        — per method, then global uniqueness
     6. anti-fraud         — repeat rejections, flooding, double-submit
   ========================================================================== */

export async function POST(req: Request) {
  try {
    const limited = limitGuard(req, "payment-submit", 12, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const body = paymentSubmitSchema.parse(await req.json());

    // ---- what are they paying for?
    const target = await resolveTarget({
      userId: user.id,
      orderNo: body.orderNo,
      subNo: body.subNo,
    });
    if (!target.ok) return fail(target.message, target.status);
    if (target.alreadyPaid) {
      return fail("এই অর্ডার/প্ল্যানের পেমেন্ট আগেই সম্পন্ন হয়েছে", 409);
    }

    // ---- method
    const method = await getMethodByCode(body.methodCode);
    if (!method) return fail("পেমেন্ট মাধ্যমটি পাওয়া যায়নি বা বন্ধ আছে", 404);

    if (method.kind === "cod") {
      return fail("ক্যাশ অন ডেলিভারিতে কোনো TrxID লাগে না — শুধু অর্ডার নিশ্চিত করুন", 422);
    }

    // ---- amount must match what is owed (0.5৳ tolerance for gateway rounding)
    if (Math.abs(body.amount - target.expected) > 0.5) {
      return fail(
        `টাকার পরিমাণ মিলছে না — পাঠাতে হবে ৳${target.expected}। আপনি লিখেছেন ৳${body.amount}।`,
        422,
        { amount: "পরিমাণ মেলেনি" }
      );
    }

    if (body.amount < Number(method.min_amount)) {
      return fail(`এই মাধ্যমে সর্বনিম্ন ৳${method.min_amount} পাঠাতে হবে`, 422);
    }
    if (method.max_amount != null && body.amount > Number(method.max_amount)) {
      return fail(`এই মাধ্যমে সর্বোচ্চ ৳${method.max_amount} পাঠানো যায়`, 422);
    }

    // ---- sender number
    let sender: string | null = null;
    if (method.requires_sender) {
      sender = normaliseBdPhone(body.senderNumber ?? "");
      if (!sender) {
        return fail("যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি সঠিকভাবে দিন", 422, {
          senderNumber: "১১ ডিজিটের মোবাইল নম্বর দিন",
        });
      }
    } else if (body.senderNumber) {
      sender = normaliseBdPhone(body.senderNumber) ?? body.senderNumber.slice(0, 20);
    }

    // ---- TrxID
    let trxNorm: string | null = null;
    let trxRaw: string | null = null;
    if (method.requires_trx) {
      const parsed = trxId.safeParse(body.trxId ?? "");
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? "TrxID দিন", 422, { trxId: "TrxID দিন" });
      }
      trxRaw = parsed.data;
      trxNorm = normaliseTrx(parsed.data);

      if (!trxMatches(method, parsed.data)) {
        return fail(
          `এই মাধ্যমের TrxID ফরম্যাট সঠিক নয়${method.trx_pattern ? ` (${method.trx_pattern})` : ""}`,
          422,
          { trxId: "TrxID ফরম্যাট মেলেনি" }
        );
      }

      // Fast pre-check. The UNIQUE index is the real arbiter — this exists so
      // the customer gets a clear message instead of a raw 23505.
      const { data: taken } = await db()
        .from("payments")
        .select("payment_no, status")
        .eq("trx_norm", trxNorm)
        .maybeSingle();

      if (taken) {
        return fail(
          taken.status === "rejected"
            ? "এই TrxID আগে বাতিল হয়েছে — সঠিক TrxID দিন"
            : "এই TrxID আগেই জমা দেওয়া হয়েছে। একটি TrxID শুধু একবার ব্যবহার করা যায়।",
          409,
          { trxId: "TrxID আগেই ব্যবহৃত" }
        );
      }
    }

    // ---- anti-fraud
    const verdict = await checkSubmitAllowed(user.id, {
      orderId: target.order?.id,
      subscriptionId: target.subscription?.id,
    });
    if (!verdict.allowed) {
      return fail(verdict.reason, 429);
    }

    // ---- write it
    const client = db();
    const { data: row, error } = await client
      .from("payments")
      .insert({
        payment_no: paymentNumber(),
        user_id: user.id,
        purpose: target.purpose,
        order_id: target.order?.id ?? null,
        subscription_id: target.subscription?.id ?? null,
        method_id: method.id,
        method_code: method.code,
        method_name_bn: method.name_bn,
        expected_amount: target.expected,
        amount: body.amount,
        sender_number: sender,
        trx_id: trxRaw,
        trx_norm: trxNorm,
        paid_at: body.paidAt ? new Date(body.paidAt).toISOString() : null,
        screenshot_url: body.screenshotPath || null,
        status: "pending",
        submitted_ip: clientIp(req),
        submitted_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        attempt_no: verdict.attemptNo,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique violation on payments_trx_norm_uniq, i.e. a race where
      // two submissions with the same TrxID arrived together.
      if ((error as { code?: string }).code === "23505") {
        return fail("এই TrxID আগেই জমা দেওয়া হয়েছে", 409, { trxId: "TrxID আগেই ব্যবহৃত" });
      }
      throw error;
    }

    await client.from("payment_logs").insert({
      payment_id: row.id,
      actor_id: user.id,
      actor_role: user.role,
      action: "submitted",
      to_status: "pending",
      note: `${method.name_bn} · ৳${body.amount}`,
      ip: clientIp(req),
    });

    // Keep the order honest: it is waiting for verification, not "unpaid".
    if (target.purpose === "order" && target.order) {
      await client
        .from("orders")
        .update({ payment_method: method.code as never, payment_status: "pending" })
        .eq("id", target.order.id)
        .neq("payment_status", "paid");
    }

    notifyAdmins({
      kind: "payment",
      title: `নতুন পেমেন্ট যাচাই — ৳${body.amount}`,
      body: `${method.name_bn} · ${trxNorm ?? "TrxID নেই"} · ${target.order?.order_no ?? target.subscription?.sub_no ?? ""}`,
      link: `${ADMIN_BASE}/payments/${row.id}`,
    }).catch(() => null);

    return created({
      payment_no: row.payment_no,
      id: row.id,
      status: row.status,
      status_url: `/payment/status/${row.payment_no}`,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return fail("পেমেন্ট জমা দিতে লগইন করুন", 401);
    return handleError(error);
  }
}

/* ---- GET: my payments (status page + account history) ------------------- */
export async function GET() {
  try {
    const user = await requireUser();
    const { data, error } = await db()
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return Response.json({ ok: true, data: data ?? [] });
  } catch (error) {
    return handleError(error);
  }
}

/** Re-exported so the route file owns its zod import for tree-shaking clarity. */
export type SubmitBody = z.infer<typeof paymentSubmitSchema>;
