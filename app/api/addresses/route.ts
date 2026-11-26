import { z } from "zod";
import { db } from "@/lib/db";
import { created, currentUser, fail, handleError, limitGuard, ok } from "@/lib/api";
import { bdPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  label: z.string().trim().max(30).default("বাসা"),
  full_name: z.string().trim().min(2).max(80),
  phone: bdPhone,
  division: z.string().trim().min(1),
  district: z.string().trim().min(1),
  upazila: z.string().trim().min(1),
  address: z.string().trim().min(8).max(400),
  is_default: z.coerce.boolean().default(false),
});

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("লগইন করুন", 401);

    const { data, error } = await db()
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const limit = limitGuard(req, "api-addresses", 30, 60_000);
    if (limit) return limit;
    const user = await currentUser();
    if (!user) return fail("লগইন করুন", 401);

    const data = schema.parse(await req.json());

    if (data.is_default) {
      await db().from("addresses").update({ is_default: false }).eq("user_id", user.id);
    } else {
      /* The FIRST address is the default whether or not the caller said so —
         otherwise the customer's only address is not the one checkout prefills
         from on the next order. */
      const { count } = await db()
        .from("addresses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!count) data.is_default = true;
    }

    const { data: address, error } = await db()
      .from("addresses")
      .insert({ ...data, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return created(address);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH — edit one of my own addresses.
 *
 * Checkout creates the row when the customer ticks "save this address"; if they
 * come back and correct a house number, the row must be UPDATED. Without this
 * endpoint the client had no choice but to POST again, which left two rows that
 * differ by one typo — and the older one was still the default.
 */
export async function PATCH(req: Request) {
  try {
    const limit = limitGuard(req, "api-addresses", 30, 60_000);
    if (limit) return limit;
    const user = await currentUser();
    if (!user) return fail("লগইন করুন", 401);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    /* Every field optional: the caller may be fixing just the house number. */
    const data = schema.partial().parse(await req.json());

    const { data: existing, error: readError } = await db()
      .from("addresses")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return fail("ঠিকানাটি পাওয়া যায়নি", 404);

    if (data.is_default) {
      await db().from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }

    const { data: address, error } = await db()
      .from("addresses")
      .update(data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return ok(address);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const limit = limitGuard(req, "api-addresses", 30, 60_000);
    if (limit) return limit;
    const user = await currentUser();
    if (!user) return fail("লগইন করুন", 401);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await db().from("addresses").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
