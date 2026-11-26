import { db } from "./db";
import { currentUser } from "./api";
import type { WalletRow } from "./types-wallet";

/* ==========================================================================
   Referral + wallet helpers (migration 25)
   --------------------------------------------------------------------------
   The money itself only ever moves inside SQL (`wallet_apply`, `place_order`,
   `credit_referral`). This module is the read/write façade the API routes and
   server components use:

     • getReferralSettings — the admin knobs, cached for the request
     • getWalletOverview   — balance + the ledger page for /account/wallet
     • listMyCoupons       — the coupons this account may still use
     • referralLink        — the shareable URL for an account

   Nothing here trusts the browser: every write goes through an RPC that
   re-checks ownership server-side.
   ========================================================================== */

export type ReferralSettings = {
  enabled: boolean;
  /** % of EVERY delivered order of an invited customer (not just the first). */
  commission_percent: number;
  wallet_max_percent: number;
  credit_on: "delivered" | "paid";
  min_order: number;
  /** subtotal = product value · paid = the amount the customer actually paid */
  commission_base: "subtotal" | "paid";
};

export const REFERRAL_DEFAULTS: ReferralSettings = {
  enabled: true,
  commission_percent: 5,
  wallet_max_percent: 30,
  credit_on: "delivered",
  min_order: 300,
  commission_base: "subtotal",
};

/** Coerce whatever is stored in site_settings into a complete, sane object. */
export function normaliseReferralSettings(raw: unknown): ReferralSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (key: keyof ReferralSettings, fallback: number) => {
    const n = Number(v[key]);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    enabled: v.enabled === undefined ? REFERRAL_DEFAULTS.enabled : Boolean(v.enabled),
    commission_percent: Math.min(100, num("commission_percent", REFERRAL_DEFAULTS.commission_percent)),
    wallet_max_percent: Math.min(100, num("wallet_max_percent", REFERRAL_DEFAULTS.wallet_max_percent)),
    credit_on: v.credit_on === "paid" ? "paid" : "delivered",
    min_order: num("min_order", REFERRAL_DEFAULTS.min_order),
    commission_base: v.commission_base === "paid" ? "paid" : "subtotal",
  };
}

export async function getReferralSettings(): Promise<ReferralSettings> {
  try {
    const { data, error } = await db()
      .from("site_settings")
      .select("value")
      .eq("key", "referral")
      .maybeSingle();
    if (error) throw error;
    return normaliseReferralSettings(data?.value);
  } catch {
    return REFERRAL_DEFAULTS;
  }
}

export type WalletSummary = {
  balance: number;
  earned: number;
  spent: number;
  /** How much of an order the wallet may cover, in percent (admin knob). */
  max_percent: number;
  /** The largest amount usable on an order of `total`. */
  usableOn: (total: number) => number;
};

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const settings = await getReferralSettings();
  let balance = 0;
  let earned = 0;
  let spent = 0;

  try {
    const { data } = await db()
      .from("profiles")
      .select("wallet_balance, wallet_earned, wallet_spent")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      balance = Number(data.wallet_balance ?? 0);
      earned = Number(data.wallet_earned ?? 0);
      spent = Number(data.wallet_spent ?? 0);
    }
  } catch {
    /* DB offline → a zero wallet is the safe answer; checkout still works */
  }

  return {
    balance,
    earned,
    spent,
    max_percent: settings.wallet_max_percent,
    usableOn: (total: number) =>
      Math.max(
        0,
        Math.min(balance, Math.round(((Number(total) || 0) * settings.wallet_max_percent) / 100))
      ),
  };
}

export async function getWalletLedger(userId: string, limit = 40): Promise<WalletRow[]> {
  try {
    const { data } = await db()
      .from("wallet_transactions")
      .select("id, kind, amount, balance_after, order_no, note_bn, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as WalletRow[];
  } catch {
    return [];
  }
}


/** The absolute share URL for an account, e.g. https://site/?ref=ABCD2345 */
export function referralLink(code: string | null | undefined, origin = ""): string {
  if (!code) return "";
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Coupons this account may still use.
 *
 * Shown on /account/coupons and under the checkout field. A coupon is hidden
 * once: it is used up by this account (per_user_limit), it is outside its
 * window, or it is restricted to other accounts. That is the "if someone has
 * used a coupon, they no longer see it" rule — enforced in SQL by
 * `coupon_allows_user`, mirrored here for the list.
 */
export type MyCoupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_discount: number | null;
  description_bn: string | null;
  expires_at: string | null;
  audience: string;
  remaining: number | null;
  used_by_me: number;
  per_user_limit: number;
};

export async function listMyCoupons(userId: string): Promise<MyCoupon[]> {
  try {
    const { data: rows, error } = await db()
      .from("coupons")
      .select(
        "id, code, type, value, min_order, max_discount, description_bn, expires_at, audience, usage_limit, used_count, per_user_limit, funder_user_id, is_active, starts_at"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    const open = (rows ?? []).filter((c) => {
      const now = Date.now();
      if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
      if (c.expires_at && new Date(c.expires_at).getTime() < now) return false;
      if (c.usage_limit != null && Number(c.used_count ?? 0) >= Number(c.usage_limit)) return false;
      return true;
    });

    /* Only `assigned` coupons are a closed list. An `influencer` code is
       shareable by design, so it belongs in everybody's list too. */
    const restricted = open.filter((c) => c.audience === "assigned");
    const allowed = new Set<string>();
    if (restricted.length) {
      const { data: links } = await db()
        .from("coupon_audiences")
        .select("coupon_id")
        .eq("user_id", userId)
        .in(
          "coupon_id",
          restricted.map((c) => c.id)
        );
      for (const l of links ?? []) allowed.add(l.coupon_id);
    }

    const usable = open.filter(
      (c) =>
        c.audience !== "assigned" || allowed.has(c.id) || c.funder_user_id === userId
    );
    if (!usable.length) return [];

    const { data: mine } = await db()
      .from("coupon_redemptions")
      .select("coupon_id")
      .eq("user_id", userId)
      .in(
        "coupon_id",
        usable.map((c) => c.id)
      );

    const usedMap = new Map<string, number>();
    for (const r of mine ?? []) usedMap.set(r.coupon_id, (usedMap.get(r.coupon_id) ?? 0) + 1);

    return usable
      .filter((c) => (usedMap.get(c.id) ?? 0) < Math.max(0, Number(c.per_user_limit ?? 1)))
      .map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type === "fixed" ? "fixed" : "percent",
        value: Number(c.value),
        min_order: Number(c.min_order ?? 0),
        max_discount: c.max_discount == null ? null : Number(c.max_discount),
        description_bn: c.description_bn ?? null,
        expires_at: c.expires_at ?? null,
        audience: c.audience ?? "all",
        remaining:
          c.usage_limit == null
            ? null
            : Math.max(0, Number(c.usage_limit) - Number(c.used_count ?? 0)),
        used_by_me: usedMap.get(c.id) ?? 0,
        per_user_limit: Number(c.per_user_limit ?? 1),
      }));
  } catch {
    return [];
  }
}

/** Who am I, for server components that need the profile row. */
export async function currentProfile(): Promise<
  | (Record<string, unknown> & {
      id: string;
      full_name: string | null;
      referral_code: string | null;
      wallet_balance: number;
      referred_by: string | null;
    })
  | null
> {
  const user = await currentUser();
  if (!user?.id) return null;
  try {
    const { data } = await db()
      .from("profiles")
      .select("id, full_name, referral_code, wallet_balance, wallet_earned, wallet_spent, referred_by")
      .eq("id", user.id)
      .maybeSingle();
    return (data as never) ?? null;
  } catch {
    return null;
  }
}
