import { z } from "zod";
import { db } from "@/lib/db";
import type { TablesInsert } from "@/lib/database.types";
import { clientKey, created, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { subscriptionSchema } from "@/lib/validation";
import { subNumber } from "@/lib/format";
import { getPackages } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "subscribe"), 5, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const data = subscriptionSchema.parse(await req.json());
    const packages = await getPackages();
    const pkg = packages.find((p) => p.id === data.package_id);
    if (!pkg) return fail("প্যাকেজটি পাওয়া যায়নি", 404);

    const user = await currentUser().catch(() => null);

    const { data: sub, error } = await db()
      .from("subscriptions")
      .insert({
        sub_no: subNumber(),
        user_id: user?.id ?? null,
        plan_id: pkg.id,
        package_name: pkg.name_bn,
        customer_name: data.customer_name,
        phone: data.phone,
        division: data.division,
        district: data.district,
        upazila: data.upazila,
        address: data.address,
        members: data.members,
        start_date: data.start_date,
        frequency: data.frequency,
        price_monthly: pkg.price_monthly,
        status: "active",
      } as TablesInsert<"subscriptions">)
      .select("sub_no, package_name, start_date, price_monthly")
      .single();

    if (error) throw error;
    return created(sub);
  } catch (error) {
    return handleError(error);
  }
}

const actionSchema = z.object({
  sub_no: z.string().trim().min(4),
  action: z.enum(["pause", "resume", "cancel"]),
  paused_until: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("লগইন করুন", 401);

    const { sub_no, action, paused_until } = actionSchema.parse(await req.json());

    const { data: sub } = await db()
      .from("subscriptions")
      .select("id, user_id")
      .eq("sub_no", sub_no.toUpperCase())
      .maybeSingle();

    if (!sub) return fail("সাবস্ক্রিপশন পাওয়া যায়নি", 404);
    if (sub.user_id && sub.user_id !== user.id && user.role !== "admin") {
      return fail("অনুমতি নেই", 403);
    }

    const patch =
      action === "pause"
        ? { status: "paused" as const, paused_until: paused_until ?? null }
        : action === "resume"
        ? { status: "active" as const, paused_until: null }
        : { status: "cancelled" as const };

    const { error } = await db().from("subscriptions").update(patch).eq("id", sub.id);
    if (error) throw error;

    return ok({ sub_no, status: patch.status });
  } catch (error) {
    return handleError(error);
  }
}
