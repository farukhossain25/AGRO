import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import {
  clientKey,
  created,
  currentUser,
  fail,
  handleError,
  ok,
  rateLimit,
  sanitizeText,
  tooMany,
} from "@/lib/api";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   Complaint thread — customer ↔ seller ↔ admin
   --------------------------------------------------------------------------
   GET  /api/complaints/:id/messages   → the public thread
   POST /api/complaints/:id/messages   → add a reply

   Who may read/write: the ticket owner, the seller it concerns, an admin.
   Internal notes (is_internal) are admin-only and filtered from the thread.
   ========================================================================== */

const schema = z.object({ body: z.string().trim().min(1, "বার্তা লিখুন").max(2000) });

type Ctx = { params: Promise<{ id: string }> };

async function authorise(id: string) {
  const user = await currentUser();
  if (!user) return { error: fail("আগে লগইন করুন", 401) } as const;

  const { data: complaint } = await db()
    .from("complaints")
    .select("id, user_id, seller_id, status, ticket_no")
    .eq("id", id)
    .maybeSingle();

  if (!complaint) return { error: fail("অভিযোগ পাওয়া যায়নি", 404) } as const;

  const isOwner = complaint.user_id === user.id;
  const isAdmin = user.role === "admin";

  let isSeller = false;
  if (complaint.seller_id) {
    const { data: seller } = await db()
      .from("sellers")
      .select("user_id")
      .eq("id", complaint.seller_id)
      .maybeSingle();
    isSeller = seller?.user_id === user.id;
  }

  if (!isOwner && !isAdmin && !isSeller) {
    return { error: fail("এই অভিযোগে আপনার প্রবেশাধিকার নেই", 403) } as const;
  }

  return {
    user,
    complaint,
    role: (isAdmin ? "admin" : isSeller ? "seller" : "customer") as
      | "admin"
      | "seller"
      | "customer",
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await authorise(id);
    if ("error" in auth) return auth.error;

    const { data, error } = await db()
      .from("complaint_messages")
      .select("id, complaint_id, author_role, author_id, body, is_internal, created_at")
      .eq("complaint_id", id)
      .order("created_at");

    if (error) throw error;

    const messages = (data ?? []).filter(
      (m) => !m.is_internal || auth.role === "admin"
    );

    return ok({ messages });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const limited = rateLimit(clientKey(req, "complaint-msg"), 20, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { id } = await ctx.params;
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const auth = await authorise(id);
    if ("error" in auth) return auth.error;

    const { body } = schema.parse(await req.json());
    const text = sanitizeText(body, 2000);
    if (!text) return fail("বার্তা লিখুন", 422);

    const { data: message, error } = await db()
      .from("complaint_messages")
      .insert({
        complaint_id: id,
        author_role: auth.role,
        author_id: auth.user.id,
        body: text,
      })
      .select("id, created_at")
      .single();

    if (error) throw error;

    // a seller or admin reply moves an open ticket to "in review"
    if (auth.role !== "customer" && auth.complaint.status === "open") {
      await db()
        .from("complaints")
        .update({ status: "in_review" })
        .eq("id", id)
        .then(
          () => undefined,
          () => undefined
        );
    }

    // notify the other parties
    try {
      if (auth.role !== "customer") {
        await notify({
          userId: auth.complaint.user_id as string,
          audience: "user",
          kind: "order",
          title: `অভিযোগ #${auth.complaint.ticket_no} এ নতুন উত্তর`,
          body: text.slice(0, 120),
          link: `/account/complaints/${id}`,
          meta: { complaintId: id },
          push: true,
        });
      }

      if (auth.role === "customer") {
        // tell the seller
        if (auth.complaint.seller_id) {
          const { data: seller } = await db()
            .from("sellers")
            .select("user_id")
            .eq("id", auth.complaint.seller_id)
            .maybeSingle();

          if (seller?.user_id) {
            await notify({
              userId: seller.user_id as string,
              audience: "seller",
              kind: "order",
              title: `অভিযোগ #${auth.complaint.ticket_no} — গ্রাহকের বার্তা`,
              body: text.slice(0, 120),
              link: `/seller/complaints`,
              meta: { complaintId: id },
              push: true,
            });
          }
        }
      }
    } catch {
      /* notifications are best-effort */
    }

    return created({ id: message.id, created_at: message.created_at });
  } catch (error) {
    return handleError(error);
  }
}
