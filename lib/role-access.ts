import { cache } from "react";
import { db, isDbConfigured } from "./db";
import {
  CONFIGURABLE_ROLES,
  type ConfigurableRole,
  type Permission,
  type RolePermissionOverrides,
} from "./permissions";

/* ==========================================================================
   lib/role-access.ts — the admin's per-role permission configuration
   --------------------------------------------------------------------------
   The built-in sets in lib/permissions.ts are the DEFAULTS. Migration 30 adds
   `public.role_permissions`, where the owner changes those defaults from the
   panel: "let staff see coupons", "stop managers approving sellers".

   This module reads that table once per request and shapes it into the small
   object every checker already accepts:

       can(user, "settings.write", overrides)

   Rules that make this safe:

     • Only the DIFFERENCES are consulted. A role with no rows behaves exactly
       like the code default, so a permission added in a later release reaches
       staff without a data migration.
     • `admin` is never read from this table. The owner cannot configure
       themselves out of their own panel.
     • A read failure returns null — the callers then fall back to the built-in
       defaults. Failing closed here would lock every staff member out of the
       panel on a transient database error; falling back to the *documented*
       defaults is the safer of the two failure modes, and it is the same
       posture the database function takes when the table is empty.
   ========================================================================== */

type RolePermissionsRow = { role: string; permission: string; is_granted: boolean };

function shape(rows: readonly RolePermissionsRow[]): RolePermissionOverrides {
  const out: RolePermissionOverrides = {};

  for (const row of rows) {
    if (row.role !== "staff" && row.role !== "manager") continue;
    const role = row.role as ConfigurableRole;
    out[role] ??= {};
    out[role]![row.permission as Permission] = row.is_granted;
  }

  return out;
}

/**
 * Read the admin's configuration for every configurable role.
 *
 * `cache()` means one query per request even though middleware, the layout,
 * the page and the shell all ask for it.
 */
export const getRoleOverrides = cache(async (): Promise<RolePermissionOverrides> => {
  if (!isDbConfigured()) return {};

  try {
    const { data, error } = await db()
      .from("role_permissions")
      .select("role, permission, is_granted");

    if (error) {
      console.warn("[role-access] could not read role_permissions:", error.message);
      return {};
    }

    return shape((data ?? []) as RolePermissionsRow[]);
  } catch (problem) {
    console.warn("[role-access] role_permissions unavailable:", (problem as Error).message);
    return {};
  }
});

/**
 * The rows as the panel's editor wants them: every configurable role with its
 * effective permission list, plus which of them the admin changed.
 *
 * Shown on /foisal/access. Reading is allowed for any staff member (so a
 * manager can see their own remit); changing it needs `team.role`, which is
 * admin-only.
 */
export type RoleAccessSummary = {
  role: ConfigurableRole;
  labelBn: string;
  effective: Permission[];
  /** permission → true (granted on top of the default) / false (taken away) */
  overrides: Partial<Record<Permission, boolean>>;
  /** How many permissions differ from the built-in default. */
  changed: number;
};

export const ROLE_LABEL_BN: Record<ConfigurableRole, string> = {
  staff: "স্টাফ",
  manager: "ম্যানেজার",
};

export async function getRoleAccessSummary(): Promise<RoleAccessSummary[]> {
  const { canForRole, rolePermissionDefaults } = await import("./permissions");
  const overrides = await getRoleOverrides();
  const defaults = rolePermissionDefaults();

  return CONFIGURABLE_ROLES.map((role) => {
    const effective = new Set<Permission>(defaults[role]);
    for (const [permission, granted] of Object.entries(overrides[role] ?? {})) {
      if (granted) effective.add(permission as Permission);
      else effective.delete(permission as Permission);
    }

    /* `canForRole` is the single implementation of "default + override"; asking
       it per permission keeps the panel and the guards from disagreeing. */
    const list = defaults[role]
      .concat(Object.keys(overrides[role] ?? {}) as Permission[])
      .filter((permission, index, all) => all.indexOf(permission) === index)
      .filter((permission) => canForRole(role, permission, overrides))
      .sort();

    return {
      role,
      labelBn: ROLE_LABEL_BN[role],
      effective: list.length ? list : [...effective].sort(),
      overrides: overrides[role] ?? {},
      changed: Object.keys(overrides[role] ?? {}).length,
    };
  });
}
