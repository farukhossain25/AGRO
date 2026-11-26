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
    const deviceHash = deviceFingerprint(req);
    const state = await resolvePremiumState(user?.id ?? null, user?.role ?? null, deviceHash);
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

    /* A trial belongs to an ACCOUNT. It used to be anonymous, keyed by a
       fingerprint that included a browser-supplied "hint" — so a visitor could
       change the hint and mint unlimited trials without ever signing up.
       Requiring a session is what makes "one trial per account" meaningful;
       the device/IP hash then stops the same person opening a second account
       and getting another one straight away. */
    const user = await currentUser();
    if (!user) {
      return fail("ফ্রি ট্রায়াল নিতে লগইন করুন", 401);
    }

    // Body is ignored on purpose: nothing the browser sends may influence the
    // identity. Reading it would only invite the old `hint` back.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const deviceHash = deviceFingerprint(req);

    const state = await resolvePremiumState(user.id, user.role, deviceHash);

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
      deviceHash,
      userId: user.id,
      ip: hashIp(ip),
    });

    // Analytics + notification are best-effort: never fail the trial on them.
    const client = db();
    try {
      await client.from("camera_view_logs").insert({
        camera_id: null,
        user_id: user.id,
        fingerprint: deviceHash,
        minutes: 10,
      });
    } catch {
      /* ignore */
    }

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

    return ok({
      started: true,
      minutes: grant.minutes,
      expiresAt: grant.expires_at,
    });
  } catch (error) {
    return handleError(error);
  }
}
