import { db } from "@/lib/db";
import { created, fail, handleError, ok, requirePermission } from "@/lib/api";
import { diffOf, recordAudit } from "@/lib/audit";
import { clientIp } from "@/lib/api";
import { productSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function payload(input: ReturnType<typeof productSchema.parse>) {
  return {
    slug: input.slug,
    category_id: input.category_id,
    name_bn: input.name_bn,
    name_en: input.name_en,
    description_bn: input.description_bn || null,
    unit: input.unit,
    unit_en: input.unit_en || "kg",
    price: input.price,
    compare_price: input.compare_price ?? null,
    stock: input.stock,
    image: input.image || null,
    farm_source_bn: input.farm_source_bn || null,
    harvest_date: input.harvest_date || null,
    badge_bn: input.badge_bn || null,
    is_featured: input.is_featured,
    is_active: input.is_active,
  };
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("products.write");
    const data = productSchema.parse(await req.json());

    const { data: product, error } = await db().from("products").insert(payload(data)).select().single();
    if (error) throw error;

    await recordAudit({
      actor,
      action: "create",
      entity: "products",
      entityId: (product as { id?: string })?.id ?? null,
      diff: diffOf(null, payload(data)),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return created(product);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return fail("অনুমতি নেই", 401);
    if (status === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("products.write");
    const data = productSchema.parse(await req.json());
    if (!data.id) return fail("পণ্যের আইডি দিন", 422);

    const { data: before } = await db().from("products").select("*").eq("id", data.id).maybeSingle();

    const { data: product, error } = await db()
      .from("products")
      .update(payload(data))
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw error;

    await recordAudit({
      actor,
      action: "update",
      entity: "products",
      entityId: data.id,
      diff: diffOf(before as Record<string, unknown> | null, payload(data)),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok(product);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return fail("অনুমতি নেই", 401);
    if (status === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("products.write");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("পণ্যের আইডি দিন", 422);

    // Soft delete keeps order history intact.
    const { error } = await db().from("products").update({ is_active: false }).eq("id", id);
    if (error) throw error;

    await recordAudit({
      actor,
      action: "delete",
      entity: "products",
      entityId: id,
      diff: { is_active: { from: true, to: false } },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ id, archived: true });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return fail("অনুমতি নেই", 401);
    if (status === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
