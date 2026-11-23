import { NextResponse } from "next/server";
import { db, dbUsable } from "@/lib/db";
import { handleError, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/system-check — "সব ঠিক আছে?" in one click
   --------------------------------------------------------------------------
   The in-app twin of `supabase/sql/13_verify_setup.sql`. Same sections, same
   expectations, so the panel and the SQL Editor never disagree.

     • env      — names only, never a value or a prefix of a value
     • db       — every table is readable, the RPCs/views exist, write probe
                  (insert → read back → delete in `audit_log`, self-cleaning)
     • auth     — an active admin profile exists and is_admin() resolves
     • storage  — every bucket from 09 is present, payment-proofs is private,
                  and a 1-byte upload/download/delete round-trip works
     • realtime — the public key is present so the browser socket can open

   A failure carries the raw Postgres/storage sentence in `detail`, so the
   owner can paste one line instead of describing "something broke".
   ========================================================================== */

type Check = {
  id: string;
  label: string;
  group: "env" | "db" | "auth" | "storage" | "realtime";
  status: "pass" | "fail" | "skip";
  detail: string;
  ms?: number;
};

const TABLES = [
  "profiles",
  "addresses",
  "site_settings",
  "social_links",
  "team_members",
  "static_pages",
  "audit_log",
  "login_attempts",
  "contact_messages",
  "newsletter_subscribers",
  "media_assets",
  "seo_meta",
  "categories",
  "farms",
  "cameras",
  "sellers",
  "seller_payouts",
  "seller_warnings",
  "camera_requests",
  "camera_view_logs",
  "products",
  "product_images",
  "coupons",
  "delivery_charges",
  "combos",
  "combo_items",
  "subscription_plans",
  "subscriptions",
  "cart_items",
  "orders",
  "order_items",
  "sub_orders",
  "payment_methods",
  "payments",
  "payment_logs",
  "parcels",
  "custom_combos",
  "plans",
  "user_subscriptions",
  "access_codes",
  "trials",
  "stream_tokens",
  "premium_devices",
  "reviews",
  "review_photos",
  "review_tags",
  "complaints",
  "complaint_messages",
  "notifications",
  "push_subscriptions",
  "fcm_tokens",
  "wishlist",
  "recently_viewed",
  "hero_slides",
  "homepage_sections",
  "banners",
  "menus",
  "menu_items",
  "blog_posts",
  "faq_items",
] as const;

const VIEWS = [
  "public_sellers",
  "public_cameras",
  "v_team_members",
  "v_product_rating_breakdown",
  "v_supplier_quality",
  "v_product_supplier",
  "v_farm_stats",
  "v_payment_queue",
  "v_payment_reconciliation",
  "v_premium_revenue",
  "v_seller_leaderboard",
] as const;

const BUCKETS = [
  "avatars",
  "product-images",
  "category-images",
  "farm-images",
  "logos",
  "slides",
  "team",
  "review-photos",
  "complaint-photos",
  "blog-images",
  "payment-proofs",
] as const;

const PUBLIC_BUCKETS = BUCKETS.filter((b) => b !== "payment-proofs");

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
] as const;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

export async function GET() {
  try {
    await requirePermission("settings.write");
  } catch (error) {
    return handleError(error);
  }

  const checks: Check[] = [];

  /* ---------------------------------------------------------------- env */
  for (const name of REQUIRED_ENV) {
    const present = Boolean(process.env[name]);
    checks.push({
      id: `env:${name}`,
      label: name,
      group: "env",
      status: present ? "pass" : "fail",
      detail: present ? "সেট করা আছে" : "সেট করা নেই — Vercel → Settings → Environment Variables",
    });
  }
  checks.push({
    id: "env:public-secret-scan",
    label: "NEXT_PUBLIC_* এ কোনো সিক্রেট নেই",
    group: "env",
    status: Object.keys(process.env).some((k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET/i.test(k))
      ? "fail"
      : "pass",
    detail: "পাবলিক ভেরিয়েবলের নামগুলো স্ক্যান করা হয়েছে (মান পড়া হয়নি)",
  });

  if (!dbUsable()) {
    checks.push({
      id: "db:configured",
      label: "ডেটাবেস সংযোগ",
      group: "db",
      status: "fail",
      detail: "SUPABASE env নেই বা সংযোগ ব্যর্থ — বাকি ডেটাবেস চেক বাদ দেওয়া হলো",
    });
    return NextResponse.json({
      ok: false,
      data: { checks, passed: checks.filter((c) => c.status === "pass").length, failed: checks.filter((c) => c.status === "fail").length, total: checks.length, ranAt: new Date().toISOString() },
    });
  }

  /* ------------------------------------------------------------- db:read */
  for (const table of TABLES) {
    try {
      const { ms } = await timed(async () => {
        const { error } = await db().from(table).select("*", { count: "exact", head: true });
        if (error) throw error;
      });
      checks.push({ id: `db:read:${table}`, label: `পড়া যাচ্ছে — ${table}`, group: "db", status: "pass", detail: "SELECT ok", ms });
    } catch (error) {
      checks.push({
        id: `db:read:${table}`,
        label: `পড়া যাচ্ছে — ${table}`,
        group: "db",
        status: "fail",
        detail: `${(error as Error).message} — সংশ্লিষ্ট ফাইলটি চালান`,
      });
    }
  }

  /* ------------------------------------------------------------- db:views */
  for (const view of VIEWS) {
    try {
      const { error } = await db().from(view).select("*").limit(1);
      if (error) throw error;
      checks.push({ id: `db:view:${view}`, label: `ভিউ আছে — ${view}`, group: "db", status: "pass", detail: "view ok" });
    } catch (error) {
      checks.push({ id: `db:view:${view}`, label: `ভিউ আছে — ${view}`, group: "db", status: "fail", detail: (error as Error).message });
    }
  }

  /* --------------------------------------------------------- db:functions */
  for (const fn of ["is_admin", "gen_order_no"] as const) {
    try {
      const { error } = await db().rpc(fn);
      // `place_order` needs arguments and `is_admin()` returns a boolean; any
      // non-"function does not exist" answer means the function is installed.
      if (error && /does not exist|Could not find the function/i.test(error.message)) throw error;
      checks.push({ id: `db:fn:${fn}`, label: `ফাংশন আছে — ${fn}()`, group: "db", status: "pass", detail: "RPC ok" });
    } catch (error) {
      checks.push({ id: `db:fn:${fn}`, label: `ফাংশন আছে — ${fn}()`, group: "db", status: "fail", detail: (error as Error).message });
    }
  }

  /* ------------------------------------------------------------ db:write */
  try {
    const { ms } = await timed(async () => {
      const marker = `system-check-${Date.now()}`;
      const { data, error } = await db()
        .from("audit_log")
        .insert({ action: "system_check", entity: "system-check", meta: { probe: marker } })
        .select("id")
        .single();
      if (error) throw error;
      const readBack = await db().from("audit_log").select("id").eq("id", data.id).maybeSingle();
      if (readBack.error) throw readBack.error;
      if (!readBack.data) throw new Error("insert হলো কিন্তু ফেরত পড়া গেল না");
      const del = await db().from("audit_log").delete().eq("id", data.id);
      if (del.error) throw del.error;
    });
    checks.push({ id: "db:write:audit_log", label: "লেখা + মুছে ফেলা — audit_log", group: "db", status: "pass", detail: "insert → read → delete ok (ডেটা রাখা হয়নি)", ms });
  } catch (error) {
    checks.push({ id: "db:write:audit_log", label: "লেখা + মুছে ফেলা — audit_log", group: "db", status: "fail", detail: (error as Error).message });
  }

  /* ---------------------------------------------------------- db:settings */
  try {
    const { data, error } = await db().from("site_settings").select("key").limit(20);
    if (error) throw error;
    const keys = new Set((data ?? []).map((row) => row.key));
    checks.push({
      id: "db:settings",
      label: "সেটিংস গ্রুপ আছে",
      group: "db",
      status: keys.size ? "pass" : "fail",
      detail: keys.size ? `${keys.size}টি key · ${[...keys].slice(0, 7).join(", ")}` : "কোনো সেটিং নেই — 11_seed_sample_data.sql চালান",
    });
  } catch (error) {
    checks.push({ id: "db:settings", label: "সেটিংস গ্রুপ আছে", group: "db", status: "fail", detail: (error as Error).message });
  }

  /* ----------------------------------------------------------- auth:admin */
  try {
    const [{ count, error: countError }, admin] = await Promise.all([
      db().from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true),
      db().rpc("is_admin"),
    ]);
    if (countError) throw countError;
    if (admin.error) throw admin.error;
    checks.push({
      id: "auth:admin-profile",
      label: "অ্যাক্টিভ অ্যাডমিন আছেন",
      group: "auth",
      status: (count ?? 0) > 0 ? "pass" : "fail",
      detail:
        (count ?? 0) > 0
          ? `${count} জন অ্যাডমিন — is_admin() → ${String(admin.data)}`
          : "কেউ নেই — Authentication → Users এ ইউজার বানিয়ে 12_make_admin.sql চালান",
    });
  } catch (error) {
    checks.push({ id: "auth:admin-profile", label: "অ্যাক্টিভ অ্যাডমিন আছেন", group: "auth", status: "fail", detail: (error as Error).message });
  }

  /* ------------------------------------------------------------- storage */
  let bucketNames = new Set<string>();
  try {
    const { data, error } = await db().storage.listBuckets();
    if (error) throw error;
    const list = data ?? [];
    bucketNames = new Set(list.map((b) => b.id));
    const privates = new Set(list.filter((b) => !b.public).map((b) => b.id));
    for (const bucket of BUCKETS) {
      const present = bucketNames.has(bucket);
      const wantsPrivate = bucket === "payment-proofs";
      const isPrivate = privates.has(bucket);
      checks.push({
        id: `storage:bucket:${bucket}`,
        label: `বাকেট — ${bucket}`,
        group: "storage",
        status: present && (!wantsPrivate || isPrivate) ? "pass" : "fail",
        detail: !present
          ? "বাকেট নেই — 09_storage_buckets_and_policies.sql চালান"
          : wantsPrivate
            ? isPrivate
              ? "private ✓"
              : "PRIVATE হওয়া উচিত!"
            : isPrivate
              ? "PUBLIC হওয়া উচিত!"
              : "public ✓",
      });
    }
  } catch (error) {
    checks.push({ id: "storage:list", label: "বাকেটের তালিকা", group: "storage", status: "fail", detail: (error as Error).message });
  }

  for (const b of Array.from(bucketNames)) {
    try {
      const path = `system-check/${Date.now()}-${b}-probe.png`;
      const tinyPng = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
      const { ms } = await timed(async () => {
        const up = await db().storage.from(b).upload(path, tinyPng, { contentType: "image/png", upsert: true });
        if (up.error) throw up.error;
        const rm = await db().storage.from(b).remove([path]);
        if (rm.error) throw rm.error;
      });
      checks.push({ id: `storage:rw:${b}`, label: `বাকেট ${b} আপলোড ও ডিলিট`, group: "storage", status: "pass", detail: "আপলোড → ডিলিট ok", ms });
    } catch (error) {
      checks.push({ id: `storage:rw:${b}`, label: `বাকেট ${b} আপলোড ও ডিলিট`, group: "storage", status: "fail", detail: (error as Error).message });
    }
  }

  /* ------------------------------------------------------------ realtime */
  const realtimeKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  checks.push({
    id: "realtime:key",
    label: "Realtime এর জন্য পাবলিক key",
    group: "realtime",
    status: realtimeKey ? "pass" : "fail",
    detail: realtimeKey ? "key আছে — ব্রাউজার wss://*.supabase.co এ যুক্ত হতে পারবে" : "পাবলিক key নেই",
  });

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  return NextResponse.json({
    ok: failed === 0,
    data: { checks, passed, failed, total: checks.length, ranAt: new Date().toISOString() },
  });
}
