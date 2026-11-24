import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import type { TablesUpdate } from "@/lib/database.types";
import { fail, handleError, ok, requirePermission, sanitizeText } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   PATCH /api/foisal/reviews/moderate — hide or restore a review
   --------------------------------------------------------------------------
   Admin may hide (spam/abuse) and restore — the reversible tool. A hard
   delete lives at DELETE /api/foisal/reviews for what must really go.
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

    const patch: TablesUpdate<"reviews"> =
      action === "hide"
        ? {
            status: "hidden",
            hidden_reason: reason ? sanitizeText(reason, 200) : "অ্যাডমিন কর্তৃক লুকানো হয়েছে",
          }
        : {
            status: "published",
            hidden_reason: null,
          };

    const { data, error } = await client
      .from("reviews")
      .update(patch)
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) throw error;

    // recalc the product rollup immediately (trigger also fires, belt & braces)
    const { data: review } = await client
      .from("reviews")
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
      .from("audit_log")
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
