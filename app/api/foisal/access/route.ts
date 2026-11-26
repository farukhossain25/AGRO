import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, fail, handleError, ok, requirePermission } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { CONFIGURABLE_ROLES, PERMISSIONS, type Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   /api/foisal/access — who may reach which part of the panel (migration 30)
   --------------------------------------------------------------------------
   GET   the catalogue (labels + groups) and what staff/manager hold now
   PUT   replace one role's configuration (admin only)

   Why a dedicated route rather than reusing /api/foisal/[resource]:
   `[resource]` is a generic table editor and this is not a table — it is a
   decision with rules (admin never changes, unknown permissions are refused,
   the actor must really be an admin). Those rules live in the SQL function
   `role_permissions_set()`, which re-checks everything the route checks. Two
   independent layers, on purpose, like every other money-adjacent action here.

   Reading is `team.read` (manager and up) so a manager can see their own remit.
   Writing is `team.role`, which only an admin holds.
   ========================================================================== */

const saveSchema = z.object({
  role: z.enum(CONFIGURABLE_ROLES),
  grants: z.array(z.string()).max(PERMISSIONS.length).default([]),
  revokes: z.array(z.string()).max(PERMISSIONS.length).default([]),
});

type CatalogRow = {
  permission: string;
  group_key: string;
  group_bn: string;
  label_bn: string;
  hint_bn: string | null;
  is_sensitive: boolean;
  sort_order: number;
};

type OverrideRow = { role: string; permission: string; is_granted: boolean };

/** The built-in defaults, straight from the database (migration 30 §3). */
async function defaults(): Promise<Record<string, string[]>> {
  const { data, error } = await db().rpc("role_permission_defaults" as never);
  if (error) throw error;

  const out: Record<string, string[]> = { staff: [], manager: [] };
  for (const row of (data ?? []) as { role: string; permission: string }[]) {
    (out[row.role] ??= []).push(row.permission);
  }
  return out;
}

export async function GET() {
  try {
    /* team.read: manager and up. A staff account gets 403 rather than a peek
       at the list of everything it may never have. */
    await requirePermission("team.read");

    const [{ data: catalog, error: catalogError }, { data: overrides, error: overrideError }, base] =
      await Promise.all([
        db()
          .from("permission_catalog")
          .select("permission, group_key, group_bn, label_bn, hint_bn, is_sensitive, sort_order")
          .order("group_key")
          .order("sort_order"),
        db().from("role_permissions").select("role, permission, is_granted"),
        defaults(),
      ]);

    if (catalogError) throw catalogError;
    if (overrideError) throw overrideError;

    return ok({
      catalog: (catalog ?? []) as CatalogRow[],
      defaults: base,
      overrides: (overrides ?? []) as OverrideRow[],
      /* An admin may change staff and manager. Never admin — the honest UI
         shows why instead of hiding the row. */
      configurable: CONFIGURABLE_ROLES,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(req: Request) {
  try {
    /* Admin only: team.role is the permission that lets someone re-shape what
       other people can do. A manager must not be able to widen its own remit. */
    const actor = await requirePermission("team.role");

    const parsed = saveSchema.parse(await req.json());

    /* Reject anything the catalogue does not know before touching the RPC, so
       the caller gets a 422 naming the permission rather than a 500. */
    const known = new Set<string>(PERMISSIONS);
    const unknown = [...parsed.grants, ...parsed.revokes].filter((p) => !known.has(p));
    if (unknown.length) {
      return fail(`অজানা অনুমতি: ${unknown.join(", ")}`, 422);
    }

    const { data, error } = await db().rpc("role_permissions_set" as never, {
      p_role: parsed.role,
      p_grants: parsed.grants,
      p_revokes: parsed.revokes,
      p_actor: actor.id,
    } as never);

    if (error) {
      /* The RPC's own guards. Surfacing them verbatim beats a generic 500: the
         panel shows the owner exactly which rule refused. */
      const message = error.message ?? "";
      if (/PERMISSION_BAD_ROLE/.test(message)) return fail("অ্যাডমিন রোল বদলানো যায় না", 422);
      if (/PERMISSION_ADMIN_ONLY/.test(message)) return fail("শুধু অ্যাডমিন এই সেটিং বদলাতে পারে", 403);
      if (/PERMISSION_UNKNOWN/.test(message)) return fail("অজানা অনুমতি পাঠানো হয়েছে", 422);
      if (/PERMISSION_CONFLICT/.test(message)) return fail("একই অনুমতি দেওয়া ও কাড়া — একটাই বেছে নিন", 422);
      throw error;
    }

    await recordAudit({
      actor,
      action: "update",
      entity: "role_permissions",
      entityId: parsed.role,
      diff: {
        grants: parsed.grants,
        revokes: parsed.revokes,
        effective: (data as { effective?: string[] } | null)?.effective ?? null,
      },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

/** Reset one role to the code defaults. Kept separate so it is one click, not
 *  "untick everything and hope". */
export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("team.role");

    const role = new URL(req.url).searchParams.get("role") ?? "";
    if (!(CONFIGURABLE_ROLES as readonly string[]).includes(role)) {
      return fail("রোল সঠিক নয় (staff বা manager)", 422);
    }

    const { data, error } = await db().rpc("role_permissions_reset" as never, {
      p_role: role,
      p_actor: actor.id,
    } as never);
    if (error) throw error;

    await recordAudit({
      actor,
      action: "update",
      entity: "role_permissions",
      entityId: role,
      diff: { reset: true, effective: (data as { effective?: string[] } | null)?.effective ?? null },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    }).catch(() => undefined);

    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

/** Exposed for the page so the client component and the route agree on keys. */
export type AccessPayload = {
  catalog: (CatalogRow & { permission: Permission })[];
  defaults: Record<string, string[]>;
  overrides: OverrideRow[];
};
