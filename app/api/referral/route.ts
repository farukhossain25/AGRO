import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, fail, handleError, ok } from "@/lib/api";
import { getReferralSettings } from "@/lib/referral";

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
      const parked = (await cookies()).get("agro_ref")?.value;
      if (parked) {
        const { data: claimed, error: claimError } = await db().rpc("apply_referral", {
          p_user: user.id,
          p_code: decodeURIComponent(parked),
        });
        if (!claimError) {
          referredBy = (claimed as { inviter?: string } | null)?.inviter ?? null;
        }
      }
    }

    const { count: invited } = await db()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id);

    return ok({
      code: me?.referral_code ?? null,
      referred_by: referredBy,
      wallet_balance: Number(me?.wallet_balance ?? 0),
      wallet_earned: Number(me?.wallet_earned ?? 0),
      invited: invited ?? 0,
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
