import { z } from "zod";
import { db } from "@/lib/db";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { getCouponByCode } from "@/lib/data";
import { listMyCoupons } from "@/lib/referral";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(2).max(24),
  subtotal: z.coerce.number().min(0),
});

/**
 * POST /api/coupons/validate → is this code usable by *this* customer, now?
 *
 * New in migration 25: the per-user rules that used to be invisible here —
 * `per_user_limit` (a coupon a customer already used disappears), `audience`
 * (an influencer code only works for the accounts it was handed to) and the
 * per-user redemption count. All of it is decided by `coupon_allows_user()` in
 * SQL, so this route and `place_order` can never disagree.
 */
export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "coupon"), 20, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const body = await req.json();
    const { code, subtotal } = schema.parse(body);

    const coupon = await getCouponByCode(code);
    const user = await currentUser();

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

    /* Per-user rules. Anonymous visitors cannot hold a restricted code — the
       audience list is made of accounts — and cannot have a per-user count, so
       they only ever match `audience = 'all'`. */
    /* Only `assigned` is a gate for anonymous visitors; an influencer code is
       shareable, so a guest may use it as well. */
    const audience = (coupon as { audience?: string }).audience ?? "all";
    if (audience === "assigned" && !user?.id) {
      return fail("এই কুপনটি শুধু নির্দিষ্ট কিছু অ্যাকাউন্টের জন্য — লগইন করুন", 403);
    }

    if (user?.id) {
      const { data: allowed, error } = await db().rpc("coupon_allows_user", {
        p_coupon: coupon.id,
        p_user: user.id,
      });
      if (error) throw error;
      if (allowed === false) {
        return fail("এই কুপন আপনি ইতিমধ্যে ব্যবহার করেছেন বা আপনার জন্য প্রযোজ্য নয়", 409);
      }
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

/**
 * GET /api/coupons/validate → the coupons this visitor may use.
 * The checkout field uses it to show a short "আপনার জন্য" strip, so a
 * customer does not have to remember a code from an influencer post.
 */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.id) return ok({ coupons: [], signedIn: false });
    return ok({ coupons: await listMyCoupons(user.id), signedIn: true });
  } catch (error) {
    return handleError(error);
  }
}
