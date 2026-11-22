import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { sessionCookie, signSession } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp-store";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "otp_verify"), 10, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      code?: string;
      name?: string;
    };

    const phone = body.phone?.trim();
    const code = body.code?.trim();
    const name = body.name?.trim() || null;

    if (!phone || !code) {
      return fail("ফোন নম্বর এবং OTP কোড দিন", 400);
    }

    if (!verifyOtp(phone, code)) {
      return fail("OTP কোড সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে", 401);
    }

    let { data: user } = await db()
      .from("users")
      .select("id, name, email, phone, role")
      .eq("phone", phone)
      .maybeSingle();

    if (!user) {
      const { data: created, error } = await db()
        .from("users")
        .insert({ phone, name, role: "customer" })
        .select("id, name, email, phone, role")
        .single();
      if (error || !created) {
        return fail("অ্যাকাউন্ট তৈরি করা যায়নি — আবার চেষ্টা করুন", 500);
      }
      user = created;
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
