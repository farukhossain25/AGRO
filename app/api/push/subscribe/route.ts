import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, limitGuard, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(5),
  }),
});

/** POST /api/push/subscribe — store (or refresh) this browser's push endpoint. */
export async function POST(req: Request) {
  try {
    const limit = limitGuard(req, "api-push-subscribe", 30, 60_000);
    if (limit) return limit;
    const user = await requireUser();
    const data = schema.parse(await req.json());

    const { data: row, error } = await db()
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          user_agent: req.headers.get("user-agent")?.slice(0, 240) ?? null,
        },
        { onConflict: "endpoint" }
      )
      .select("id")
      .single();

    if (error) throw error;
    return created({ id: row.id, subscribed: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const limit = limitGuard(req, "api-push-subscribe", 30, 60_000);
    if (limit) return limit;
    const user = await requireUser();
    const endpoint = new URL(req.url).searchParams.get("endpoint");
    if (!endpoint) return fail("endpoint দিন", 422);

    await db().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
    return created({ subscribed: false });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("লগইন করুন", 401);
    return handleError(error);
  }
}

/** GET /api/push/subscribe — the public VAPID key the browser needs. */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  return created({ publicKey: key, enabled: Boolean(key) });
}
