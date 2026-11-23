import { db, isUniqueViolation } from "@/lib/db";
import { clientKey, created, handleError, rateLimit, tooMany } from "@/lib/api";
import { newsletterSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "newsletter"), 5, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { email } = newsletterSchema.parse(await req.json());

    const { error } = await db().from("newsletter_subscribers").insert({ email });

    if (error) {
      if (isUniqueViolation(error)) return created({ email, already: true });
      throw error;
    }

    return created({ email, already: false });
  } catch (error) {
    return handleError(error);
  }
}
