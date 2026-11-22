import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { sessionCookie, signSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "register"), 10, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const name = body.name?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const phone = body.phone?.trim() || null;
    const password = body.password ?? "";

    if (!email && !phone) {
      return fail("ইমেইল অথবা ফোন নম্বর দিন", 400);
    }
    if (password.length < 6) {
      return fail("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে", 400);
    }

    if (email) {
      const { data: existing } = await db()
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        return fail("এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে", 409);
      }
    }

    if (phone) {
      const { data: existing } = await db()
        .from("users")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (existing) {
        return fail("এই ফোন নম্বর দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে", 409);
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data: created, error } = await db()
      .from("users")
      .insert({
        name,
        email,
        phone,
        password_hash,
        role: "customer",
      })
      .select("id, name, email, phone, role")
      .single();

    if (error || !created) {
      return fail("অ্যাকাউন্ট তৈরি করা যায়নি — আবার চেষ্টা করুন", 500);
    }

    const sessionUser = {
      id: created.id,
      name: created.name ?? null,
      email: created.email ?? null,
      phone: created.phone ?? null,
      role: "customer" as const,
    };

    const token = await signSession(sessionUser);
    const store = await cookies();
    store.set(sessionCookie.name, token, sessionCookie.options);

    return ok({ user: sessionUser }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
