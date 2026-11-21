import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { adminLoginSchema } from "@/lib/validation";
import { signSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Admin login is the highest-value target — tight limit, per IP.
    const limited = rateLimit(clientKey(req, "admin-login"), 5, 15 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const { email, password } = adminLoginSchema.parse(await req.json());

    const { data: user, error } = await db()
      .from("users")
      .select("id, name, email, phone, password_hash, role, is_active")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) throw error;

    const invalid = fail("ইমেইল বা পাসওয়ার্ড সঠিক নয়", 401);
    if (!user || !user.password_hash) return invalid;
    if (user.role !== "admin") return fail("এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই", 403);
    if (!user.is_active) return fail("অ্যাকাউন্ট নিষ্ক্রিয়", 403);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return invalid;

    const token = await signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "admin",
    });

    (await cookies()).set(sessionCookie.adminName, token, sessionCookie.options);
    // also set the general session so the storefront header reflects the user
    (await cookies()).set(sessionCookie.name, token, sessionCookie.options);

    return ok({ id: user.id, name: user.name });
  } catch (error) {
    return handleError(error);
  }
}
