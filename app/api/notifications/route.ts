import { db } from "@/lib/db";
import { fail, handleError, ok, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/notifications?unread=1 — the current user's notification centre. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";

    let q = db()
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("audience", "user")
      .order("created_at", { ascending: false })
      .limit(80);

    if (unreadOnly) q = q.eq("is_read", false);

    const { data, error } = await q;
    if (error) throw error;

    const { count } = await db()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("audience", "user")
      .eq("is_read", false);

    return ok({ items: data ?? [], unread: count ?? 0 });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}

/** PATCH /api/notifications { id } | { all: true } — mark read. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
    const client = db();

    if (body.all) {
      await client
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("audience", "user")
        .eq("is_read", false);
      return ok({ all: true });
    }

    if (!body.id) return fail("আইডি দিন", 422);

    const { error } = await client
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) throw error;
    return ok({ id: body.id });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}
