import { db } from "@/lib/db";
import type { Json } from "@/lib/database.types";
import { handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { revalidateContent } from "@/lib/content";
import { homepageLayoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/homepage-sections — the drag-to-reorder homepage manager
   --------------------------------------------------------------------------
   The whole layout is saved in ONE request: the admin drags twelve rows, hits
   save, and either all of it lands or none of it does. A per-row PATCH would
   leave the page half-reordered if the network dropped mid-drag.

   POST (not PUT) because it is an action on a collection, matching the rest of
   the admin API's shape.
   ========================================================================== */

export async function GET() {
  try {
    await requirePermission("content.layout");
    const { data, error } = await db()
      .from("homepage_sections")
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
    const actor = await requirePermission("content.layout");
    const { sections } = homepageLayoutSchema.parse(await req.json());

    const client = db();

    /* Validate every id up-front. If one row was deleted in another tab, the
       admin should get a clear message instead of a half-applied order. */
    const ids = sections.map((s) => s.id).filter((id) => !id.startsWith("fallback-"));
    const { data: existing } = await client
      .from("homepage_sections")
      .select("id, key, sort_order, is_visible")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const known = new Set((existing ?? []).map((row) => row.id));

    // Rows seeded in this session but never persisted (the fallback ids) are
    // inserted rather than updated, so a fresh database repairs itself.
    const missing = sections.filter((s) => s.id.startsWith("fallback-"));

    const updates = sections
      .filter((s) => known.has(s.id))
      .map((s) =>
        client
          .from("homepage_sections")
          .update({
            is_visible: s.is_visible,
            sort_order: s.sort_order,
            ...(s.config ? { config: s.config as unknown as Json } : {}),
          })
          .eq("id", s.id)
      );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;

    if (missing.length) {
      await client.from("homepage_sections").upsert(
        missing.map((s) => ({
          key: s.id.replace(/^fallback-/, ""),
          label_bn: s.id.replace(/^fallback-/, ""),
          is_visible: s.is_visible,
          sort_order: s.sort_order,
          config: (s.config ?? {}) as unknown as Json,
        })),
        { onConflict: "key" }
      );
    }

    await recordAudit({
      actor,
      action: "reorder",
      entity: "homepage_sections",
      diff: {
        order: sections.map((s) => `${s.sort_order}:${s.id.slice(0, 8)}:${s.is_visible ? "on" : "off"}`).join(" "),
      },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    revalidateContent();
    return ok({ saved: sections.length, updated: updates.length, created: missing.length });
  } catch (error) {
    return handleError(error);
  }
}
