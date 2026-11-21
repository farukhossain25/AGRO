import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, isUniqueViolation } from "@/lib/db";
import { clientKey, created, fail, handleError, rateLimit, tooMany } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { signSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "register"), 5, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const data = registerSchema.parse(await req.json());

    const { data: existing } = await db()
      .from("users")
      .select("id, phone, email")
      .or(`phone.eq.${data.phone}${data.email ? `,email.eq.${data.email}` : ""}`)
      .maybeSingle();

    if (existing) {
      return fail(
        existing.phone === data.phone
          ? "এই মোবাইল নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে — লগইন করুন"
          : "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে",
        409
      );
    }

    const password_hash = await bcrypt.hash(data.password, 12);

    const { data: user, error } = await db()
      .from("users")
      .insert({
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        password_hash,
        role: "customer",
      })
      .select("id, name, email, phone, role")
      .single();

    if (error) {
      if (isUniqueViolation(error)) return fail("এই তথ্য দিয়ে আগেই অ্যাকাউন্ট আছে", 409);
      throw error;
    }

    const token = await signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "customer",
    });

    (await cookies()).set(sessionCookie.name, token, sessionCookie.options);

    return created({ id: user.id, name: user.name, phone: user.phone, email: user.email });
  } catch (error) {
    return handleError(error);
  }
}
