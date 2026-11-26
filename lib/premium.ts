import { db, dbUsable, markDbUnreachable } from "./db";
import type {
  PremiumPlan,
  PremiumState,
  PremiumSubscription,
  Subscription,
  UserRole,
} from "./types";

/* ==========================================================================
   Premium entitlement engine
   --------------------------------------------------------------------------
   Single source of truth for "may this person watch a live camera?".
   Every check is server-side. The client renders whatever we return.
   ========================================================================== */

export const PREMIUM_SETTINGS_KEY = "premium";

export type PremiumSettings = {
  trial_minutes: number;
  grace_days: number;
  default_device_limit: number;
  max_viewers_per_camera: number;
};

export const defaultPremiumSettings: PremiumSettings = {
  trial_minutes: 10,
  grace_days: 3,
  default_device_limit: 2,
  max_viewers_per_camera: 50,
};

export async function getPremiumSettings(): Promise<PremiumSettings> {
  try {
    const { data } = await db()
      .from("site_settings")
      .select("value")
      .eq("key", PREMIUM_SETTINGS_KEY)
      .maybeSingle();
    if (!data?.value) return defaultPremiumSettings;
    return { ...defaultPremiumSettings, ...(data.value as Partial<PremiumSettings>) };
  } catch {
    return defaultPremiumSettings;
  }
}

export async function updatePremiumSettings(patch: Partial<PremiumSettings>): Promise<PremiumSettings> {
  const current = await getPremiumSettings();
  const next = { ...current, ...patch };
  await db()
    .from("site_settings")
    .upsert({ key: PREMIUM_SETTINGS_KEY, value: next }, { onConflict: "key" });
  return next;
}

/** The user's most relevant subscription: active first, then grace, then latest. */
export async function getActiveSubscription(userId: string): Promise<PremiumSubscription | null> {
  const rank: Record<string, number> = { active: 0, grace: 1, pending: 2, expired: 3, cancelled: 4 };

  const { data, error } = await db()
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "grace", "pending"])
    .order("expires_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  const rows = (data ?? []) as PremiumSubscription[];
  if (!rows.length) return null;

  return rows.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))[0];
}

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
}

/**
 * Resolve a user's premium state, including an in-flight free trial.
 * Trial rows are keyed by fingerprint so an anonymous visitor can watch once.
 */
export async function resolvePremiumState(
  userId: string | null,
  role: UserRole | null,
  deviceHash?: string
): Promise<PremiumState> {
  const settings = await getPremiumSettings();
  const now = new Date();

  if (userId) {
    const sub = await getActiveSubscription(userId);

    const usable =
      sub &&
      (sub.status === "active" || sub.status === "grace") &&
      sub.expires_at &&
      new Date(sub.expires_at) > now;

    if (usable && sub) {
      const expires = new Date(sub.expires_at!);
      return {
        isPremium: true,
        role: role ?? "customer",
        subscription: sub,
        daysLeft: Math.floor(hoursBetween(now, expires) / 24),
        hoursLeft: Math.floor(hoursBetween(now, expires)),
        trial: null,
        canWatch: true,
        reason: "premium",
        deviceLimit: sub.device_limit || settings.default_device_limit,
      };
    }

    // Grace window after expiry — access continues, renew banner shows.
    if (sub?.status === "grace" && sub.grace_until && new Date(sub.grace_until) > now) {
      return {
        isPremium: false,
        role: role ?? "customer",
        subscription: sub,
        daysLeft: 0,
        hoursLeft: Math.floor(hoursBetween(now, new Date(sub.grace_until))),
        trial: null,
        canWatch: true,
        reason: "premium",
        deviceLimit: sub.device_limit || settings.default_device_limit,
      };
    }
  }

  /* -------- free trial — logged in only ---------------------------------
     A trial used to be keyed by a device fingerprint alone, with an optional
     client-supplied `hint` mixed in. Two consequences:
       • an anonymous visitor could hold a trial, so there was no account to
         attach it to and no way to stop "one trial per person";
       • the hint came from the browser, so `hint: Math.random()` minted a
         brand-new fingerprint and therefore a brand-new trial — indefinitely.
     Now a trial needs a signed-in account and is looked up by user id OR by
     server-computed device hash; either one having a grant is enough. */
  if (userId) {
    const { data: trials } = await db()
      .from("trials")
      .select("*")
      .or(`user_id.eq.${userId}${deviceHash ? `,device_hash.eq.${deviceHash}` : ""}`)
      .order("started_at", { ascending: false })
      .limit(1);

    const trial = trials?.[0] ?? null;

    if (trial) {
      const expires = new Date(trial.expires_at);
      const active = expires > now;
      return {
        isPremium: false,
        role: role ?? "customer",
        subscription: null,
        daysLeft: null,
        hoursLeft: Math.floor(hoursBetween(now, expires)),
        trial: { active, expiresAt: trial.expires_at, minutes: trial.minutes },
        canWatch: active,
        reason: active ? "trial" : "locked",
        deviceLimit: settings.default_device_limit,
      };
    }

    // No grant yet — return the length so the UI can offer a one-tap start.
    return {
      isPremium: false,
      role: role ?? "customer",
      subscription: null,
      daysLeft: null,
      hoursLeft: null,
      trial: { active: false, expiresAt: null, minutes: settings.trial_minutes },
      canWatch: false,
      reason: "locked",
      deviceLimit: settings.default_device_limit,
    };
  }

  return {
    isPremium: false,
    role: role ?? "customer",
    subscription: null,
    daysLeft: null,
    hoursLeft: null,
    trial: null,
    canWatch: false,
    reason: "anonymous",
    deviceLimit: settings.default_device_limit,
  };
}

/** Start (or resume) the server-side trial. Returns the grant row. */
export async function startTrial(opts: {
  /** Server-computed: (IP + UA + language). No client-supplied part. */
  deviceHash: string;
  /** Required — the trial belongs to an account, not a browser. */
  userId: string;
  ip?: string;
}) {
  const settings = await getPremiumSettings();
  const now = new Date();

  /* One trial per ACCOUNT and one per DEVICE, whichever hits first.
     `fingerprint` is still written because the column is NOT NULL + UNIQUE and
     older rows live there; new rows use device_hash as the identity. */
  const { data: existing } = await db()
    .from("trials")
    .select("*")
    .or(`user_id.eq.${opts.userId},device_hash.eq.${opts.deviceHash},fingerprint.eq.${opts.deviceHash}`)
    .order("started_at", { ascending: false })
    .limit(1);

  // A trial is once per account/device, ever. No restarts.
  if (existing?.[0]) return existing[0];

  const expires = new Date(now.getTime() + settings.trial_minutes * 60_000);
  const { data, error } = await db()
    .from("trials")
    .insert({
      // Unique legacy key — device hash is stable per browser+network.
      fingerprint: opts.deviceHash,
      device_hash: opts.deviceHash,
      user_id: opts.userId,
      minutes: settings.trial_minutes,
      ip_hash: opts.ip ?? null,
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Housekeeping: expire trials, subscriptions and reminder flags. */
export async function sweepExpired(): Promise<{ subs: number; trials: number }> {
  const client = db();
  const now = new Date().toISOString();
  const settings = await getPremiumSettings();

  // active → grace (just expired)
  const { data: lapsing } = await client
    .from("user_subscriptions")
    .select("id, expires_at")
    .eq("status", "active")
    .lt("expires_at", now);

  let subs = 0;
  for (const row of lapsing ?? []) {
    const graceUntil = new Date(
      new Date(row.expires_at ?? now).getTime() + settings.grace_days * 86_400_000
    ).toISOString();
    await client
      .from("user_subscriptions")
      .update({ status: "grace", grace_until: graceUntil })
      .eq("id", row.id);
    subs += 1;
  }

  // grace → expired
  const { data: dead } = await client
    .from("user_subscriptions")
    .select("id")
    .eq("status", "grace")
    .lt("grace_until", now);

  for (const row of dead ?? []) {
    await client.from("user_subscriptions").update({ status: "expired" }).eq("id", row.id);
    subs += 1;
  }

  // users.premium_until hint
  await client
    .from("profiles")
    .update({ role: "customer", premium_until: null })
    .eq("role", "premium")
    .lt("premium_until", now);

  // expired access codes
  const { data: codes } = await client
    .from("access_codes")
    .select("id")
    .eq("status", "unused")
    .lt("expires_at", now);
  for (const row of codes ?? []) {
    await client.from("access_codes").update({ status: "expired" }).eq("id", row.id);
  }

  const { data: trials } = await client.from("trials").select("id").lt("expires_at", now);

  return { subs, trials: trials?.length ?? 0 };
}

export async function listPlans(activeOnly = true): Promise<PremiumPlan[]> {
  if (!dbUsable()) return [];

  try {
    let q = db().from("plans").select("*").order("sort_order");
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return [];
    return data as unknown as PremiumPlan[];
  } catch (error) {
    // Build-time / offline prerender must not fail on a pricing page.
    markDbUnreachable(error);
    console.warn("[premium] plans read failed:", (error as Error).message);
    return [];
  }
}

/* ------------------------------ formatting ------------------------------ */

export const intervalLabelBn: Record<string, string> = {
  monthly: "মাসিক",
  half_yearly: "ষান্মাসিক",
  yearly: "বাৎসরিক",
};

export const tierLabelBn: Record<string, string> = {
  basic: "বেসিক",
  full: "ফুল অ্যাক্সেস",
};

export const premiumStatusLabelBn: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  active: "সক্রিয়",
  grace: "গ্রেস পিরিয়ড",
  expired: "মেয়াদ শেষ",
  cancelled: "বাতিল",
};

/** Gift-card subscriptions are separate from the produce subscriptions table. */
export type ProduceSubscription = Subscription;
