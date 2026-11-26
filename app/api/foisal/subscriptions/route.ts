import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { diffOf, recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/* Status is the everyday action; the rest is a real edit — the owner has to be
   able to fix a wrong phone number or a wrong address on a running
   subscription without touching SQL. Every field is optional so the status
   dropdown stays a one-field request. */
const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  customer_name: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9,10}$/, "ফোন নম্বর ০ দিয়ে শুরু, ১০-১১ ডিজিট")
    .optional(),
  division: z.string().trim().min(2).max(60).optional(),
  district: z.string().trim().min(2).max(60).optional(),
  upazila: z.string().trim().min(2).max(60).optional(),
  address: z.string().trim().min(4).max(400).optional(),
  members: z.coerce.number().int().min(1).max(30).optional(),
  price_monthly: z.coerce.number().min(0).optional(),
  start_date: z.string().trim().optional(),
  paused_until: z.string().trim().nullable().optional(),
  frequency: z.enum(["weekly", "monthly", "yearly"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("orders.read");
    const { id, ...patch } = schema.parse(await req.json());

    if (!Object.keys(patch).length) return fail("বদলানোর কিছু দেওয়া হয়নি", 422);

    /* An empty optional field means "clear it", and the status change must be
       auditable — this row decides whether a family keeps receiving food. */
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      update[key] = value === "" ? null : value;
    }
    update.updated_at = new Date().toISOString();

    const { data: before } = await db()
      .from("subscriptions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await db()
      .from("subscriptions")
      .update(update as never)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    await recordAudit({
      actor,
      action: "update",
      entity: "subscriptions",
      entityId: id,
      diff: diffOf(before as Record<string, unknown> | null, update),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    return ok({ subscription: data });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}

/**
 * DELETE /api/foisal/subscriptions?id=…
 *
 * Removing a subscription is destructive: it is the record of what a family
 * was promised, and it is the reason their wallet credit was granted. The
 * everyday action is `status: cancelled` (PATCH); a hard delete is only for a
 * row created by mistake, so it is restricted to the owner's own role and
 * audited with the whole row it removed.
 */
export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("settings.write");
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("সঠিক id দিন", 422);

    const { data: before } = await db().from("subscriptions").select("*").eq("id", id).maybeSingle();
    if (!before) return fail("সাবস্ক্রিপশন পাওয়া যায়নি", 404);

    const { error } = await db().from("subscriptions").delete().eq("id", id);
    if (error) throw error;

    await recordAudit({
      actor,
      action: "delete",
      entity: "subscriptions",
      entityId: id,
      diff: { deleted: { from: before, to: null } },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    return ok({ deleted: id });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("মুছে ফেলার অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
