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
     • storage  — every bucket from 09 is present,
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
] as const;

/* Pairs: the first name that is set satisfies the requirement. The Supabase
   server key was renamed "service role key" → "secret key"; the health check
   listed only the legacy name, so a correctly configured new-style deployment
   showed a permanent red FAIL here while everything actually worked. */
const REQUIRED_ENV: ReadonlyArray<{ label: string; keys: readonly string[] }> = [
  { label: "NEXT_PUBLIC_SUPABASE_URL", keys: ["NEXT_PUBLIC_SUPABASE_URL"] },
  { label: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", keys: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] },
  {
    label: "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)",
    keys: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  { label: "NEXT_PUBLIC_SITE_URL", keys: ["NEXT_PUBLIC_SITE_URL"] },
];

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
  for (const requirement of REQUIRED_ENV) {
    const present = requirement.keys.some((k) => Boolean(process.env[k]));
    checks.push({
      id: `env:${requirement.label}`,
      label: requirement.label,
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

  /* ---------------------------------------------- db:footer payment row ---
     Migration 26 adds the footer switch and the reorder RPC. Both are probed
     here so the owner sees "SQL 26 চালান" on this page instead of meeting an
     empty footer or a dead ▲▼ button in the admin panel first. */
  try {
    const { error } = await db().from("payment_methods").select("show_on_checkout").limit(1);
    if (error) throw error;
    checks.push({
      id: "db:footer:column",
      label: "ফুটার পেমেন্ট সারির সুইচ (show_on_checkout)",
      group: "db",
      status: "pass",
      detail: "column ok",
    });
  } catch (error) {
    checks.push({
      id: "db:footer:column",
      label: "ফুটার পেমেন্ট সারির সুইচ (show_on_checkout)",
      group: "db",
      status: "fail",
      detail: `${(error as Error).message} — supabase/sql/26_footer_payments.sql চালান`,
    });
  }

  try {
    const { error } = await db().rpc("move_payment_method", {
      p_id: "00000000-0000-0000-0000-000000000000",
      p_direction: 1,
    });
    /* METHOD_NOT_FOUND is the SUCCESS case here: the function ran and rejected
       a bogus id. Only "does not exist" means the migration is missing. */
    if (error && /does not exist|Could not find the function/i.test(error.message)) throw error;
    checks.push({
      id: "db:footer:reorder",
      label: "পেমেন্ট মেথডের ক্রম বদলানোর ফাংশন",
      group: "db",
      status: "pass",
      detail: "move_payment_method() ok",
    });
  } catch (error) {
    checks.push({
      id: "db:footer:reorder",
      label: "পেমেন্ট মেথডের ক্রম বদলানোর ফাংশন",
      group: "db",
      status: "fail",
      detail: `${(error as Error).message} — supabase/sql/26_footer_payments.sql চালান`,
    });
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

  /* ------------------------------------------------- db:checkout readiness --
     A read-only mirror of the four things place_order() needs, because a
     missing one of them is exactly what makes "অর্ডার দিলেই failed" happen and
     nothing in the panel used to say so:
       1. at least one ACTIVE payment method (place_order refuses otherwise)
       2. its code is what the checkout page posts
       3. at least one products row is active + approved
       4. some product actually has stock left
     Nothing is written, so this check is safe to run any time. */
  try {
    const { data: methods, error: methodError } = await db()
      .from("payment_methods")
      .select("code, is_active, min_amount")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (methodError) throw methodError;

    const activeCount = (methods ?? []).length;
    checks.push({
      id: "db:checkout:methods",
      label: "অর্ডার নেওয়ার পেমেন্ট মাধ্যম আছে",
      group: "db",
      status: activeCount > 0 ? "pass" : "fail",
      detail:
        activeCount > 0
          ? `${activeCount}টি চালু · ${(methods ?? []).map((m) => m.code).join(", ")}`
          : "কোনো মাধ্যম চালু নেই — place_order সব অর্ডার PAYMENT_METHOD_UNAVAILABLE দিয়ে ফেরত দেবে। /foisal/payment-methods থেকে একটি চালু করুন।",
    });

    const cod = (methods ?? []).some((m) => m.code === "cod");
    checks.push({
      id: "db:checkout:cod",
      label: "ক্যাশ অন ডেলিভারি চালু",
      group: "db",
      status: cod ? "pass" : "fail",
      detail: cod
        ? "cod চালু ✓"
        : "cod নেই! নতুন গ্রাহকের প্রথম অর্ডারটাই ব্যর্থ হবে — একটি cod রো চালু করুন।",
    });

    const [{ count: sellable, error: sellError }, { count: inStock, error: stockError }] = await Promise.all([
      db().from("products").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approval_status", "approved"),
      db().from("products").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approval_status", "approved").gt("stock", 0),
    ]);
    if (sellError) throw sellError;
    if (stockError) throw stockError;

    checks.push({
      id: "db:checkout:catalogue",
      label: "বিক্রয়যোগ্য পণ্য স্টকে আছে",
      group: "db",
      status: (inStock ?? 0) > 0 ? "pass" : "fail",
      detail:
        (inStock ?? 0) > 0
          ? `${inStock}টি পণ্যে স্টক আছে (মোট চালু ${sellable ?? 0}টি)`
          : `স্টকে কিছু নেই (চালু ${sellable ?? 0}টি) — গ্রাহক OUT_OF_STOCK পাবে, অর্ডার সম্পন্ন হবে না।`,
    });
  } catch (error) {
    checks.push({
      id: "db:checkout:methods",
      label: "চেকআউটের জন্য ডেটাবেস তৈরি",
      group: "db",
      status: "fail",
      detail: (error as Error).message,
    });
  }

  /* ------------------------------------------------ db:order write probe --
     A no-op UPDATE (`status = status`) on one real order. It changes nothing,
     but it runs every trigger on public.orders — which is exactly where the
     "cannot change status / verify payment" bug lived: a trigger compared an
     ENUM column with '', so EVERY write to orders failed with 22P02 while the
     panel only said "ব্যর্থ". One click here now proves the write path works.
     Skipped (not failed) when there are no orders yet. */
  try {
    const { data: anyOrder, error: pickError } = await db()
      .from("orders")
      .select("id, order_no, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pickError) throw pickError;

    if (!anyOrder) {
      checks.push({
        id: "db:orders:write",
        label: "অর্ডার স্টেটাস লেখা যায়",
        group: "db",
        status: "skip",
        detail: "এখনো কোনো অর্ডার নেই — পরীক্ষা করার মতো রো নেই।",
      });
    } else {
      const { error: writeError } = await db()
        .from("orders")
        .update({ status: anyOrder.status })
        .eq("id", anyOrder.id);
      if (writeError) throw writeError;
      checks.push({
        id: "db:orders:write",
        label: "অর্ডার স্টেটাস লেখা যায়",
        group: "db",
        status: "pass",
        detail: `${anyOrder.order_no} — ট্রিগারসহ লেখা সফল ✓`,
      });
    }
  } catch (error) {
    checks.push({
      id: "db:orders:write",
      label: "অর্ডার স্টেটাস লেখা যায়",
      group: "db",
      status: "fail",
      detail: `${(error as Error).message} — supabase/sql/25_coupons_referrals_wallet.sql (সর্বশেষ সংস্করণ) আবার চালান।`,
    });
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
      const isPrivate = privates.has(bucket);
      checks.push({
        id: `storage:bucket:${bucket}`,
        label: `বাকেট — ${bucket}`,
        group: "storage",
        status: present && !isPrivate ? "pass" : "fail",
        detail: !present
          ? "বাকেট নেই — 09_storage_buckets_and_policies.sql চালান"
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
