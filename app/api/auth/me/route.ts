import { currentUser, ok } from "@/lib/api";
import { getOrdersForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return ok(null);

  const orders = await getOrdersForUser(user.id).catch(() => []);
  return ok({ user, orderCount: orders.length });
}
