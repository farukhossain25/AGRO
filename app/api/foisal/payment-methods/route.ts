import { db } from "@/lib/db";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { recordAudit, diffOf } from "@/lib/audit";
import { revalidateContent } from "@/lib/content";
import { paymentMethodSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/payment-methods — CRUD for the receiving accounts
   --------------------------------------------------------------------------
   The owner changes bKash numbers here, not in code. Two things this route is
   careful about:

     • A method that has payments attached may not be DELETED (the history must
       stay readable) — it is deactivated instead. Deleting would orphan
       `payments.method_id` (set null) and lose which wallet a TrxID used.
     • Every write is audited, because this is where money is sent.
   ========================================================================== */

export async function GET() {
  try {
    await requirePermission("payments.manage");
    const { data, error } = await db()
      .from("payment_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return ok(data ?? []);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("payments.manage");
    const parsed = paymentMethodSchema.parse(await req.json());

    const payload = clean(parsed);

    const { data, error } = await db().from("payment_methods").insert(payload as TablesInsert<"payment_methods">).select().single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return fail("এই কোডে আরেকটি মাধ্যম আছেই — অন্য কোড দিন", 409, { code: "কোড আগেই ব্যবহৃত" });
      }
      throw error;
    }

    await recordAudit({
      actor,
      action: "create",
      entity: "payment_methods",
      entityId: (data as { id: string }).id,
      diff: diffOf(null, payload),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    revalidateContent("social");
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("payments.manage");
    const raw = (await req.json()) as Record<string, unknown>;
    if (typeof raw.id !== "string") return fail("আইডি দিন", 422);

    const parsed = paymentMethodSchema.parse(raw);
    const payload = clean(parsed);

    const client = db();
    const { data: before } = await client
      .from("payment_methods")
      .select("*")
      .eq("id", raw.id)
      .maybeSingle();

    const { data, error } = await client
      .from("payment_methods")
      .update(payload as TablesUpdate<"payment_methods">)
      .eq("id", raw.id)
      .select()
      .single();

    if (error) throw error;

    await recordAudit({
      actor,
      action: "update",
      entity: "payment_methods",
      entityId: raw.id,
      diff: diffOf(before as Record<string, unknown> | null, payload),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("payments.manage");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("আইডি দিন", 422);

    const client = db();

    // Refuse to orphan payment history.
    const { count } = await client
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("method_id", id);

    if ((count ?? 0) > 0) {
      await client.from("payment_methods").update({ is_active: false }).eq("id", id);
      await recordAudit({
        actor,
        action: "deactivate",
        entity: "payment_methods",
        entityId: id,
        diff: { reason: `${count} payments reference this method` },
        ip: clientIp(req),
      });
      return ok({ deactivated: true, payments: count });
    }

    const { error } = await client.from("payment_methods").delete().eq("id", id);
    if (error) throw error;

    await recordAudit({
      actor,
      action: "delete",
      entity: "payment_methods",
      entityId: id,
      ip: clientIp(req),
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Empty strings become null so the CHECK constraints and UI stay consistent. */
function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  delete out.id;
  for (const key of Object.keys(out)) {
    if (out[key] === "") out[key] = null;
  }
  if (out.max_amount === null) out.max_amount = null;
  return out;
}
