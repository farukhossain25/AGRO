#!/usr/bin/env node
/**
 * scripts/check-columns.mjs — keeps the code and the SQL in sync
 * ---------------------------------------------------------------------------
 * `lib/database.types.ts` is generated FROM supabase/sql/, so the TypeScript
 * compiler already knows every column. This script closes the last gap those
 * types cannot see: plain string arguments.
 *
 *   .from("products").select("id, name_bn, price")   ← select string
 *   .from("orders").order("created_at")              ← order/filter column
 *
 * A typo there compiles fine and fails at runtime with
 * `column products.name_bn_bn does not exist`. This scan catches it before a
 * deploy, and also flags any `.from("…")` naming a table that no longer exists.
 *
 * Run:  npm run db:columns      (part of `npm run verify`)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const types = readFileSync("lib/database.types.ts", "utf8");

/* table/view name → set of column names, straight from the generated file */
const schema = new Map();
for (const section of ["Tables", "Views"]) {
  const start = types.indexOf(`    ${section}: {`);
  if (start < 0) continue;
  const end = types.indexOf("\n    },", start);
  const body = types.slice(start, end);
  const re = /^      ([a-z_]+): \{\n      Row: \{([\s\S]*?)\n      \}/gm;
  let match;
  while ((match = re.exec(body))) {
    const cols = new Set();
    for (const line of match[2].split("\n")) {
      const col = line.match(/^\s{8}([a-z_0-9]+)\??:/);
      if (col) cols.add(col[1]);
    }
    schema.set(match[1], cols);
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist", "build"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const problems = [];
const seen = new Set();

for (const file of [...walk("app"), ...walk("lib"), ...walk("components")]) {
  if (file.endsWith("lib/database.types.ts")) continue;
  const body = readFileSync(file, "utf8");

  /* The same `.from()` string is used for tables AND storage buckets, so the
     bucket calls are blanked out before the scan. */
  const code = body.replace(/\.storage\s*\.from\(/g, ".STORAGE_FROM(");

  /* Walk the file one query at a time: a chunk runs from one `.from(` to the
     next one (or a semicolon), so a filter can never be blamed on the query
     above it. */
  const starts = [];
  const fromRe = /\.from\("([a-z_0-9]+)"\)/g;
  let m;
  while ((m = fromRe.exec(code))) starts.push({ name: m[1], index: m.index });

  for (let i = 0; i < starts.length; i += 1) {
    const { name, index } = starts[i];
    const next = starts[i + 1]?.index ?? code.length;
    const semi = code.indexOf(";", index);
    const stop = Math.min(next, semi > 0 ? semi : code.length, index + 800);
    const chunk = code.slice(index, stop);

    if (!schema.has(name)) {
      if (!seen.has(`${file}:${name}`)) {
        seen.add(`${file}:${name}`);
        problems.push(`${file}: table/view "${name}" is not in supabase/sql`);
      }
      continue;
    }

    const cols = schema.get(name);

    /* select("a, b, c") — nested selects are skipped (they carry their own
       table prefix, e.g. order_items(*)) */
    const select = chunk.match(/\.select\(\s*"([^"]*)"/);
    if (select && select[1] !== "*" && !select[1].includes("(")) {
      for (const part of select[1].split(",")) {
        const column = part.trim().split(":")[0].trim();
        if (!column || column === "count") continue;
        if (!cols.has(column)) problems.push(`${file}: ${name}.${column} is not a column`);
      }
    }

    /* .eq/.order/.gte…("column", …) */
    const filterRe = /\.(?:eq|neq|gt|gte|lt|lte|ilike|like|in|is|order)\(\s*"([a-z_0-9]+)"/g;
    let filter;
    while ((filter = filterRe.exec(chunk))) {
      if (!cols.has(filter[1])) problems.push(`${file}: filter ${name}.${filter[1]} is not a column`);
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} schema mismatch(es):\n`);
  for (const problem of problems) console.error(`   ${problem}`);
  console.error("\nFix the string, or add the column to supabase/sql and run `npm run db:types`.");
  process.exit(1);
}

console.log(`✓ code and schema agree — ${schema.size} tables/views, every column checked`);
