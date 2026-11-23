import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import type { TablesInsert } from "@/lib/database.types";
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
import { getComplaintsForUser } from "@/lib/reviews";
import { ADMIN_BASE } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   "সমস্যা জানান" — complaint tickets
   --------------------------------------------------------------------------
   GET  /api/complaints              → the signed-in customer's tickets
   POST /api/complaints              → open a ticket on a delivered item
   POST /api/complaints/:id/messages → (see ./[id]/messages/route.ts)

   Opening a ticket notifies the seller AND every admin immediately.
   ========================================================================== */

const createSchema = z.object({
  orderId: z.string().uuid("সঠিক অর্ডার আইডি দিন"),
  productId: z.string().uuid("সঠিক পণ্য আইডি দিন"),
  problemType: z.enum(["spoiled", "short_weight", "wrong_item", "late", "other"]),
  description: z
    .string()
    .trim()
    .min(5, "সমস্যাটি অন্তত ৫ অক্ষরে লিখুন")
    .max(2000, "বর্ণনা ২০০০ অক্ষরের মধ্যে রাখুন"),
  photos: z.array(z.string().url()).max(3, "সর্বোচ্চ ৩টি ছবি").optional(),
  resolution: z.enum(["refund", "replacement", "inform"]).default("inform"),
});

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("আগে লগইন করুন", 401);
    const items = await getComplaintsForUser(user.id);
    return ok({ items });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "complaint"), 5, 30 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const user = await currentUser();
    if (!user) return fail("অভিযোগ জানাতে আগে লগইন করুন", 401);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const data = createSchema.parse(await req.json());
    const client = db();

    // ---- the order must be the caller's and delivered
    const { data: order } = await client
      .from("orders")
      .select("id, user_id, order_no, status")
      .eq("id", data.orderId)
      .maybeSingle();

    if (!order || order.user_id !== user.id) return fail("এই অর্ডারটি আপনার নয়", 403);

    const { data: line } = await client
      .from("order_items")
      .select("id, product_id, sub_order_id, seller_id, sub_orders(status)")
      .eq("order_id", data.orderId)
      .eq("product_id", data.productId)
      .maybeSingle();

    if (!line) return fail("এই পণ্যটি এই অর্ডারে নেই", 404);

    const subStatus = (line.sub_orders as unknown as { status: string } | null)?.status;
    if (subStatus !== "delivered" && order.status !== "delivered") {
      return fail("ডেলিভারি হওয়ার পরই সমস্যা জানানো যায়", 409);
    }

    // ---- guard against duplicate open tickets for the same item
    const { data: open } = await client
      .from("complaints")
      .select("id, ticket_no")
      .eq("order_id", data.orderId)
      .eq("product_id", data.productId)
      .in("status", ["open", "in_review"])
      .maybeSingle();

    if (open) {
      return fail(
        `এই পণ্যের একটি অভিযোগ আগেই আছে (${open.ticket_no}) — সেটির উত্তরেই যোগাযোগ করুন`,
        409
      );
    }

    const { data: complaint, error } = await client
      .from("complaints")
      .insert(({
        order_id: data.orderId,
        sub_order_id: (line.sub_order_id as string | null) ?? null,
        order_item_id: line.id as string,
        product_id: data.productId,
        seller_id: (line.seller_id as string | null) ?? null,
        user_id: user.id,
        problem_type: data.problemType,
        description: sanitizeText(data.description, 2000),
        photos: (data.photos ?? []).slice(0, 3),
        preferred_resolution: data.resolution,
        status: "open",
      }) as TablesInsert<"complaints">)
      .select("id, ticket_no")
      .single();

    if (error) throw error;

    // opening message so the thread is never empty
    await client
      .from("complaint_messages")
      .insert({
        complaint_id: complaint.id,
        author_role: "customer",
        author_id: user.id,
        body: sanitizeText(data.description, 2000),
      })
      .then(
        () => undefined,
        () => undefined
      );

    await notifyComplaint(complaint.id, complaint.ticket_no as string, data.problemType);

    return created({ id: complaint.id, ticketNo: complaint.ticket_no, status: "open" });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ helper */

const PROBLEM_LABEL: Record<string, string> = {
  spoiled: "পচা/নষ্ট",
  short_weight: "কম ওজন",
  wrong_item: "ভুল পণ্য",
  late: "দেরি",
  other: "অন্যান্য",
};

async function notifyComplaint(complaintId: string, ticketNo: string, problemType: string) {
  try {
    const { data: complaint } = await db()
      .from("complaints")
      .select("seller_id, product_id, order_id, products(name_bn), orders(order_no)")
      .eq("id", complaintId)
      .maybeSingle();

    const name =
      (complaint?.products as unknown as { name_bn: string } | null)?.name_bn ?? "একটি পণ্য";
    const orderNo =
      (complaint?.orders as unknown as { order_no: string } | null)?.order_no ?? "";
    const label = PROBLEM_LABEL[problemType] ?? problemType;

    // seller
    if (complaint?.seller_id) {
      const { data: seller } = await db()
        .from("sellers")
        .select("user_id")
        .eq("id", complaint.seller_id)
        .maybeSingle();

      if (seller?.user_id) {
        await notify({
          userId: seller.user_id as string,
          audience: "seller",
          kind: "order",
          title: `নতুন অভিযোগ — ${label}`,
          body: `${name} · অর্ডার ${orderNo} · টিকিট ${ticketNo}`,
          link: `/seller/complaints`,
          meta: { complaintId, ticketNo },
          push: true,
        });
      }
    }

    // every admin
    const { data: admins } = await db()
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);

    await Promise.all(
      (admins ?? []).map((admin) =>
        notify({
          userId: admin.id as string,
          audience: "admin",
          kind: "order",
          title: `অভিযোগ #${ticketNo} — ${label}`,
          body: `${name} · অর্ডার ${orderNo}`,
          link: `${ADMIN_BASE}/complaints`,
          meta: { complaintId, ticketNo },
          push: true,
        }).catch(() => undefined)
      )
    );
  } catch (error) {
    console.warn("[complaint] notify failed:", (error as Error).message);
  }
}
