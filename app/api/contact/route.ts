import { db } from "@/lib/db";
import { clientKey, created, handleError, rateLimit, sanitizeText, tooMany } from "@/lib/api";
import { contactSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "contact"), 4, 15 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const data = contactSchema.parse(await req.json());

    const { error } = await db().from("contact_messages").insert({
      name: sanitizeText(data.name, 80),
      email: data.email || null,
      phone: sanitizeText(data.phone ?? "", 20) || null,
      message: sanitizeText(data.message, 1200),
    });

    if (error) throw error;
    return created({ received: true });
  } catch (error) {
    return handleError(error);
  }
}
