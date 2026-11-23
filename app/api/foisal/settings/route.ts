import { z } from "zod";
import { db } from "@/lib/db";
import type { Json } from "@/lib/database.types";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/* ==========================================================================
   /api/foisal/settings — the site-wide key/value store
   --------------------------------------------------------------------------
   `settings` is a table of small JSON objects keyed by an area name:
   `store`, `payments`, `premium`, `delivery`, `auth`, `seller`, `reviews`,
   `profile`. Code already reads several of them at runtime
   (lib/manual-payments.ts reads `payments`, lib/premium.ts reads `premium`),
   but until now there was no way to change them without psql — which made
   "everything editable, no code" untrue for the anti-fraud limits, the trial
   length and the commission rate.

   Two guards that matter:

     • ALLOWED_KEYS is an allow-list. The endpoint cannot create new setting
       areas — a typo in the UI must not silently become a new row that no
       code reads.
     • The patch is a shallow merge into the existing object. Sending one field
       never blanks the others, so a half-filled form cannot wipe
       `max_submits_per_hour` because it forgot to include it.
   ========================================================================== */

const ALLOWED_KEYS = [
  "store",
  "payments",
  "premium",
  "delivery",
  "auth",
  "seller",
  "reviews",
  "profile",
  "announcement",
] as const;

/* Scalars only. Nested objects would make the shallow merge ambiguous, and
   every field this endpoint exists to edit is a number, string or boolean. */
const patchSchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z
    .record(
      z.string().min(1).max(60),
      z.union([
        z.string().max(500),
        z.number(),
        z.boolean(),
        z.null(),
        /* The marquee's message list is the one setting that is a list. */
        z.array(z.string().max(240)).max(8),
      ])
    )
    .refine((obj) => Object.keys(obj).length <= 40, "too many fields"),
});

/** GET — every setting area, for the editor's initial values. */
export async function GET() {
  try {
    await requirePermission("settings.write");

    const { data, error } = await db().from("site_settings").select("key, value").order("key");
    if (error) throw error;

    const map: Record<string, Record<string, unknown>> = {};
    for (const row of data ?? []) {
      map[row.key as string] = (row.value ?? {}) as Record<string, unknown>;
    }
    return ok({ settings: map });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH — merge a patch into one setting area.
 * Body: { key: "payments", value: { max_rejected_before_block: 5 } }
 */
export async function PATCH(req: Request) {
  try {
    const user = await requirePermission("settings.write");
    const { key, value } = patchSchema.parse(await req.json());

    const client = db();
    const { data: existing, error: readError } = await client
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (readError) throw readError;

    /* Merge, never replace. `null` deletes a field rather than storing null —
       that is how the UI clears an optional value. */
    const merged: Record<string, unknown> = {
      ...((existing?.value ?? {}) as Record<string, unknown>),
    };
    for (const [field, next] of Object.entries(value)) {
      if (next === null) delete merged[field];
      else merged[field] = next;
    }

    const { data, error } = await client
      .from("site_settings")
      .upsert({ key, value: merged as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select("key, value")
      .single();

    if (error) throw error;

    /* Audit BEFORE returning: a settings change moves money (commission,
       delivery charge) or opens a door (lockout limits), so it must always be
       attributable to a person. */
    await recordAudit({
      actor: user,
      action: "update",
      entity: "settings",
      entityId: key,
      diff: value,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => null);

    return ok({ key: data.key, value: data.value });
  } catch (error) {
    return handleError(error);
  }
}

/** PUT — the bulk form: { settings: { payments: {...}, premium: {...} } } */
export async function PUT(req: Request) {
  try {
    const user = await requirePermission("settings.write");
    const body = z
      .object({ settings: z.record(z.enum(ALLOWED_KEYS), patchSchema.shape.value) })
      .parse(await req.json());

    const client = db();
    const changed: string[] = [];

    for (const [key, value] of Object.entries(body.settings)) {
      const { data: existing, error: readError } = await client
        .from("site_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (readError) throw readError;

      const merged = { ...((existing?.value ?? {}) as Record<string, unknown>) };
      for (const [field, next] of Object.entries(value)) {
        if (next === null) delete merged[field];
        else merged[field] = next;
      }

      const { error } = await client
        .from("site_settings")
        .upsert({ key, value: merged as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      changed.push(key);
    }

    if (!changed.length) return fail("কোনো পরিবর্তন আসেনি", 400);

    await recordAudit({
      actor: user,
      action: "update",
      entity: "settings",
      meta: { keys: changed },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => null);

    return ok({ updated: changed });
  } catch (error) {
    return handleError(error);
  }
}
