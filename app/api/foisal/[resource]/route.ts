import { revalidatePath } from "next/cache";
import { dbDynamic } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { slugifyAscii } from "@/lib/format";
import { recordAudit, diffOf } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { clientIp } from "@/lib/api";
import type { Permission } from "@/lib/permissions";
import { ensureSellerFarm, provisionRequestCameras } from "@/lib/seller-farm";
import type { Seller } from "@/lib/types";
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

/** Every real column of `sellers`. The admin UI used to decorate each row with
 *  a display-only `contact` key (phone · email) and then PATCH the whole row
 *  back, so Postgres answered "column contact does not exist". A whitelist
 *  keeps display helpers out of the write path for good. */
const SELLER_COLUMNS = [
  "user_id",
  "slug",
  "farm_id",
  "name_bn",
  "phone",
  "email",
  "nid",
  "farm_address_bn",
  "division",
  "district",
  "upazila",
  "farm_photos",
  "product_types",
  "payout_method",
  "payout_number",
  "bank_name",
  "bank_account",
  "commission_percent",
  "status",
  "rejection_reason",
  "approved_at",
  "created_at",
  "updated_at",
];

/** Real columns of `cameras`. The panel decorates each row with `farm_name`
 *  for the table, and the admin cameras page had the same "column does not
 *  exist" failure as sellers did — editing any camera PATCHed `farm_name`. */
const CAMERA_COLUMNS = [
  "farm_id",
  "name_bn",
  "zone_bn",
  "protocol",
  "stream_key",
  "stream_url",
  "poster",
  "location_lat",
  "location_lng",
  "status",
  "last_heartbeat",
  "is_active",
  "is_premium",
  "max_viewers",
  "sort_order",
  "created_at",
  "updated_at",
];

/** Real columns of `farms`. */
const FARM_COLUMNS = [
  "slug",
  "name_bn",
  "name_en",
  "type",
  "owner_user_id",
  "owner_name_bn",
  "owner_phone",
  "owner_photo",
  "owner_bio_bn",
  "division",
  "district",
  "upazila",
  "address_bn",
  "lat",
  "lng",
  "boundary",
  "harvest_calendar",
  "daily_output",
  "description_bn",
  "story_bn",
  "cover",
  "images",
  "established_year",
  "certifications",
  "is_active",
  "is_premium",
  "sort_order",
  "created_at",
  "updated_at",
];

/** Real columns of `camera_requests` (seller/farm names are joined for display). */
/** Real columns of `combos` — the storefront combo boxes (/combos). `contents`
 *  is the jsonb list of {name, qty} lines printed on the card. */
const COMBO_COLUMNS = [
  "slug",
  "name_bn",
  "name_en",
  "description_bn",
  "kind",
  "price",
  "original_price",
  "contents",
  "image",
  "is_active",
  "sort_order",
];

const CAMERA_REQUEST_COLUMNS = [
  "seller_id",
  "farm_id",
  "user_id",
  "contact_name",
  "contact_phone",
  "note_bn",
  "camera_count",
  "status",
  "admin_note",
  "created_at",
  "updated_at",
];

/** Coerce empty strings to null and numeric strings to numbers. When
 *  `allowed` is given, anything that is not a column is dropped — a
 *  display-only key must never reach the table. */
function lightSchema(numeric: string[] = [], dates: string[] = [], allowed?: string[]): LightSchema {
  return {
    parse(input) {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (key === "id") continue;
        if (allowed && !allowed.includes(key)) continue;
        out[key] = value;
      }
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
    ["created_at"],
    FARM_COLUMNS
  ),
  cameras: lightSchema(
    ["location_lat", "location_lng", "max_viewers", "sort_order"],
    ["last_heartbeat"],
    CAMERA_COLUMNS
  ),
  "premium-plans": lightSchema(["price", "compare_price", "duration_days", "max_devices", "sort_order"]),
  "access-codes": lightSchema([], ["expires_at"]),
  sellers: lightSchema(["commission_percent"], ["approved_at"], SELLER_COLUMNS),
  payouts: lightSchema(["amount"], ["paid_at"]),
  "camera-requests": lightSchema(["camera_count"], [], CAMERA_REQUEST_COLUMNS),
  combos: lightSchema(["price", "original_price", "sort_order"], [], COMBO_COLUMNS),
  notifications: lightSchema([]),
  seo: lightSchema([], []),
  "cms-pages": lightSchema([], []),
  faq: lightSchema(["sort_order"]),
  menus: lightSchema([], []),
  "static-pages": lightSchema(["sort_order"], []),
};

const tables: Record<string, string> = {
  categories: "categories",
  coupons: "coupons",
  blog: "blog_posts",
  banners: "banners",
  delivery: "delivery_charges",
  farms: "farms",
  cameras: "cameras",
  "premium-plans": "plans",
  "access-codes": "access_codes",
  sellers: "sellers",
  payouts: "seller_payouts",
  "camera-requests": "camera_requests",
  combos: "combos",
  notifications: "notifications",
  seo: "seo_meta",
  "cms-pages": "static_pages",
  faq: "faq_items",
  menus: "menus",
  "static-pages": "static_pages",
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
  combos: { read: "products.read", write: "combos.write" },
  notifications: { read: "customers.read", write: "customers.read" },
  seo: { read: "seo.write", write: "seo.write" },
  "cms-pages": { read: "content.write", write: "content.write" },
  faq: { read: "content.write", write: "content.write" },
  menus: { read: "content.write", write: "content.write" },
  "static-pages": { read: "content.write", write: "content.write" },
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
  if (resource === "combos") {
    out.kind = ["daily", "weekly", "monthly"].includes(String(out.kind)) ? out.kind : "daily";
    out.is_active = out.is_active !== false;
    out.price = Number(out.price ?? 0);
    if (out.original_price !== null && out.original_price !== undefined) {
      out.original_price = Number(out.original_price) || null;
    }
    // `contents` arrives from the form as "name | qty" lines; store the
    // {name, qty} shape the storefront card renders.
    const raw = out.contents;
    let lines: { name: string; qty: string }[] = [];
    if (typeof raw === "string") {
      lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [name, ...rest] = l.split("|");
          return { name: (name ?? "").trim(), qty: rest.join("|").trim() || "১টি" };
        });
    } else if (Array.isArray(raw)) {
      lines = raw
        .map((c) =>
          c && typeof c === "object" && "name" in c
            ? { name: String((c as { name: unknown }).name ?? ""), qty: String((c as { qty: unknown }).qty ?? "১টি") }
            : null
        )
        .filter((c): c is { name: string; qty: string } => c !== null);
    }
    out.contents = lines.filter((l) => l.name);
    if (!out.slug) {
      out.slug = slugifyAscii(String(out.name_en || out.name_bn || "combo"), `combo-${Date.now().toString(36)}`);
    }
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

/** The storefront pages that read this resource are ISR-cached; drop their
 *  cache after a write so the panel's change shows up on the next visit. */
async function afterWrite(resource: string) {
  if (resource !== "combos") return;
  revalidatePath("/combos");
  revalidatePath("/combos/[slug]", "page");
  revalidatePath("/");
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

    const { data, error } = await dbDynamic().from(table).select("*").limit(500);
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

    const { data, error } = await dbDynamic()
      .from(table)
      .insert(normalise(resource, parsed))
      .select()
      .single();

    if (error) throw error;
    await afterWrite(resource);

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

    const { data: before } = await dbDynamic().from(table).select("*").eq("id", id).maybeSingle();

    /* Approving / rejecting a seller carries meaning beyond the status column:
       `approved_at` is what /market/<slug> and the payout report read, and a
       rejection is meaningless without its reason. Keep those in sync here so
       every client (this panel or a future one) can't get it half-right. */
    if (resource === "sellers") {
      const status = patch.status as string | undefined;
      if (status === "approved") {
        patch.rejection_reason = null;
        const previous = before as { approved_at?: string | null } | null;
        if (!previous?.approved_at) patch.approved_at = new Date().toISOString();
      } else if (status === "rejected") {
        patch.approved_at = null;
      } else if (status === "pending") {
        patch.approved_at = null;
        patch.rejection_reason = null;
      }
    }

    const { data, error } = await dbDynamic()
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

    /* A decision the seller can't see is not a decision — tell them. */
    if (resource === "sellers") {
      const beforeRow = before as { user_id?: string | null; status?: string; name_bn?: string } | null;
      const afterRow = data as { status?: string; rejection_reason?: string | null };
      if (beforeRow?.user_id && afterRow?.status && afterRow.status !== beforeRow.status) {
        const approved = afterRow.status === "approved";
        const suspended = afterRow.status === "suspended";
        await notify({
          userId: beforeRow.user_id,
          kind: "seller",
          title: approved
            ? "আপনার সেলার অ্যাকাউন্ট অনুমোদিত"
            : suspended
              ? "আপনার সেলার অ্যাকাউন্ট স্থগিত করা হয়েছে"
              : "আপনার সেলার আবেদন বাতিল হয়েছে",
          body: approved
            ? "এখন পণ্য যোগ করে বিক্রি শুরু করতে পারবেন।"
            : afterRow.rejection_reason || "বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
          link: "/seller",
        }).catch(() => undefined);
      }
    }

    /* Approval also means "you now exist publicly": give the seller a farm so
       they appear under "আমাদের খামার" and have somewhere to hang cameras.
       Must never fail the approval itself. */
    if (resource === "sellers") {
      const after = data as unknown as Seller;
      const beforeStatus = (before as { status?: string } | null)?.status;
      if (after?.status === "approved" && (!after.farm_id || beforeStatus !== "approved")) {
        await ensureSellerFarm(after).catch((e) =>
          console.warn("[sellers] farm auto-create failed:", (e as Error).message)
        );
      }
    }

    /* "ইনস্টল সম্পন্ন" is the moment a camera request becomes real cameras —
       otherwise the live page has nothing to show. Only on the transition
       into `installed`, so re-saving the row never duplicates them. */
    if (resource === "camera-requests") {
      const after = data as {
        id: string;
        seller_id: string | null;
        farm_id: string | null;
        camera_count: number;
        status: string;
      };
      const beforeStatus = (before as { status?: string } | null)?.status;
      if (after?.status === "installed" && beforeStatus !== "installed") {
        const result = await provisionRequestCameras({
          id: after.id,
          seller_id: after.seller_id,
          farm_id: after.farm_id,
          camera_count: after.camera_count,
        }).catch((e) => {
          console.warn("[camera-requests] provisioning failed:", (e as Error).message);
          return null;
        });

        if (result?.created && result.sellerUserId) {
          await notify({
            userId: result.sellerUserId,
            audience: "seller",
            kind: "camera",
            title: "আপনার ক্যামেরা ইনস্টল সম্পন্ন",
            body: `${result.created}টি ক্যামেরা লাইভ হয়েছে${result.farmSlug ? ` — /live/farms/${result.farmSlug}` : ""}।`,
            link: "/seller/cameras",
          }).catch(() => undefined);
        }
      }
    }
    await afterWrite(resource);

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

    const { data: before } = await dbDynamic().from(table).select("*").eq("id", id).maybeSingle();
    const { error } = await dbDynamic().from(table).delete().eq("id", id);
    if (error) throw error;
    await afterWrite(resource);

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
