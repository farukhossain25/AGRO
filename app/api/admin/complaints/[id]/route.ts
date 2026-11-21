import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { currentUser, fail, handleError, ok, sanitizeText } from "@/lib/api";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   PATCH /api/admin/complaints/:id — move a ticket through its lifecycle
   --------------------------------------------------------------------------
   Open → In review → Resolved / Rejected.

   * Both admins and the seller the ticket concerns may update status.
   * Only an admin may reject or reopen.
   * Resolving always requires a resolution note, which is posted into the
     thread so the customer sees the outcome and the reason.
   ========================================================================== */

const schema = z.object({
  status: z.enum(["in_review", "resolved", "rejected", "open"]),
  resolution: z.enum(["refund", "replacement", "inform", "none"]).optional(),
  note: z.string().trim().max(2000).optional(),
  internal: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await currentUser();
    if (!user) return fail("আগে লগইন করুন", 401);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const { id } = await ctx.params;
    const data = schema.parse(await req.json());
    const client = db();

    const { data: complaint } = await client
      .from("complaints")
      .select("id, user_id, seller_id, status, ticket_no, order_id")
      .eq("id", id)
      .maybeSingle();

    if (!complaint) return fail("অভিযোগ পাওয়া যায়নি", 404);

    const isAdmin = user.role === "admin";
    let isSeller = false;

    if (complaint.seller_id) {
      const { data: seller } = await client
        .from("sellers")
        .select("user_id")
        .eq("id", complaint.seller_id)
        .maybeSingle();
      isSeller = seller?.user_id === user.id;
    }

    if (!isAdmin && !isSeller) return fail("এই কাজটি করার অনুমতি নেই", 403);

    // sellers may not reject, reopen, or post internal notes
    if (!isAdmin && (data.status === "rejected" || data.status === "open")) {
      return fail("শুধু অ্যাডমিন অভিযোগ বাতিল বা পুনরায় খুলতে পারেন", 403);
    }

    // a closing move must be explained
    if ((data.status === "resolved" || data.status === "rejected") && !data.note) {
      return fail("সমাধান বা বাতিল করার কারণ লিখুন", 422);
    }

    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    if (data.status === "resolved") {
      patch.resolution = data.resolution ?? "inform";
      patch.resolved_by = user.id;
      patch.resolved_at = new Date().toISOString();
    }
    if (data.status === "rejected") {
      patch.rejected_by = user.id;
      patch.rejected_at = new Date().toISOString();
    }
    if (data.status === "open") {
      patch.resolved_by = null;
      patch.resolved_at = null;
      patch.rejected_by = null;
      patch.rejected_at = null;
      patch.resolution = null;
    }

    const { error } = await client.from("complaints").update(patch).eq("id", id);
    if (error) throw error;

    // drop the decision into the thread so it is visible to the customer
    if (data.note) {
      await client
        .from("complaint_messages")
        .insert({
          complaint_id: id,
          author_role: isAdmin ? "admin" : "seller",
          author_id: user.id,
          body: sanitizeText(data.note, 2000),
          is_internal: Boolean(data.internal) && isAdmin,
        })
        .then(
          () => undefined,
          () => undefined
        );
    }

    // audit trail
    if (isAdmin) {
      await client
        .from("audit_logs")
        .insert({
          actor_id: user.id,
          action: `complaint.${data.status}`,
          entity: "complaints",
          entity_id: id,
          meta: { from: complaint.status, resolution: data.resolution ?? null },
        })
        .then(
          () => undefined,
          () => undefined
        );
    }

    // tell the customer whenever the status actually changes
    if (complaint.status !== data.status && !data.internal) {
      const titles: Record<string, string> = {
        open: "আপনার অভিযোগ পুনরায় খোলা হয়েছে",
        in_review: "আপনার অভিযোগ পর্যালোচনায় আছে",
        resolved: "আপনার অভিযোগ সমাধান হয়েছে",
        rejected: "আপনার অভিযোগ বাতিল হয়েছে",
      };

      await notify({
        userId: complaint.user_id as string,
        audience: "user",
        kind: "order",
        title: titles[data.status] ?? "অভিযোগের অবস্থা বদলেছে",
        body: `টিকিট #${complaint.ticket_no}${data.note ? ` — ${data.note.slice(0, 100)}` : ""}`,
        link: `/account/complaints/${id}`,
        meta: { complaintId: id, status: data.status },
        push: true,
      }).catch(() => undefined);
    }

    return ok({ id, status: data.status });
  } catch (error) {
    return handleError(error);
  }
}
