import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { signSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "login"), 8, 5 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { identifier, password } = loginSchema.parse(await req.json());

    const cleaned = identifier.trim().toLowerCase();
    const phone = identifier.replace(/[\s-]/g, "").replace(/^\+?88/, "0");

    const { data: user, error } = await db()
      .from("users")
      .select("id, name, email, phone, password_hash, role, is_active")
      .or(`email.eq.${cleaned},phone.eq.${phone},phone.eq.${identifier.trim()}`)
      .maybeSingle();

    if (error) throw error;

    // Constant-ish response whether the user exists or the password is wrong.
    const invalid = fail("ইমেইল/মোবাইল বা পাসওয়ার্ড সঠিক নয়", 401);
    if (!user || !user.password_hash) return invalid;
    if (!user.is_active) return fail("আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে", 403);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return invalid;

    const token = await signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role === "admin" ? "admin" : "customer",
    });

    (await cookies()).set(sessionCookie.name, token, sessionCookie.options);

    return ok({ id: user.id, name: user.name, role: user.role });
  } catch (error) {
    return handleError(error);
  }
}
