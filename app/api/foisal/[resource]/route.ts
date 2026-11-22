import { db } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { recordAudit, diffOf } from "@/lib/audit";
import { clientIp } from "@/lib/auth-attempts";
import type { Permission } from "@/lib/permissions";
import { ZodError } from "zod";
import {
  bannerSchema,
  blogSchema,
  categorySchema,
  couponSchema,
  deliveryZoneSchema,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Generic CRUD for the simpler admin entities.
 * Products and orders have dedicated routes with extra logic.
 *
 * Premium-era resources (farms, cameras, premium plans, access codes) are
 * validated with light inline schemas — they are admin-only, so the strictness
 * lives in the DB constraints and the UI form.
 */

type LightSchema = {
  parse: (input: unknown) => Record<string, unknown>;
};

/** Coerce empty strings to null and numeric strings to numbers. */
function lightSchema(numeric: string[] = [], dates: string[] = []): LightSchema {
  return {
    parse(input) {
      const out = { ...(input as Record<string, unknown>) };
      delete out.id;
      for (const key of Object.keys(out)) {
        if (out[key] === "") out[key] = null;
        if (numeric.includes(key) && out[key] !== null && out[key] !== undefined) {
          const n = Number(out[key]);
          out[key] = Number.isFinite(n) ? n : null;
        }
        if (dates.includes(key) && out[key]) out[key] = new Date(String(out[key])).toISOString();
      }
      return out;
    },
  };
}

const schemas: Record<string, LightSchema> = {
  categories: categorySchema,
  coupons: couponSchema,
  blog: blogSchema,
  banners: bannerSchema,
  delivery: deliveryZoneSchema,

  farms: lightSchema(
    ["lat", "lng", "established_year", "sort_order"],
    ["created_at"]
  ),
  cameras: lightSchema(
    ["location_lat", "location_lng", "max_viewers", "sort_order"],
    ["last_heartbeat"]
  ),
  "premium-plans": lightSchema(["price", "compare_price", "duration_days", "max_devices", "sort_order"]),
  "access-codes": lightSchema([], ["expires_at"]),
  sellers: lightSchema(["commission_percent"], ["approved_at"]),
  payouts: lightSchema(["gross", "commission", "net", "orders_count"], ["paid_at"]),
  "camera-requests": lightSchema(["camera_count"]),
  notifications: lightSchema([]),
  seo: lightSchema([], []),
  "cms-pages": lightSchema([], []),
  faq: lightSchema(["sort_order"]),
};

const tables: Record<string, string> = {
  categories: "categories",
  coupons: "coupons",
  blog: "blog_posts",
  banners: "banners",
  delivery: "delivery_zones",
  farms: "farms",
  cameras: "cameras",
  "premium-plans": "premium_plans",
  "access-codes": "premium_access_codes",
  sellers: "sellers",
  payouts: "seller_payouts",
  "camera-requests": "camera_requests",
  notifications: "notifications",
  seo: "seo_meta",
  "cms-pages": "cms_pages",
  faq: "faq_items",
};

function tableFor(resource: string): string | null {
  return tables[resource] ?? null;
}

/* Section F: the generic CRUD endpoint is no longer admin-only. Each resource
   declares the permission its READ and WRITE need, so a staff account can edit
   the blog but not coupons, and a manager can do everything except settings. */
const ACCESS: Record<string, { read: Permission; write: Permission }> = {
  categories: { read: "products.read", write: "categories.write" },
  coupons: { read: "orders.read", write: "coupons.write" },
  blog: { read: "content.write", write: "content.write" },
  banners: { read: "content.write", write: "content.write" },
  delivery: { read: "settings.write", write: "settings.write" },
  farms: { read: "cams.manage", write: "cams.manage" },
  cameras: { read: "cams.manage", write: "cams.manage" },
  "premium-plans": { read: "premium.manage", write: "premium.manage" },
  "access-codes": { read: "premium.manage", write: "premium.manage" },
  sellers: { read: "sellers.read", write: "sellers.approve" },
  payouts: { read: "payouts.read", write: "payouts.write" },
  "camera-requests": { read: "cams.manage", write: "cams.manage" },
  notifications: { read: "customers.read", write: "customers.read" },
  seo: { read: "seo.write", write: "seo.write" },
  "cms-pages": { read: "content.write", write: "content.write" },
  faq: { read: "content.write", write: "content.write" },
};

function accessFor(resource: string) {
  return ACCESS[resource] ?? { read: "admin.access" as Permission, write: "admin.access" as Permission };
}

function normalise(resource: string, input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  delete out.id;

  if (resource === "coupons") {
    out.expires_at = out.expires_at ? new Date(String(out.expires_at)).toISOString() : null;
  }
  if (resource === "blog") {
    out.is_active = out.is_active !== false;
  }
  if (resource === "cms-pages") {
    // blocks arrive as JSON text from the textarea
    if (typeof out.blocks === "string") {
      try {
        const parsed = JSON.parse(out.blocks as string);
        out.blocks = Array.isArray(parsed) ? parsed : [];
      } catch {
        delete out.blocks;
      }
    }
    out.is_published = out.is_published !== false;
    out.show_in_footer = out.show_in_footer !== false;
  }
  if (resource === "seo") {
    // keywords arrive as a comma separated string from the form
    if (typeof out.keywords_bn === "string") {
      out.keywords_bn = (out.keywords_bn as string)
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
    out.noindex = out.noindex === true;
  }
  if (resource === "delivery") {
    delete out.district_en;
  }
  // JSONB columns arrive as strings from the form.
  for (const key of ["features", "harvest_calendar", "daily_output", "boundary", "meta", "label"]) {
    if (typeof out[key] === "string") {
      try {
        out[key] = JSON.parse(out[key] as string);
      } catch {
        delete out[key];
      }
    }
  }

  for (const key of Object.keys(out)) {
    if (out[key] === "") out[key] = null;
  }
  return out;
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) return handleError(error);
  const code = (error as { status?: number }).status;
  if (code === 401) return fail("অনুমতি নেই", 401);
  if (code === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
  return handleError(error);
}

export async function GET(_req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    await requirePermission(accessFor(resource).read);
    const table = tableFor(resource);
    if (!table) return fail("অজানা রিসোর্স", 404);

    const { data, error } = await db().from(table).select("*").limit(500);
    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const actor = await requirePermission(accessFor(resource).write);
    const table = tableFor(resource);
    const schema = schemas[resource];
    if (!table || !schema) return fail("অজানা রিসোর্স", 404);

    const raw = await req.json();
    const parsed = schema.parse(raw);

    const { data, error } = await db()
      .from(table)
      .insert(normalise(resource, parsed))
      .select()
      .single();

    if (error) throw error;

    await recordAudit({
      actor,
      action: "create",
      entity: table,
      entityId: (data as { id?: string })?.id ?? null,
      diff: diffOf(null, normalise(resource, parsed)),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const actor = await requirePermission(accessFor(resource).write);
    const table = tableFor(resource);
    const schema = schemas[resource];
    if (!table || !schema) return fail("অজানা রিসোর্স", 404);

    const raw = (await req.json()) as Record<string, unknown>;
    const id = raw.id;
    if (typeof id !== "string") return fail("আইডি দিন", 422);

    const parsed = schema.parse(raw);
    const patch = normalise(resource, parsed);

    const { data: before } = await db().from(table).select("*").eq("id", id).maybeSingle();

    const { data, error } = await db()
      .from(table)
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await recordAudit({
      actor,
      action: "update",
      entity: table,
      entityId: id,
      diff: diffOf(before as Record<string, unknown> | null, patch),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const actor = await requirePermission(accessFor(resource).write);
    const table = tableFor(resource);
    if (!table) return fail("অজানা রিসোর্স", 404);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const { data: before } = await db().from(table).select("*").eq("id", id).maybeSingle();
    const { error } = await db().from(table).delete().eq("id", id);
    if (error) throw error;

    await recordAudit({
      actor,
      action: "delete",
      entity: table,
      entityId: id,
      diff: before ? { deleted: { from: before, to: null } } : null,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
