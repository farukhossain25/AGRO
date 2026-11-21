import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().uuid(), is_approved: z.coerce.boolean() });

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const { id, is_approved } = schema.parse(await req.json());

    const { data, error } = await db()
      .from("reviews")
      .update({ is_approved })
      .eq("id", id)
      .select("id, is_approved")
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await db().from("reviews").delete().eq("id", id);
    if (error) throw error;
    return ok({ id, deleted: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}
