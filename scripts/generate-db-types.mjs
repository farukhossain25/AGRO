#!/usr/bin/env node
/**
 * Generates lib/database.types.ts from supabase/sql/*.sql.
 *
 *   npm run db:types
 *
 * How it works: the SQL files are executed in order inside an in-process
 * Postgres (PGlite) with Supabase's auth/storage objects stubbed, then the
 * resulting catalog is introspected. The TypeScript you commit therefore always
 * matches the files you paste into the Supabase SQL Editor — no hand-editing,
 * no drift.
 *
 * Re-run this after ANY change to supabase/sql:
 *   npm run db:types && npm run typecheck
 */
import fs from "node:fs";
import path from "node:path";
import { loadSchema } from "./lib/sql-harness.mjs";

const OUT = path.resolve(process.cwd(), "lib/database.types.ts");

const db = await loadSchema();
console.log("schema loaded — introspecting…");

/* ------------------------------------------------------------------ helpers */
const quote = (s) => JSON.stringify(s);

function tsType(udt, isEnum, enumName) {
  if (isEnum) return `Database["public"]["Enums"][${quote(enumName)}]`;
  switch (udt) {
    case "uuid":
    case "text":
    case "varchar":
    case "character varying":
    case "bpchar":
    case "date":
    case "time":
    case "timetz":
    case "timestamp":
    case "timestamptz":
    case "interval":
    case "inet":
    case "citext":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "smallint":
    case "integer":
    case "bigint":
    case "numeric":
    case "decimal":
    case "real":
    case "float4":
    case "float8":
    case "double precision":
    case "money":
      return "number";
    case "bool":
    case "boolean":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    case "void":
      return "undefined";
    case "_text":
    case "text[]":
      return "string[]";
    case "_uuid":
      return "string[]";
    case "_int4":
      return "number[]";
    case "_jsonb":
      return "Json[]";
    default:
      if (udt?.startsWith("_")) return "string[]";
      return "Json";
  }
}

/* -------------------------------------------------------------------- enums */
const enums = await db.query(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
   group by t.typname
   order by t.typname
`);

/* ------------------------------------------------------------------- tables */
const tableRows = await db.query(`
  select c.relname as table_name, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v')
   order by c.relkind, c.relname
`);

const columnRows = await db.query(`
  select c.relname as table_name,
         a.attname as column_name,
         a.attnum,
         not a.attnotnull as is_nullable,
         pg_get_expr(d.adbin, d.adrelid) as column_default,
         a.attidentity as identity,
         a.attgenerated as generated,
         case when bt.typtype = 'e' then bt.typname end as enum_name,
         case
           when bt.typtype = 'd' then bt.typname
           when bt.typcategory = 'A' then '_' || case when et.typtype = 'e' then et.typname else et.typname end
           else bt.typname
         end as udt_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
    left join pg_type bt on bt.oid = a.atttypid
    left join pg_type et on et.oid = bt.typelem
   where n.nspname = 'public' and c.relkind in ('r', 'v')
   order by c.relname, a.attnum
`);

const columnsByTable = new Map();
for (const row of columnRows.rows) {
  if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, []);
  columnsByTable.get(row.table_name).push(row);
}

const byName = (rows) => {
  const map = new Map();
  for (const row of rows) map.set(row.table_name, row);
  return map;
};
const tableKinds = byName(tableRows.rows);

/* ---------------------------------------------------------------- functions */
const fnRows = await db.query(`
  select p.proname as name,
         pg_get_function_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as result,
         p.proretset as returns_set,
         array_agg(coalesce(pt.typname, 'jsonb') order by a.ord) as arg_types
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join information_schema.parameters a on a.specific_name = p.proname || '_' || p.oid
    left join pg_type pt on pt.oid = a.ordinal_position
   where false
   group by 1,2,3,4
`).catch(() => ({ rows: [] }));

/* The information_schema join above is dialect-fragile; build it from pg_proc
   only, which is stable. */
const fns = await db.query(`
  select p.oid,
         p.proname as name,
         p.pronargs,
         p.proargnames as arg_names,
         p.proargtypes::oid[] as arg_oids,
         p.prorettype,
         p.proretset
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
   order by p.proname
`);

const typeById = new Map();
const typRows = await db.query(`
  select oid, typname, typtype, typcategory from pg_type
`);
for (const t of typRows.rows) typeById.set(String(t.oid), t);

function fnArg(argOid, argName) {
  const t = typeById.get(String(argOid));
  const type = tsType(t?.typname, t?.typtype === "e", t?.typname);
  return `${argName}: ${type}`;
}

function fnReturn(oid) {
  const t = typeById.get(String(oid));
  if (!t) return "Json";
  if (t.typname === "record") return "Json";
  if (t.typname === "void") return "undefined";
  return tsType(t.typname, t.typtype === "e", t.typname);
}

/* ------------------------------------------------------------------- render */
const lines = [];
lines.push(`/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: supabase/sql/*.sql
 * Regenerate with: npm run db:types
 *
 * Every table, column, enum and RPC below comes from the SQL you run in the
 * Supabase SQL Editor, so the app and the database cannot drift apart.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {`);

const tables = [...columnsByTable.entries()].filter(([name]) => tableKinds.get(name)?.relkind === "r");
const views = [...columnsByTable.entries()].filter(([name]) => tableKinds.get(name)?.relkind === "v");

for (const [table, cols] of tables) {
  const row = cols
    .map((c) => `        ${c.column_name}: ${tsType(c.udt_name, !!c.enum_name, c.enum_name)}${c.is_nullable ? " | null" : ""}`)
    .join("\n");
  const insert = cols
    .map((c) => {
      const optional = c.is_nullable || c.column_default !== null || c.identity || c.generated;
      const type = tsType(c.udt_name, !!c.enum_name, c.enum_name);
      return `        ${c.column_name}${optional ? "?" : ""}: ${type}${c.is_nullable ? " | null" : ""}`;
    })
    .join("\n");
  const update = cols
    .map((c) => `        ${c.column_name}?: ${tsType(c.udt_name, !!c.enum_name, c.enum_name)}${c.is_nullable ? " | null" : ""}`)
    .join("\n");
  lines.push(`      ${table}: {
      Row: {
${row}
      }
      Insert: {
${insert}
      }
      Update: {
${update}
      }
      Relationships: []
    }`);
}

lines.push(`    }
    Views: {`);
for (const [view, cols] of views) {
  const row = cols
    .map((c) => `        ${c.column_name}: ${tsType(c.udt_name, !!c.enum_name, c.enum_name)}${c.is_nullable ? " | null" : ""}`)
    .join("\n");
  lines.push(`      ${view}: {
      Row: {
${row}
      }
      Relationships: []
    }`);
}
lines.push(`    }
    Functions: {`);

const seen = new Set();
for (const fn of fns.rows) {
  if (seen.has(fn.name)) continue; // overloads: keep the first
  seen.add(fn.name);
  const names = fn.arg_names ?? [];
  const args = (fn.arg_oids ?? [])
    .map((oid, i) => fnArg(oid, names[i] ?? `arg${i + 1}`))
    .join("; ");
  lines.push(`      ${fn.name}: {
      Args: { ${args} }
      Returns: ${fn.proretset ? "Json[]" : fnReturn(fn.prorettype)}
    }`);
}
lines.push(`    }
    Enums: {`);
for (const e of enums.rows) {
  lines.push(`      ${e.name}: ${e.labels.map((l) => quote(l)).join(" | ")}`);
}
lines.push(`    }
    CompositeTypes: {}
  }
}

/* ------------------------------------------------------------------ helpers */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
export type Functions<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T]
`);

fs.writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${path.relative(process.cwd(), OUT)} — ${tables.length} tables, ${views.length} views, ${seen.size} functions, ${enums.rows.length} enums`);
