import { db } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { paymentDecisionSchema } from "@/lib/validation";
import { decidePayment, getReconciliation, toCsv } from "@/lib/manual-payments";
import type { PaymentQueueRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/payments — the verification queue
   --------------------------------------------------------------------------
   GET   list with filters (+ ?format=csv for the reconciliation export)
   POST  approve / reject / request-more-info, singly or in bulk
   PATCH re-open a rejected payment so the customer may submit again

   Every write requires `payments.verify`, which only the admin role holds
   (lib/permissions.ts). The database enforces the same thing twice: the
   `payments_admin_update` policy and the column-level GRANT that keeps `status`
   out of reach for `authenticated`.
   ========================================================================== */

const FILTERABLE_STATUS = new Set(["pending", "verified", "rejected", "needs_info"]);

export async function GET(req: Request) {
  try {
    await requirePermission("payments.verify");

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "pending";
    const method = url.searchParams.get("method");
    const search = url.searchParams.get("q")?.trim();
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const format = url.searchParams.get("format");

    /* Reconciliation export is a different shape entirely. */
    if (format === "csv") {
      const days = Number(url.searchParams.get("days") ?? 14);
      const rows = await getReconciliation(Number.isFinite(days) ? days : 14);
      const csv = toCsv(rows as unknown as Record<string, unknown>[], [
        "day",
        "method_code",
        "verified_count",
        "verified_amount",
        "rejected_count",
        "pending_count",
      ]);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="payment-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    let query = db().from("v_payment_queue").select("*");

    if (status !== "all" && FILTERABLE_STATUS.has(status))
      query = query.eq("status", status as "pending" | "verified" | "rejected" | "needs_info");
    if (method && method !== "all") query = query.eq("method_code", method);
    if (from) query = query.gte("created_at", new Date(from).toISOString());
    if (to) query = query.lte("created_at", new Date(`${to}T23:59:59`).toISOString());

    if (search) {
      // PostgREST `or` takes a comma-separated filter list; the search term is
      // escaped so a comma or parenthesis in a TrxID cannot rewrite the query.
      const safe = search.replace(/[,()*]/g, "").slice(0, 40);
      if (safe) {
        query = query.or(
          [
            `trx_id.ilike.%${safe}%`,
            `sender_number.ilike.%${safe}%`,
            `payment_no.ilike.%${safe}%`,
            `order_no.ilike.%${safe}%`,
            `customer_phone.ilike.%${safe}%`,
            `customer_name.ilike.%${safe}%`,
          ].join(",")
        );
      }
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("status", { ascending: true })
      .limit(300);

    if (error) throw error;

    const rows = (data ?? []) as PaymentQueueRow[];
    return ok({
      rows,
      counts: {
        pending: rows.filter((r) => r.status === "pending").length,
        needs_info: rows.filter((r) => r.status === "needs_info").length,
        verified: rows.filter((r) => r.status === "verified").length,
        rejected: rows.filter((r) => r.status === "rejected").length,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("payments.verify");
    const { ids, decision, reason, adminNote } = paymentDecisionSchema.parse(await req.json());

    if (decision === "rejected" && !reason?.trim()) {
      return fail("বাতিলের কারণ লিখুন — গ্রাহক এটি দেখতে পাবেন", 422, { reason: "কারণ দিন" });
    }

    const ip = clientIp(req);
    const via = ids.length > 1 ? "bulk" : "single";
    const results: { id: string; ok: boolean; message?: string }[] = [];

    for (const id of ids) {
      const result = await decidePayment({
        paymentId: id,
        decision,
        reason,
        adminNote,
        actor: { id: actor.id, role: actor.role, name: actor.name },
        ip,
        via,
      });

      results.push(
        result.ok
          ? { id, ok: true, message: result.effects.join(" · ") || undefined }
          : { id, ok: false, message: result.message }
      );
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return ok({
      decision,
      succeeded,
      failed: failed.length,
      results,
      message:
        failed.length === 0
          ? `${succeeded}টি পেমেন্ট ${decision === "verified" ? "ভেরিফাই" : "আপডেট"} হয়েছে`
          : `${succeeded}টি সফল, ${failed.length}টি ব্যর্থ`,
    });
  } catch (error) {
    return handleError(error);
  }
}

/** PATCH — re-open a rejected payment so the customer may submit again. */
export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("payments.verify");
    const body = (await req.json()) as { id?: string; note?: string };
    if (!body.id) return fail("আইডি দিন", 422);

    const client = db();
    const { data: current } = await client
      .from("payments")
      .select("status")
      .eq("id", body.id)
      .maybeSingle();

    if (!current) return fail("পেমেন্ট পাওয়া যায়নি", 404);
    if (current.status === "verified") return fail("ভেরিফাইড পেমেন্ট আবার খোলা যায় না", 409);

    const { error } = await client
      .from("payments")
      .update({ status: "needs_info", reject_reason: null, admin_note: body.note?.slice(0, 300) ?? null })
      .eq("id", body.id);

    if (error) throw error;

    await client.from("payment_logs").insert({
      payment_id: body.id,
      actor_id: actor.id,
      actor_role: actor.role,
      action: "reopened",
      from_status: current.status,
      to_status: "needs_info",
      note: body.note?.slice(0, 300) ?? null,
      ip: clientIp(req),
    });

    return ok({ id: body.id, status: "needs_info" });
  } catch (error) {
    return handleError(error);
  }
}
