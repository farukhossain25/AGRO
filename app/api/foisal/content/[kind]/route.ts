import { db, dbDynamic } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { recordAudit, diffOf } from "@/lib/audit";
import { revalidateContent } from "@/lib/content";
import { heroSlideSchema, socialLinkSchema } from "@/lib/validation";
import type { Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/content/[kind] — social links and hero slides
   --------------------------------------------------------------------------
   `kind` is `social` or `hero`. One route because the two are structurally the
   same operation (ordered, activatable rows with an image and a link), and a
   single implementation means one place to get the ordering and the audit
   right.

   After every write the memoised readers in lib/content.ts are dropped, so the
   storefront picks the change up on the next request instead of after a TTL.
   ========================================================================== */

const KINDS = {
  social: {
    table: "social_links",
    schema: socialLinkSchema,
    permission: "content.social" as Permission,
    order: "sort_order",
  },
  hero: {
    table: "hero_slides",
    schema: heroSlideSchema,
    permission: "content.layout" as Permission,
    order: "sort_order",
  },
} as const;

type Kind = keyof typeof KINDS;

function resolve(kind: string) {
  return (KINDS as Record<string, (typeof KINDS)[Kind]>)[kind] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const config = resolve(kind);
    if (!config) return fail("অজানা ধরন", 404);

    await requirePermission(config.permission);

    const { data, error } = await db()
      .from(config.table)
      .select("*")
      .order(config.order, { ascending: true });

    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const config = resolve(kind);
    if (!config) return fail("অজানা ধরন", 404);

    const actor = await requirePermission(config.permission);
    const parsed = config.schema.parse(await req.json());
    const payload = clean(parsed as Record<string, unknown>);

    const { data, error } = await dbDynamic().from(config.table).insert(payload).select().single();
    if (error) throw error;

    await recordAudit({
      actor,
      action: "create",
      entity: config.table,
      entityId: (data as { id: string }).id,
      diff: diffOf(null, payload),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    revalidateContent();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const config = resolve(kind);
    if (!config) return fail("অজানা ধরন", 404);

    const actor = await requirePermission(config.permission);
    const raw = (await req.json()) as Record<string, unknown> & { id?: string };

    // `reorder` is its own verb: [{id, sort_order}, …] in one statement.
    if (Array.isArray((raw as { order?: unknown }).order)) {
      const order = (raw as unknown as { order: { id: string; sort_order: number }[] }).order;
      if (order.length > 200) return fail("একবারে বেশি সারি", 413);

      for (const row of order) {
        if (typeof row?.id !== "string" || !Number.isFinite(row.sort_order)) {
          return fail("ক্রমের তথ্য সঠিক নয়", 422);
        }
      }

      for (const row of order) {
        await db().from(config.table).update({ sort_order: row.sort_order }).eq("id", row.id);
      }

      await recordAudit({
        actor,
        action: "reorder",
        entity: config.table,
        diff: { count: order.length },
        ip: clientIp(req),
      });

      revalidateContent();
      return ok({ reordered: order.length });
    }

    if (typeof raw.id !== "string") return fail("আইডি দিন", 422);

    const parsed = config.schema.parse(raw);
    const payload = clean(parsed as Record<string, unknown>);

    const { data: before } = await dbDynamic().from(config.table).select("*").eq("id", raw.id).maybeSingle();

    const { data, error } = await dbDynamic()
      .from(config.table)
      .update(payload)
      .eq("id", raw.id)
      .select()
      .single();

    if (error) throw error;

    await recordAudit({
      actor,
      action: "update",
      entity: config.table,
      entityId: raw.id,
      diff: diffOf(before as Record<string, unknown> | null, payload),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    revalidateContent();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const { kind } = await params;
    const config = resolve(kind);
    if (!config) return fail("অজানা ধরন", 404);

    const actor = await requirePermission(config.permission);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await dbDynamic().from(config.table).delete().eq("id", id);
    if (error) throw error;

    await recordAudit({
      actor,
      action: "delete",
      entity: config.table,
      entityId: id,
      ip: clientIp(req),
    });

    revalidateContent();
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Empty strings → null; date strings → ISO (or null). */
function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  delete out.id;

  for (const key of ["starts_at", "ends_at"]) {
    if (key in out) {
      const value = out[key];
      out[key] = value ? new Date(String(value)).toISOString() : null;
    }
  }

  for (const key of Object.keys(out)) {
    if (out[key] === "") out[key] = null;
  }
  return out;
}
