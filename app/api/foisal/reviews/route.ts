import { db, isDbConfigured } from "@/lib/db";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   DELETE /api/foisal/reviews?id= — remove a customer review for good
   --------------------------------------------------------------------------   Reviews publish themselves the moment a customer submits one
   (see /api/reviews and /api/reviews/order); there is no approval step. The
   panel's only tools are hide/restore (/moderate) and this hard delete, for
   spam, abuse or a request from the customer. The row and its photos go; the
   product's rating rollup is recalculated by the trg_reviews_recalc trigger.
   ========================================================================== */

export async function DELETE(req: Request) {
  try {
    const admin = await requirePermission("reviews.moderate");
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const client = db();
    const { data: existing } = await client
      .from("reviews")
      .select("id, product_id, rating, comment, status, author_name, user_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return fail("রিভিউ পাওয়া যায়নি", 404);

    const { error } = await client.from("reviews").delete().eq("id", id);
    if (error) throw error;

    // Belt and braces next to the trigger: keep the product's rating honest.
    if (existing.product_id) {
      await client.rpc("recalc_product_rating", { p_product: existing.product_id }).then(
        () => undefined,
        () => undefined
      );
    }

    await recordAudit({
      actor: admin,
      action: "delete",
      entity: "reviews",
      entityId: id,
      diff: {
        rating: Number(existing.rating),
        comment: existing.comment,
        status: existing.status,
        author_name: existing.author_name,
        product_id: existing.product_id,
      },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ id, deleted: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
