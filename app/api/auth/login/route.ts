import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { sessionCookie, signSession } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "login"), 15, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = (await req.json().catch(() => ({}))) as {
      identifier?: string;
      password?: string;
    };

    const identifier = body.identifier?.trim();
    const password = body.password ?? "";

    if (!identifier || !password) {
      return fail("ইমেইল/ফোন এবং পাসওয়ার্ড দিন", 400);
    }

    const isEmail = identifier.includes("@");
    const column = isEmail ? "email" : "phone";
    const value = isEmail ? identifier.toLowerCase() : identifier;

    const { data: user, error } = await db()
      .from("users")
      .select("id, name, email, phone, role, password_hash")
      .eq(column, value)
      .maybeSingle();

    if (error) {
      console.error("[auth/login] DB query error:", error);
      return fail(`লগইন করতে সমস্যা হয়েছে: ${error.message}`, 500);
    }

    if (!user || !user.password_hash) {
      return fail("ইমেইল/ফোন বা পাসওয়ার্ড সঠিক নয়", 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return fail("ইমেইল/ফোন বা পাসওয়ার্ড সঠিক নয়", 401);
    }

    const role = (user.role as UserRole) ?? "customer";
    const sessionUser = {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      role,
    };

    const token = await signSession(sessionUser);
    const store = await cookies();
    store.set(sessionCookie.name, token, sessionCookie.options);
    if (role === "admin") {
      store.set(sessionCookie.adminName, token, sessionCookie.options);
    }

    return ok({ user: sessionUser });
  } catch (err) {
    return handleError(err);
  }
}
