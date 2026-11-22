import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "paused", "cancelled"]),
});

export async function PATCH(req: Request) {
  try {
    await requirePermission("orders.read");
    const { id, status } = schema.parse(await req.json());

    const { data, error } = await db()
      .from("subscriptions")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
