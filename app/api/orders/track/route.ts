import { z } from "zod";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  order: z.string().trim().min(4).max(32),
  phone: z.string().trim().min(6).max(20),
});

function normalisePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.slice(-10); // last 10 digits, ignores +88 / 0 prefix differences
}

export async function GET(req: Request) {
  try {
    // Tracking is an enumeration target — keep the window tight.
    const limited = rateLimit(clientKey(req, "track"), 10, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const url = new URL(req.url);
    const { order, phone } = schema.parse({
      order: url.searchParams.get("order") ?? "",
      phone: url.searchParams.get("phone") ?? "",
    });

    const { data, error } = await db()
      .from("orders")
      .select("*, order_items(*)")
      .eq("order_no", order.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) return fail("এই অর্ডার নম্বরে কোনো অর্ডার পাওয়া যায়নি", 404);

    if (normalisePhone(data.customer_phone) !== normalisePhone(phone)) {
      return fail("অর্ডার নম্বর ও মোবাইল নম্বর মিলছে না", 403);
    }

    return ok({ ...data, phone: data.customer_phone, email: data.customer_email });
  } catch (error) {
    return handleError(error);
  }
}
