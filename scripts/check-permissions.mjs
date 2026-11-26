#!/usr/bin/env node
/**
 * scripts/check-permissions.mjs — the two copies of the default permission list
 * ---------------------------------------------------------------------------
 * The built-in defaults live in TWO places on purpose:
 *
 *   lib/permissions.ts                  → what the app enforces (can/canForRole)
 *   public.role_permission_defaults()   → what the database knows, so the panel
 *                                         can show "this is a default" vs
 *                                         "the admin changed this"
 *
 * Two copies that disagree is the worst kind of bug here: the panel would show
 * a checkbox as "default" while the code refuses the route, or the reverse.
 * This script loads the real schema into PGlite, reads the SQL function, then
 * reads the TypeScript and fails if the sets differ.
 *
 *   node scripts/check-permissions.mjs
 */
import { loadSchema } from "./lib/sql-harness.mjs";
import { rolePermissionDefaults, PERMISSIONS, CONFIGURABLE_ROLES } from "../lib/permissions.ts";

const db = await loadSchema();

let failed = 0;
const fail = (message) => {
  failed += 1;
  console.error(`FAIL ${message}`);
};
const pass = (message) => console.log(`OK   ${message}`);

/* ---- 1. every permission in the SQL function must exist in TS ------------ */
const { rows } = await db.query(`select role, permission from public.role_permission_defaults()`);

const sqlByRole = {};
for (const row of rows) (sqlByRole[row.role] ??= []).push(row.permission);

const tsByRole = rolePermissionDefaults();
const known = new Set(PERMISSIONS);

for (const role of CONFIGURABLE_ROLES) {
  const sql = new Set(sqlByRole[role] ?? []);
  const ts = new Set(tsByRole[role] ?? []);

  if (!sql.size) fail(`${role}: nothing came back from role_permission_defaults()`);

  for (const permission of sql) {
    if (!known.has(permission)) {
      fail(`${role}: SQL grants "${permission}" but it is not in PERMISSIONS (lib/permissions.ts)`);
    }
    if (!ts.has(permission)) {
      fail(`${role}: "${permission}" is in the SQL defaults but not in lib/permissions.ts`);
    }
  }
  for (const permission of ts) {
    if (!known.has(permission)) {
      fail(`${role}: "${permission}" is not in PERMISSIONS at all`);
    }
    if (!sql.has(permission)) {
      fail(`${role}: "${permission}" is in lib/permissions.ts but missing from the SQL defaults`);
    }
  }
}

if (!failed) {
  pass(
    `defaults agree — staff ${tsByRole.staff.length}, manager ${tsByRole.manager.length}`
  );
}

/* ---- 2. the catalogue must cover every permission, or the panel lies ----- */
const { rows: catalog } = await db.query(`select permission from public.permission_catalog`);
const inCatalog = new Set(catalog.map((row) => row.permission));

for (const permission of PERMISSIONS) {
  /* admin.access / dashboard.view are internal doors, not something an owner
     can hand out — documented here rather than silently skipped. */
  if (permission === "admin.access" || permission === "dashboard.view") continue;
  if (!inCatalog.has(permission)) {
    fail(`permission_catalog has no row for "${permission}" — /foisal/access would not show it`);
  }
}
for (const permission of inCatalog) {
  if (!known.has(permission)) {
    fail(`permission_catalog lists "${permission}" which no role can hold`);
  }
}

if (!failed) pass(`catalogue covers all ${inCatalog.size} grantable permissions`);

/* ---- 3. admin must not appear anywhere in the configurable tables -------- */
const { rows: adminRows } = await db.query(
  `select count(*)::int as n from public.role_permissions where role = 'admin'`
);
if (adminRows[0].n !== 0) fail("role_permissions contains an 'admin' row — admin must never be configurable");

const { rows: adminCatalog } = await db.query(
  `select count(*)::int as n from public.permission_catalog where permission in ('admin.access','dashboard.view')`
);
if (adminCatalog[0].n !== 0) fail("permission_catalog contains an internal door permission");

if (!failed) pass("admin is not configurable");

console.log(`\n${failed === 0 ? "Permission defaults and catalogue agree. ✅" : `${failed} check(s) FAILED`}`);
process.exit(failed ? 1 : 0);
