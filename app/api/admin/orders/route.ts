import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["received", "packing", "shipped", "delivered", "cancelled"]).optional(),
  payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { id, status, payment_status } = schema.parse(await req.json());

    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (payment_status) patch.payment_status = payment_status;
    if (!Object.keys(patch).length) return fail("আপডেট করার কিছু নেই", 422);

    const { data, error } = await db().from("orders").update(patch).eq("id", id).select("id, status, payment_status").single();
    if (error) throw error;

    return ok(data);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}

/** Order counts + revenue grouped by day, used by the reports page. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const days = Math.min(180, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await db()
      .from("orders")
      .select("id, total, status, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}
