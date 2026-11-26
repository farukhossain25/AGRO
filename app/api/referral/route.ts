import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, fail, handleError, ok } from "@/lib/api";
import { getReferralSettings } from "@/lib/referral";
import { REF_COOKIE } from "@/lib/referral-cookie";

export const dynamic = "force-dynamic";

/**
 * GET  /api/referral  → my code, my wallet balance, the active settings
 * POST /api/referral  → { code }  claim an invite code (once per account)
 *
 * The write itself lives in `apply_referral()` (migration 25): it refuses
 * self-referral, an unknown code and a second claim. We only translate.
 */

export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.id) return fail("লগইন করুন", 401);

    const settings = await getReferralSettings();

    const { data: me, error } = await db()
      .from("profiles")
      .select("referral_code, referred_by, wallet_balance, wallet_earned")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;

    /* Someone who clicked a share link before signing up still carries the
       code in a cookie. This GET runs right after every login, so it is the
       natural place to claim it — once, and only if the account has no
       referrer yet. A failure here must never break the page. */
    let referredBy = me?.referred_by ?? null;
    if (!referredBy) {
      const parked = (await cookies()).get(REF_COOKIE)?.value;
      if (parked) {
        const code = decodeURIComponent(parked);

        /* Two kinds of code can arrive by link:
             • a profile code  (ABCD2345)  → apply_referral()
             • an influencer promo token   → referrer_for_token()
           Both end up as profiles.referred_by, so every later order of this
           customer credits the same person. */
        const { data: viaToken } = await db().rpc("referrer_for_token", {
          p_code: code,
          p_user: user.id,
        });

        if (viaToken) {
          referredBy = viaToken as string;
        } else {
          const { data: claimed, error: claimError } = await db().rpc("apply_referral", {
            p_user: user.id,
            p_code: code,
          });
          if (!claimError) {
            referredBy = (claimed as { inviter?: string } | null)?.inviter ?? null;
          }
        }
      }
    }

    const { count: invited } = await db()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id);

    /* An influencer also has a promo code of their own: anyone they give the
       code (or its share link) to can use it and counts as their referral. */
    const { data: promo } = await db()
      .from("coupons")
      .select("code, share_token, value, type, per_user_limit")
      .eq("funder_user_id", user.id)
      .eq("audience", "influencer")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return ok({
      code: me?.referral_code ?? null,
      referred_by: referredBy,
      wallet_balance: Number(me?.wallet_balance ?? 0),
      wallet_earned: Number(me?.wallet_earned ?? 0),
      invited: invited ?? 0,
      promo: promo
        ? {
            code: promo.code,
            share_token: promo.share_token,
            value: Number(promo.value),
            type: promo.type,
            link: promo.share_token ? `/?ref=${promo.share_token}` : null,
          }
        : null,
      settings,
    });
  } catch (error) {
    return handleError(error);
  }
}

const schema = z.object({ code: z.string().trim().min(4).max(24) });

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user?.id) return fail("লগইন করুন", 401);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("রেফারেল কোড সঠিক নয়");

    /* An influencer passes around their promo token (`?ref=TOKEN`), not a
       profile code. Resolve that first — it is the more common case for a
       code pasted from a promo post. */
    const { data: viaToken } = await db().rpc("referrer_for_token", {
      p_code: parsed.data.code,
      p_user: user.id,
    });
    if (viaToken) {
      const { error: linkError } = await db()
        .from("profiles")
        .update({ referred_by: viaToken as string, referred_at: new Date().toISOString() })
        .eq("id", user.id)
        .is("referred_by", null);
      if (linkError) throw linkError;

      const { data: fresh } = await db()
        .from("profiles")
        .select("referred_by")
        .eq("id", user.id)
        .maybeSingle();
      if (fresh?.referred_by) return ok({ ok: true, inviter: fresh.referred_by, via: "influencer" });
    }

    const { data, error } = await db().rpc("apply_referral", {
      p_user: user.id,
      p_code: parsed.data.code,
    });

    if (error) {
      const code = (error.message ?? "").split(":")[0].trim();
      if (code === "ALREADY_REFERRED") {
        return fail("আপনি ইতিমধ্যে একটি রেফারেল কোড ব্যবহার করেছেন", 409);
      }
      if (code === "REFERRAL_INVALID") {
        return fail("রেফারেল কোডটি খুঁজে পাওয়া যায়নি", 404);
      }
      throw error;
    }

    return ok(data ?? { ok: true });
  } catch (error) {
    return handleError(error);
  }
}
