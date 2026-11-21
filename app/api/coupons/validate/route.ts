import { z } from "zod";
import { clientKey, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { getCouponByCode } from "@/lib/data";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(2).max(24),
  subtotal: z.coerce.number().min(0),
});

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "coupon"), 20, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = await req.json();
    const { code, subtotal } = schema.parse(body);

    const coupon = await getCouponByCode(code);

    if (!coupon || !coupon.is_active) return fail("কুপন কোডটি সঠিক নয়", 404);
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return fail("এই কুপনের মেয়াদ শেষ হয়েছে", 410);
    }
    if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
      return fail("এই কুপনের ব্যবহারের সীমা শেষ", 410);
    }
    if (subtotal < Number(coupon.min_order)) {
      return fail(`এই কুপন ব্যবহারে ন্যূনতম অর্ডার ৳${coupon.min_order}`, 422);
    }

    let discount =
      coupon.type === "percent" ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);

    if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
    discount = Math.min(discount, subtotal);
    discount = Math.round(discount * 100) / 100;

    return ok({
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount,
    });
  } catch (error) {
    return handleError(error);
  }
}
