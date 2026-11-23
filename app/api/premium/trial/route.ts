import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handleError, currentUser, rateLimit } from "@/lib/api";
import { deviceFingerprint, hashIp } from "@/lib/stream-auth";
import { resolvePremiumState, startTrial, getPremiumSettings } from "@/lib/premium";

export const dynamic = "force-dynamic";

/**
 * GET  /api/premium/state   → entitlement for the current visitor
 * POST /api/premium/trial   → start the one-time free trial
 */

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    const fingerprint = deviceFingerprint(req);
    const state = await resolvePremiumState(user?.id ?? null, user?.role ?? null, fingerprint);
    const settings = await getPremiumSettings();

    return ok({
      ...state,
      // The client must never see internal ids it cannot use.
      subscription: state.subscription
        ? {
            id: state.subscription.id,
            plan_id: state.subscription.plan_id,
            tier: state.subscription.tier,
            status: state.subscription.status,
            started_at: state.subscription.started_at,
            expires_at: state.subscription.expires_at,
            device_limit: state.subscription.device_limit,
          }
        : null,
      trial_minutes: settings.trial_minutes,
      signedIn: Boolean(user),
      name: user?.name ?? null,
    });
  } catch (error) {
    return handleError(error);
  }
}

const trialSchema = z.object({
  hint: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const limited = rateLimit(
      `premium-trial:${req.headers.get("x-forwarded-for") ?? "local"}`,
      5,
      60 * 60_000
    );
    if (!limited.ok) {
      return fail("অনেকবার চেষ্টা করা হয়েছে — এক ঘণ্টা পর আবার দিন", 429);
    }

    const body = await req.json().catch(() => ({}));
    const { hint } = trialSchema.parse(body);

    const fingerprint = deviceFingerprint(req, hint);
    const user = await currentUser();

    const state = await resolvePremiumState(user?.id ?? null, user?.role ?? null, fingerprint);

    // Already has full access — nothing to start.
    if (state.isPremium) {
      return ok({ started: false, already: "premium", expiresAt: state.subscription?.expires_at ?? null });
    }

    if (state.reason === "trial" && state.trial?.active) {
      return ok({ started: false, already: "trial", expiresAt: state.trial.expiresAt });
    }

    if (state.trial && state.trial.expiresAt && !state.trial.active) {
      // A grant exists and has run out — no second trial, ever.
      return fail("আপনার ফ্রি ট্রায়াল শেষ হয়েছে। চালিয়ে যেতে প্রিমিয়াম প্ল্যান নিন।", 403);
    }

    const grant = await startTrial({
      fingerprint,
      userId: user?.id ?? null,
      ip: hashIp(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""),
    });

    // Analytics + notification are best-effort: never fail the trial on them.
    const client = db();
    try {
      await client.from("camera_view_logs").insert({
        camera_id: null,
        user_id: user?.id ?? null,
        fingerprint,
        minutes: 10,
      });
    } catch {
      /* ignore */
    }

    if (user) {
      try {
        await client.from("notifications").insert({
          user_id: user.id,
          title_bn: "১০ মিনিটের ফ্রি ট্রায়াল শুরু হয়েছে",
          body_bn:
            "খামারের লাইভ ক্যামেরা এখন দেখতে পারবেন। ট্রায়াল শেষ হলে প্রিমিয়াম প্ল্যান নিতে পারবেন।",
          link: "/live",
          kind: "premium",
        });
      } catch {
        /* ignore */
      }
    }

    return ok({
      started: true,
      minutes: grant.minutes,
      expiresAt: grant.expires_at,
    });
  } catch (error) {
    return handleError(error);
  }
}
