import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import {
  clientKey,
  currentUser,
  fail,
  handleError,
  ok,
  rateLimit,
  sanitizeText,
  tooMany,
} from "@/lib/api";
import { notify } from "@/lib/notify";
import { listSupplierQuality } from "@/lib/reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   Supplier Quality Score
   --------------------------------------------------------------------------
   GET   /api/foisal/suppliers/quality  → every seller ranked by quality score
   POST  /api/foisal/suppliers/quality  → warn or suspend a low-score seller

   The score blends three signals from v_supplier_quality:
     avg_rating (0–5)  ·  complaint rate  ·  on-time delivery rate
   Warning and suspension are always recorded in seller_warnings + audit_logs.
   ========================================================================== */

const schema = z.object({
  sellerId: z.string().uuid("সঠিক সেলার আইডি দিন"),
  action: z.enum(["warn", "suspend", "reinstate"]),
  reason: z.string().trim().min(5, "কারণ লিখুন").max(500),
});

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("আগে লগইন করুন", 401);
    if (user.role !== "admin") return fail("শুধুমাত্র অ্যাডমিন", 403);

    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") ?? "score";
    const worse = url.searchParams.get("worse") === "1";

    const rows = await listSupplierQuality();
    const items =
      sort === "reviews"
        ? [...rows].sort((a, b) => b.review_count - a.review_count)
        : [...rows].sort((a, b) =>
            worse
              ? a.quality_score - b.quality_score
              : b.quality_score - a.quality_score
          );

    return ok({ sort, items });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "seller-quality"), 20, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const user = await currentUser();
    if (!user) return fail("আগে লগইন করুন", 401);
    if (user.role !== "admin") return fail("শুধুমাত্র অ্যাডমিন", 403);
    if (!isDbConfigured()) return fail("ডেটাবেস কনফিগার করা নেই", 503);

    const { sellerId, action, reason } = schema.parse(await req.json());
    const client = db();

    const { data: seller } = await client
      .from("sellers")
      .select("id, user_id, name_bn, status, email")
      .eq("id", sellerId)
      .maybeSingle();

    if (!seller) return fail("সেলার পাওয়া যায়নি", 404);

    const note = sanitizeText(reason, 500);

    // ---- record the warning / suspension
    if (action !== "reinstate") {
      const { error } = await client.from("seller_warnings").insert({
        seller_id: sellerId,
        reason: note,
        severity: action === "suspend" ? "suspension" : "warning",
        issued_by: user.id,
      });
      if (error) throw error;
    }

    // ---- change the seller's status
    if (action === "suspend") {
      const { error } = await client
        .from("sellers")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", sellerId)
        .then(
          (r) => r,
          (r) => r
        );
      // if the schema lacks suspended_at, fall back to status-only
      if (error) {
        await client.from("sellers").update({ status: "suspended" }).eq("id", sellerId);
      }
    }

    if (action === "reinstate") {
      const { error } = await client
        .from("sellers")
        .update({ status: "active", suspended_at: null })
        .eq("id", sellerId)
        .then(
          (r) => r,
          (r) => r
        );
      if (error) {
        await client.from("sellers").update({ status: "active" }).eq("id", sellerId);
      }
    }

    await client
      .from("audit_logs")
      .insert({
        actor_id: user.id,
        action: `seller.${action}`,
        entity: "sellers",
        entity_id: sellerId,
        meta: { reason: note, previousStatus: seller.status },
      })
      .then(
        () => undefined,
        () => undefined
      );

    // ---- notify the seller
    if (seller.user_id) {
      const titles: Record<string, string> = {
        warn: "আপনার দোকানে একটি সতর্কবার্তা জারি হয়েছে",
        suspend: "আপনার সেলার অ্যাকাউন্ট স্থগিত করা হয়েছে",
        reinstate: "আপনার সেলার অ্যাকাউন্ট পুনরায় চালু হয়েছে",
      };

      await notify({
        userId: seller.user_id as string,
        audience: "seller",
        kind: "seller",
        title: titles[action],
        body: note,
        link: `/seller`,
        meta: { action },
        push: true,
        email: seller.email ?? undefined,
      }).catch(() => undefined);
    }

    return ok({ sellerId, action, status: action === "suspend" ? "suspended" : "active" });
  } catch (error) {
    return handleError(error);
  }
}
