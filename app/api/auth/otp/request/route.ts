import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { setOtp } from "@/lib/otp-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "otp_req"), 5, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = (await req.json().catch(() => ({}))) as { phone?: string };
    const phone = body.phone?.trim();
    if (!phone || phone.length < 6) {
      return fail("সঠিক ফোন নম্বর দিন", 400);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    setOtp(phone, code);

    // Return devCode in non-production so testing/demo works without an SMS gateway
    const isProd = process.env.NODE_ENV === "production";
    return ok({ sent: true, ...(isProd ? {} : { devCode: code }) });
  } catch (err) {
    return handleError(err);
  }
}
