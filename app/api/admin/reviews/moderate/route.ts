import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { fail, handleError, ok, requirePermission, sanitizeText } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   PATCH /api/admin/reviews/moderate — hide or restore a review
   --------------------------------------------------------------------------
   Admin may hide (spam/abuse) and restore. Reviews are never hard-deleted, so
   the quality history stays intact for the supplier score.
   ========================================================================== */

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["hide", "restore"]),
  reason: z.string().trim().max(200).optional(),
});

export async function PATCH(req: Request) {
  try {
    const admin = await requirePermission("reviews.moderate");
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const { id, action, reason } = schema.parse(await req.json());
    const client = db();

    const patch =
      action === "hide"
        ? {
            status: "hidden",
            hidden_reason: reason ? sanitizeText(reason, 200) : "অ্যাডমিন কর্তৃক লুকানো হয়েছে",
            hidden_by: admin.id,
            hidden_at: new Date().toISOString(),
          }
        : {
            status: "published",
            hidden_reason: null,
            hidden_by: null,
            hidden_at: null,
          };

    const { data, error } = await client
      .from("order_reviews")
      .update(patch)
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) throw error;

    // recalc the product rollup immediately (trigger also fires, belt & braces)
    const { data: review } = await client
      .from("order_reviews")
      .select("product_id")
      .eq("id", id)
      .maybeSingle();

    if (review?.product_id) {
      await client.rpc("recalc_product_rating", { p_product: review.product_id }).then(
        () => undefined,
        () => undefined
      );
    }

    await client
      .from("audit_logs")
      .insert({
        actor_id: admin.id,
        action: `review.${action}`,
        entity: "order_reviews",
        entity_id: id,
        meta: { reason: reason ?? null },
      })
      .then(
        () => undefined,
        () => undefined
      );

    return ok(data);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
