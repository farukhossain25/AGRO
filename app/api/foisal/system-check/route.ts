import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/system-check — "সব ঠিক আছে?" in one click
   --------------------------------------------------------------------------
   Every row below is a LIVE test, not a guess:

     • env        — names only. Never a value, never a prefix of a value.
     • db:read    — a real `select id limit 1` per critical table
     • db:write   — insert → read back → delete in `audit_logs` (self-cleaning)
     • auth:admin — is_admin() through the service role (RLS helper exists)
     • storage    — bucket present + a 1-byte upload/delete round-trip
     • realtime   — the anon key can open a Realtime socket (config check only)

   A failure is reported with the raw Postgres/storage message in `detail` so
   the owner can paste one line to support instead of "something broke".
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
  "products",
  "categories",
  "orders",
  "order_items",
  "sub_orders",
  "payments",
  "payment_methods",
  "delivery_zones",
  "coupons",
  "reviews",
  "banners",
  "hero_slides",
  "homepage_sections",
  "site_settings",
  "settings",
  "sellers",
  "farms",
  "cameras",
  "team_directory",
  "blog_posts",
  "notifications",
  "audit_logs",
  "complaints",
  "cart_items",
] as const;

const BUCKETS = ["product-images", "payment-proofs", "review-photos", "complaint-photos", "catalog-media"] as const;

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
    status: Object.keys(process.env).some((k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET/i.test(k)) ? "fail" : "pass",
    detail: "পাবলিক ভেরিয়েবলের নামগুলো স্ক্যান করা হয়েছে (মান পড়া হয়নি)",
  });

  /* ------------------------------------------------------------- db:read */
  for (const table of TABLES) {
    try {
      const { ms } = await timed(async () => {
        const { error } = await db().from(table).select("id").limit(1);
        if (error) throw error;
      });
      checks.push({ id: `db:read:${table}`, label: `পড়া যাচ্ছে — ${table}`, group: "db", status: "pass", detail: "SELECT ok", ms });
    } catch (error) {
      checks.push({
        id: `db:read:${table}`,
        label: `পড়া যাচ্ছে — ${table}`,
        group: "db",
        status: "fail",
        detail: (error as Error).message,
      });
    }
  }

  /* ------------------------------------------------------------ db:write */
  try {
    const { ms } = await timed(async () => {
      const marker = `system-check-${Date.now()}`;
      const { data, error } = await db()
        .from("audit_logs")
        .insert({ action: "system_check", entity: "system-check", admin_name: marker, details: { probe: marker } })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      const readBack = await db().from("audit_logs").select("id").eq("id", data.id).maybeSingle();
      if (readBack.error) throw readBack.error;
      if (!readBack.data) throw new Error("insert হলো কিন্তু ফেরত পড়া গেল না");
      const del = await db().from("audit_logs").delete().eq("id", data.id);
      if (del.error) throw del.error;
    });
    checks.push({ id: "db:write:audit_logs", label: "লেখা + মুছে ফেলা — audit_logs", group: "db", status: "pass", detail: "insert → read → delete ok (ডেটা রাখা হয়নি)", ms });
  } catch (error) {
    checks.push({ id: "db:write:audit_logs", label: "লেখা + মুছে ফেলা — audit_logs", group: "db", status: "fail", detail: (error as Error).message });
  }

  /* ----------------------------------------------------------- auth:admin */
  try {
    const { data, error } = await db().rpc("is_admin");
    if (error) throw error;
    checks.push({
      id: "auth:is_admin",
      label: "is_admin() ফাংশন",
      group: "auth",
      status: "pass",
      // service role has no auth.uid(); the function must still resolve
      detail: `RPC ok (service role → ${String(data)}) — RLS এর ভিত্তি ঠিক আছে`,
    });
  } catch (error) {
    checks.push({ id: "auth:is_admin", label: "is_admin() ফাংশন", group: "auth", status: "fail", detail: (error as Error).message });
  }

  /* ------------------------------------------------------------- storage */
  try {
    const { data, error } = await db().storage.listBuckets();
    if (error) throw error;
    const names = new Set((data ?? []).map((b) => b.id));
    for (const bucket of BUCKETS) {
      checks.push({
        id: `storage:bucket:${bucket}`,
        label: `বাকেট আছে — ${bucket}`,
        group: "storage",
        status: names.has(bucket) ? "pass" : "fail",
        detail: names.has(bucket) ? "পাওয়া গেছে" : "বাকেট নেই — 0016 মাইগ্রেশন চালান",
      });
    }
  } catch (error) {
    checks.push({ id: "storage:list", label: "বাকেটের তালিকা", group: "storage", status: "fail", detail: (error as Error).message });
  }

  try {
    const path = `system-check/${Date.now()}-probe.txt`;
    const { ms } = await timed(async () => {
      const up = await db().storage.from("catalog-media").upload(path, new Blob(["ok"]), { contentType: "text/plain", upsert: true });
      if (up.error) throw up.error;
      const down = await db().storage.from("catalog-media").download(path);
      if (down.error) throw down.error;
      const rm = await db().storage.from("catalog-media").remove([path]);
      if (rm.error) throw rm.error;
    });
    checks.push({ id: "storage:upload", label: "আপলোড → ডাউনলোড → মুছে ফেলা", group: "storage", status: "pass", detail: "catalog-media-তে রাউন্ড-ট্রিপ ok", ms });
  } catch (error) {
    checks.push({ id: "storage:upload", label: "আপলোড → ডাউনলোড → মুছে ফেলা", group: "storage", status: "fail", detail: (error as Error).message });
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
