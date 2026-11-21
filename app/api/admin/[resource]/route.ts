import { db } from "@/lib/db";
import { fail, handleError, ok, requireAdmin } from "@/lib/api";
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
 */
const schemas = {
  categories: categorySchema,
  coupons: couponSchema,
  blog: blogSchema,
  banners: bannerSchema,
  delivery: deliveryZoneSchema,
} as const;

const tables: Record<string, string> = {
  categories: "categories",
  coupons: "coupons",
  blog: "blog_posts",
  banners: "banners",
  delivery: "delivery_zones",
};

function tableFor(resource: string): string | null {
  return tables[resource] ?? null;
}

function normalise(resource: string, input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  delete out.id;

  if (resource === "coupons") {
    out.expires_at = out.expires_at ? new Date(String(out.expires_at)).toISOString() : null;
  }
  if (resource === "blog") {
    // map admin-facing "cover" through untouched; ensure slug present
    out.is_active = out.is_active !== false;
  }
  if (resource === "delivery") {
    delete out.district_en;
  }

  for (const key of Object.keys(out)) {
    if (out[key] === "") out[key] = null;
  }
  return out;
}

export async function POST(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    await requireAdmin();
    const { resource } = await params;
    const table = tableFor(resource);
    const schema = schemas[resource as keyof typeof schemas];
    if (!table || !schema) return fail("অজানা রিসোর্স", 404);

    const raw = await req.json();
    const parsed = schema.parse(raw);

    const { data, error } = await db()
      .from(table)
      .insert(normalise(resource, parsed as Record<string, unknown>))
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error) {
    if (error instanceof ZodError) return handleError(error);
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    await requireAdmin();
    const { resource } = await params;
    const table = tableFor(resource);
    const schema = schemas[resource as keyof typeof schemas];
    if (!table || !schema) return fail("অজানা রিসোর্স", 404);

    const raw = (await req.json()) as Record<string, unknown>;
    const id = raw.id;
    if (typeof id !== "string") return fail("আইডি দিন", 422);

    const parsed = schema.parse(raw);
    const { data, error } = await db()
      .from(table)
      .update(normalise(resource, parsed as Record<string, unknown>))
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (error) {
    if (error instanceof ZodError) return handleError(error);
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    await requireAdmin();
    const { resource } = await params;
    const table = tableFor(resource);
    if (!table) return fail("অজানা রিসোর্স", 404);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const { error } = await db().from(table).delete().eq("id", id);
    if (error) throw error;
    return ok({ id, deleted: true });
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 401) return fail("অনুমতি নেই", 401);
    if (code === 403) return fail("শুধুমাত্র অ্যাডমিন", 403);
    return handleError(error);
  }
}
