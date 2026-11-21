import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { otpRequestSchema } from "@/lib/validation";
import { sendSms, isSmsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

/**
 * Issues a 6-digit OTP for phone login.
 * - Codes are stored hashed (bcrypt) in otp_codes.
 * - Max 3 live codes per phone; older ones are invalidated.
 * - When no SMS provider is configured, the code is returned in dev only.
 */
export async function POST(req: Request) {
  try {
    const ipLimit = rateLimit(clientKey(req, "otp-req"), 6, 10 * 60_000);
    if (!ipLimit.ok) return tooMany(ipLimit.retryAfter);

    const { phone } = otpRequestSchema.parse(await req.json());

    const phoneLimit = rateLimit(`otp-phone:${phone}`, 3, 10 * 60_000);
    if (!phoneLimit.ok) return tooMany(phoneLimit.retryAfter);

    // invalidate previous open codes for this phone
    await db()
      .from("otp_codes")
      .update({ consumed: true })
      .eq("phone", phone)
      .eq("consumed", false);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await bcrypt.hash(code, 10);
    const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();

    const { error } = await db().from("otp_codes").insert({
      phone,
      code_hash,
      purpose: "login",
      expires_at,
    });

    if (error) throw error;

    const sms = await sendSms(
      phone,
      `বিশ্বাস এগ্রো: আপনার লগইন কোড ${code}। ৫ মিনিটের মধ্যে ব্যবহার করুন। কাউকে দেবেন না।`
    );

    const exposeCode = !sms.sent && process.env.NODE_ENV !== "production";

    return ok({
      phone,
      sent: sms.sent,
      expiresIn: 300,
      providerConfigured: isSmsConfigured(),
      // Only populated when there is no SMS gateway — never in production.
      devCode: exposeCode ? code : undefined,
    });
  } catch (error) {
    return handleError(error);
  }
}
