import { z } from "zod";
import { db } from "@/lib/db";
import { created, fail, handleError, ok, requirePermission, clientIp } from "@/lib/api";
import { paymentMethodSchema } from "@/lib/validation";
import { listAllMethods, createMethod, updateMethod, deleteMethod } from "@/lib/payment-methods";
import { recordAudit, diffOf } from "@/lib/audit";

export const dynamic = "force-dynamic";

/* ==========================================================================
   /api/foisal/payment-methods — admin CRUD for payment receiving methods
   --------------------------------------------------------------------------
   GET    /            — list every method (active + inactive), display order
   POST   /            — add a method
   PATCH  /            — edit a method (partial)
   DELETE /?id=…       — delete a method

   Every mutation is audited. The owner manages the receiving numbers here;
   the checkout page reads only the active ones.
   ========================================================================== */

export async function GET() {
  try {
    await requirePermission("payments.manage");
    const methods = await listAllMethods();
    return ok({ methods });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("payments.manage");
    const input = paymentMethodSchema.parse(await req.json());

    const payload = {
      code: input.code,
      name_bn: input.name_bn,
      name_en: input.name_en || null,
      kind: input.kind,
      logo_url: input.logo_url || null,
      account_type: input.account_type ?? null,
      account_number: input.account_number || null,
      account_name: input.account_name || null,
      bank_name: input.bank_name || null,
      branch_name: input.branch_name || null,
      routing_number: input.routing_number || null,
      instruction_bn: input.instruction_bn || null,
      min_amount: input.min_amount,
      max_amount: input.max_amount ?? null,
      trx_pattern: input.trx_pattern || null,
      requires_trx: input.requires_trx,
      requires_sender: input.requires_sender,
      is_active: input.is_active,
      show_on_checkout: input.show_on_checkout,
      sort_order: input.sort_order,
    };

    const method = await createMethod(payload);
    await recordAudit({
      actor,
      action: "create",
      entity: "payment_methods",
      entityId: method.id,
      diff: diffOf(null, payload),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return created({ method });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 403) return fail("এই কাজ করার অধিকার নেই", 403);
    if ((error as { code?: string }).code === "23505") {
      return fail("এই কোড ইতিমধ্যে ব্যবহার করা হয়েছে", 409);
    }
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("payments.manage");
    const raw = (await req.json()) as Record<string, unknown>;

    /* Reorder is its own action: it swaps sort_order with the neighbouring row
       in ONE transaction (move_payment_method), so two quick clicks can never
       leave two methods sharing a position. The footer follows sort_order, so
       this is what decides which four logos appear first. */
    if (raw.action === "move") {
      const moveSchema = z.object({
        id: z.string().uuid(),
        direction: z.union([z.literal(-1), z.literal(1)]),
      });
      const { id, direction } = moveSchema.parse(raw);

      const { data: before } = await db().from("payment_methods").select("*").eq("id", id).maybeSingle();
      const { error } = await db().rpc("move_payment_method", { p_id: id, p_direction: direction });
      if (error) throw error;

      const { data: after } = await db().from("payment_methods").select("*").eq("id", id).maybeSingle();
      await recordAudit({
        actor,
        action: "reorder",
        entity: "payment_methods",
        entityId: id,
        diff: diffOf(before as Record<string, unknown> | null, { sort_order: after?.sort_order }),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      }).catch(() => undefined);

      const methods = await listAllMethods();
      return ok({ methods });
    }

    const body = paymentMethodSchema.partial().parse(raw);
    const id = body.id;
    if (!id) return fail("মেথড id দিন", 422);

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      "code",
      "name_bn",
      "name_en",
      "kind",
      "logo_url",
      "account_type",
      "account_number",
      "account_name",
      "bank_name",
      "branch_name",
      "routing_number",
      "instruction_bn",
      "min_amount",
      "max_amount",
      "trx_pattern",
      "requires_trx",
      "requires_sender",
      "is_active",
      "show_on_checkout",
      "sort_order",
    ] as const) {
      if (key in body && body[key] !== undefined) {
        const value = body[key];
        payload[key] = typeof value === "string" && value === "" ? null : value;
      }
    }

    const { data: before } = await db()
      .from("payment_methods")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const method = await updateMethod(id, payload);
    await recordAudit({
      actor,
      action: "update",
      entity: "payment_methods",
      entityId: id,
      diff: diffOf(before as Record<string, unknown> | null, payload),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return ok({ method });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 403) return fail("এই কাজ করার অধিকার নেই", 403);
    if ((error as { code?: string }).code === "23505") {
      return fail("এই কোড ইতিমধ্যে ব্যবহার করা হয়েছে", 409);
    }
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("payments.manage");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return fail("মেথড id দিন", 422);

    const { data: before } = await db()
      .from("payment_methods")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const code = before?.code ?? "";

    // Never delete a method that orders still reference — deactivate instead
    // so historical orders keep a readable method name.
    const { data: refs } = await db()
      .from("orders")
      .select("id")
      .eq("payment_method", code)
      .limit(1);

    if (refs && refs.length > 0) {
      await updateMethod(id, { is_active: false });
      await recordAudit({
        actor,
        action: "deactivate",
        entity: "payment_methods",
        entityId: id,
        diff: diffOf(before as Record<string, unknown> | null, { is_active: false }),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return ok({ deleted: false, deactivated: true, message: "অর্ডারে ব্যবহৃত হওয়ায় মেথডটি বন্ধ করা হয়েছে" });
    }

    await deleteMethod(id);
    await recordAudit({
      actor,
      action: "delete",
      entity: "payment_methods",
      entityId: id,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return ok({ deleted: true });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 403) return fail("এই কাজ করার অধিকার নেই", 403);
    return handleError(error);
  }
}
