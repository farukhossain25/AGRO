import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { clientKey, created, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { otpVerifySchema } from "@/lib/validation";
import { signSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "otp-verify"), 10, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { phone, code, name } = otpVerifySchema.parse(await req.json());

    const { data: record, error } = await db()
      .from("otp_codes")
      .select("id, code_hash, expires_at, consumed, attempts")
      .eq("phone", phone)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!record) return fail("কোনো সক্রিয় কোড পাওয়া যায়নি — আবার কোড পাঠান", 404);
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return fail("কোডের মেয়াদ শেষ হয়েছে — আবার কোড পাঠান", 410);
    }
    if (record.attempts >= 5) {
      return fail("অনেকবার ভুল কোড দেওয়া হয়েছে — নতুন কোড নিন", 429);
    }

    const valid = await bcrypt.compare(code, record.code_hash);
    if (!valid) {
      await db().from("otp_codes").update({ attempts: record.attempts + 1 }).eq("id", record.id);
      return fail("কোডটি সঠিক নয়", 401);
    }

    await db().from("otp_codes").update({ consumed: true }).eq("id", record.id);

    // find or create the user
    let { data: user } = await db()
      .from("users")
      .select("id, name, email, phone, role")
      .eq("phone", phone)
      .maybeSingle();

    let isNew = false;

    if (!user) {
      const { data: inserted, error: insertError } = await db()
        .from("users")
        .insert({
          name: name?.trim() || `গ্রাহক ${phone.slice(-4)}`,
          phone,
          role: "customer",
          phone_verified: true,
        })
        .select("id, name, email, phone, role")
        .single();

      if (insertError) throw insertError;
      user = inserted;
      isNew = true;
    } else {
      await db().from("users").update({ phone_verified: true }).eq("id", user.id);
    }

    const token = await signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role === "admin" ? "admin" : "customer",
    });

    (await cookies()).set(sessionCookie.name, token, sessionCookie.options);

    return isNew ? created({ id: user.id, name: user.name, isNew }) : ok({ id: user.id, name: user.name, isNew });
  } catch (error) {
    return handleError(error);
  }
}
