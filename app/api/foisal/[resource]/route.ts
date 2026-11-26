import { revalidatePath } from "next/cache";
import { dbDynamic } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { slugifyAscii, toBn } from "@/lib/format";
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
  walletAdjustSchema,
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
  /* cloud bridge (migration 24) — the seller's own app keeps the camera online */
  "cloud_provider",
  "cloud_serial",
  "cloud_channel",
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

/** Real columns of `subscription_plans` — the monthly food boxes. */
const SUBSCRIPTION_PLAN_COLUMNS = [
  "slug",
  "name_bn",
  "name_en",
  "members_label",
  "members_min",
  "members_max",
  "price_monthly",
  "saving_label",
  "features",
  "image",
  "is_popular",
  "is_active",
  "sort_order",
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
  /* The monthly food plans the storefront sells (/subscription). price_monthly
     and the member band are numbers; features is a text[] the form sends as an
     array of lines. */
  "subscription-plans": lightSchema(
    ["price_monthly", "members_min", "members_max", "sort_order"],
    [],
    SUBSCRIPTION_PLAN_COLUMNS
  ),
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
  /* Who may use a restricted coupon. Rows are (coupon_id, user_id); the admin
     form sends a phone or an email and this route resolves it. */
  "coupon-audiences": lightSchema([], []),
  /* Wallet — read-only list of balances plus a manual credit/debit action. */
  wallet: lightSchema([], []),
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
  "subscription-plans": "subscription_plans",
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
  "coupon-audiences": "coupon_audiences",
  wallet: "profiles",
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
  /* What the family pays per month is a commercial decision — same permission
     as the premium plans. */
  "subscription-plans": { read: "orders.read", write: "settings.write" },
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
  "coupon-audiences": { read: "orders.read", write: "coupons.write" },
  wallet: { read: "customers.read", write: "settings.write" },
};

function accessFor(resource: string) {
  return ACCESS[resource] ?? { read: "admin.access" as Permission, write: "admin.access" as Permission };
}

function normalise(resource: string, input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  delete out.id;

  if (resource === "coupons") {
    out.starts_at = out.starts_at ? new Date(String(out.starts_at)).toISOString() : null;
    out.expires_at = out.expires_at ? new Date(String(out.expires_at)).toISOString() : null;
    out.audience = ["all", "assigned", "influencer"].includes(String(out.audience))
      ? out.audience
      : "all";
    // `all` never keeps a funder; the other two always do.
    if (out.audience === "all") out.funder_user_id = null;
    // An influencer code is shared by link. Token comes from the row id when
    // there is one; a brand-new code gets its token on the first save below.
    if (out.audience === "influencer" && !out.share_token) {
      // Keep the token that is already in the row; mint one only when missing.
      // Uppercase base-32-ish so it survives being read over the phone.
      out.share_token = randomShareToken();
    } else if (out.audience !== "influencer") {
      // `all` / `assigned` codes have no public link.
      out.share_token = null;
    }
    // The contact list is handled separately (it maps to another table), so it
    // must never reach the UPDATE/INSERT on `coupons`.
    delete out.audience_contacts;
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
  if (resource === "subscription-plans") {
    /* The monthly food plans. Three things the generic schema cannot know:
       a slug is required, the member band must stay ordered (max >= min), and
       `features` is a text[] — the form sends one line per item, and a stray
       "[]"/JSON string from an older client must not be stored verbatim. */
    if (!out.slug) {
      out.slug = slugifyAscii(String(out.name_en || out.name_bn || "plan"), `plan-${Date.now().toString(36)}`);
    }
    out.price_monthly = Number(out.price_monthly ?? 0);
    const min = Math.max(1, Math.round(Number(out.members_min ?? 1)) || 1);
    const max = Math.max(min, Math.round(Number(out.members_max ?? 10)) || 10);
    out.members_min = min;
    out.members_max = max;
    /* Bangla digits: the label is customer-facing copy on /subscription and
       the home page, where every other number is already Bengali. */
    if (!out.members_label) out.members_label = `${toBn(min)}-${toBn(max)} জন`;
    out.is_popular = out.is_popular === true;
    out.is_active = out.is_active !== false;
    const f = out.features;
    if (typeof f === "string") {
      out.features = f
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    } else if (Array.isArray(f)) {
      out.features = f.map((l) => String(l).trim()).filter(Boolean);
    } else {
      delete out.features;
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
  if (resource === "subscription-plans") {
    /* The home page's plan strip, /subscription and the sitemap all print
       these rows, and they are ISR-cached — without this an edited price can
       keep showing the old number for up to five minutes. */
    revalidatePath("/subscription");
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
    return;
  }
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



const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The admin may type the influencer's phone/email instead of a UUID. */
async function resolveFunder(value: unknown): Promise<string | null | "MISSING"> {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;
  const { ids, missing } = await resolveContacts([raw]);
  if (missing.length || !ids.length) return "MISSING";
  return ids[0];
}


/** 10 characters, no vowels-that-look-like-digits confusion … short enough to
 *  type, long enough that guessing another influencer's link is pointless. */
function randomShareToken(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I O 0 1
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/* ---------------------------------------------------------------- coupons --
   A restricted coupon is handed out as a list of people, not UUIDs. The admin
   types phones/emails; we resolve each to a profile and write coupon_audiences.
   Unknown contacts are reported back by name so nothing is silently dropped. */
async function resolveContacts(
  contacts: string[]
): Promise<{ ids: string[]; missing: string[] }> {
  const ids = new Set<string>();
  const missing: string[] = [];

  const clean = contacts
    .map((c) => String(c).trim())
    .filter(Boolean)
    .slice(0, 500);

  for (const contact of clean) {
    const isEmail = contact.includes("@");
    let query = dbDynamic().from("profiles").select("id, full_name").limit(1);
    query = isEmail
      ? query.ilike("email", contact)
      : query.eq("phone", normalizePhone(contact));

    const { data } = await query.maybeSingle();
    if (data?.id) ids.add(data.id);
    else missing.push(contact);
  }

  return { ids: [...ids], missing };
}

function normalizePhone(value: string): string {
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0")) return digits;
  return digits.length === 10 ? `0${digits}` : digits;
}

/** Replace a coupon's audience list with exactly these accounts. */
async function syncCouponAudience(couponId: string, userIds: string[]) {
  await dbDynamic().from("coupon_audiences").delete().eq("coupon_id", couponId);
  if (!userIds.length) return;
  const { error } = await dbDynamic()
    .from("coupon_audiences")
    .insert(userIds.map((user_id) => ({ coupon_id: couponId, user_id })));
  if (error) throw error;
}

/** The contacts a coupon already has, for the edit form. */
async function audienceContacts(couponId: string): Promise<string[]> {
  const { data: links } = await dbDynamic()
    .from("coupon_audiences")
    .select("user_id")
    .eq("coupon_id", couponId);
  const ids = (links ?? []).map((l) => l.user_id);
  if (!ids.length) return [];

  const { data: people } = await dbDynamic()
    .from("profiles")
    .select("id, phone, email")
    .in("id", ids);

  return (people ?? []).map((p) => p.phone || p.email || p.id);
}

/* ----------------------------------------------------------------- wallet --
   Money never moves from the browser: the admin's adjustment is validated and
   then handed to wallet_apply(), which owns the arithmetic and the ledger. */
async function walletBalances(q: string | null) {
  let query = dbDynamic()
    .from("profiles")
    .select("id, full_name, phone, email, wallet_balance, wallet_earned, wallet_spent, referral_code")
    .order("wallet_balance", { ascending: false })
    .limit(100);

  if (q && q.trim()) {
    const term = q.trim();
    const digits = normalizePhone(term);
    query = query.or(`full_name.ilike.%${term}%,phone.eq.${digits},email.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function GET(_req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    await requirePermission(accessFor(resource).read);
    const table = tableFor(resource);
    if (!table) return fail("অজানা রিসোর্স", 404);

    /* ?id=<coupon> on coupon-audiences returns that coupon's contacts (the
       edit form needs phones/emails, not profile ids). */
    if (resource === "coupon-audiences") {
      const id = new URL(_req.url).searchParams.get("id");
      if (id) return ok({ contacts: await audienceContacts(id) });
    }

    if (resource === "wallet") {
      return ok(await walletBalances(new URL(_req.url).searchParams.get("q")));
    }

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

    /* Wallet adjustments are not rows in a table — they are an RPC call. */
    if (resource === "wallet") {
      const adj = walletAdjustSchema.parse(raw);
      const { data: balance, error } = await dbDynamic().rpc("wallet_apply", {
        p_user: adj.user_id,
        p_kind: "admin",
        p_amount: adj.amount,
        p_note: adj.note_bn || (adj.amount > 0 ? "অ্যাডমিন ক্রেডিট" : "অ্যাডমিন ডেবিট"),
        p_by: actor.id,
      });
      if (error) {
        if ((error.message ?? "").includes("WALLET_INSUFFICIENT")) {
          return fail("ব্যালেন্স ঋণাত্মক হয়ে যাবে — অঙ্কটি কমিয়ে দিন", 422);
        }
        throw error;
      }
      await recordAudit({
        actor,
        action: "update",
        entity: "wallet_transactions",
        entityId: adj.user_id,
        diff: { wallet_adjust: { amount: adj.amount, note: adj.note_bn ?? null } },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return ok({ balance });
    }

    const parsed = schema.parse(raw);

    /* A coupon is saved first; the people it is handed to are a second table,
       so the audience is written after we have the coupon's id. */
    if (resource === "coupons") {
      const contacts = Array.isArray((parsed as { audience_contacts?: string[] }).audience_contacts)
        ? ((parsed as { audience_contacts?: string[] }).audience_contacts as string[])
        : [];
      const row = normalise(resource, parsed);

      // "ইনফ্লুয়েন্সার" may arrive as a phone/email — resolve it to a profile
      // id, and refuse to save a coupon attributed to nobody.
      /* An influencer code MUST name its influencer — that is who earns the
         commission. An `assigned` list may be used without one. */
      if (row.audience === "influencer" || row.audience === "assigned") {
        const funder = await resolveFunder(row.funder_user_id);
        if (funder === "MISSING") {
          return fail("ইনফ্লুয়েন্সারের ফোন/ইমেইল খুঁজে পাওয়া যায়নি — আগে তাকে অ্যাকাউন্ট খুলতে হবে", 422);
        }
        if (row.audience === "influencer" && !funder) {
          return fail("এই কুপনটি কার — ইনফ্লুয়েন্সারের ফোন/ইমেইল দিন", 422);
        }
        row.funder_user_id = funder;
      } else {
        row.funder_user_id = null;
      }

      const { data: created, error } = await dbDynamic()
        .from(table)
        .insert(row)
        .select()
        .single();
      if (error) throw error;

      if (created?.id && row.audience === "assigned" && contacts.length) {
        const { ids, missing } = await resolveContacts(contacts);
        await syncCouponAudience(created.id, ids);
        await afterWrite(resource);
        await recordAudit({
          actor,
          action: "create",
          entity: table,
          entityId: created.id,
          diff: diffOf(null, row),
          ip: clientIp(req),
          userAgent: req.headers.get("user-agent"),
        });
        return ok({ ...created, audience_added: ids.length, audience_missing: missing });
      }

      await afterWrite(resource);
      await recordAudit({
        actor,
        action: "create",
        entity: table,
        entityId: created?.id ?? null,
        diff: diffOf(null, row),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return ok(created);
    }

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

    /* Coupons: keep the audience table in step with the form. Editing the
       contact list replaces it; switching back to `all` clears it. */
    if (resource === "coupons") {
      const contacts = Array.isArray((parsed as { audience_contacts?: string[] }).audience_contacts)
        ? ((parsed as { audience_contacts?: string[] }).audience_contacts as string[])
        : null;

      if (patch.audience === "influencer" || patch.audience === "assigned") {
        const funder = await resolveFunder(patch.funder_user_id);
        if (funder === "MISSING") {
          return fail("ইনফ্লুয়েন্সারের ফোন/ইমেইল খুঁজে পাওয়া যায়নি — আগে তাকে অ্যাকাউন্ট খুলতে হবে", 422);
        }
        if (patch.audience === "influencer" && !funder) {
          return fail("এই কুপনটি কার — ইনফ্লুয়েন্সারের ফোন/ইমেইল দিন", 422);
        }
        patch.funder_user_id = funder;
      } else {
        patch.funder_user_id = null;
      }

      const { data: updated, error } = await dbDynamic()
        .from(table)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      let missing: string[] = [];
      if (patch.audience === "assigned" && contacts) {
        const resolved = await resolveContacts(contacts);
        missing = resolved.missing;
        await syncCouponAudience(id, resolved.ids);
      } else if (patch.audience !== "assigned") {
        /* `all` and `influencer` are open codes — any list left from an earlier
           `assigned` state must go, or it would silently narrow the audience. */
        await syncCouponAudience(id, []);
      }

      await afterWrite(resource);
      await recordAudit({
        actor,
        action: "update",
        entity: table,
        entityId: id,
        diff: diffOf(null, patch),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return ok({ ...updated, audience_missing: missing });
    }

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

    /* Removing a person from a coupon's audience: DELETE
       /api/foisal/coupon-audiences?coupon=<id>&user=<id> */
    if (resource === "coupon-audiences") {
      const userId = new URL(req.url).searchParams.get("user");
      if (!userId) return fail("ইউজার আইডি দিন", 422);
      const { error } = await dbDynamic()
        .from("coupon_audiences")
        .delete()
        .eq("coupon_id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return ok({ deleted: true });
    }

    /* A wallet ledger row is history — it is never deleted. */
    if (resource === "wallet") return fail("ওয়ালেট লেনদেন মুছা যায় না", 405);

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
