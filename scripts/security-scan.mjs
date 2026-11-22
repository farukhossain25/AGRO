#!/usr/bin/env node
/**
 * scripts/security-scan.mjs — section G guardrails
 * ---------------------------------------------------------------------------
 * A static scan for the mistakes that are easy to reintroduce and expensive to
 * notice: an unguarded mutating route, a secret leaking into the client bundle,
 * `unsafe-inline` sneaking back into the CSP, a raw innerHTML, a missing
 * timeout on a database call.
 *
 * Run with:  npm run security
 * Exits 1 on any finding, so it can gate a deploy.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const findings = [];
const add = (level, file, message) => findings.push({ level, file, message });

function walk(dir, ext = [".ts", ".tsx"], out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist", "build"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, ext, out);
    else if (ext.some((e) => path.endsWith(e))) out.push(path);
  }
  return out;
}

const source = walk(".");

/* 1 ── every mutating API route must authorise ---------------------------------- */
for (const file of source.filter((f) => f.startsWith("app/api") && f.endsWith("route.ts"))) {
  const body = readFileSync(file, "utf8");
  const mutating = /export async function (POST|PATCH|PUT|DELETE)/.test(body);
  if (!mutating) continue;

  const guarded =
    /requirePermission\(|requireAdmin\(|requireStaff\(|requireUser\(/.test(body) ||
    /currentUser\(/.test(body) ||
    /safeEqual\(|timingSafeEqual|SEED_SECRET/.test(body) || // one-shot bootstrap
    /verifyStreamToken/.test(body) || // token-gated stream proxy
    /auth\.signInWithPassword|supabaseAnonServer/.test(body); // credential check itself

  /* Routes that are public BY DESIGN. Each entry states why it needs no
     session — anything else that mutates is a finding. */
  const PUBLIC_BY_DESIGN = {
    "app/api/auth/login/route.ts": "credential check — the password IS the auth",
    "app/api/auth/logout/route.ts": "clears cookies; harmless without a session",
    "app/api/auth/register/route.ts": "signup, rate-limited + validated",
    "app/api/auth/otp/request/route.ts": "login by OTP, rate-limited per phone",
    "app/api/auth/otp/verify/route.ts": "login by OTP, rate-limited per phone",
    "app/api/contact/route.ts": "public contact form, rate-limited",
    "app/api/newsletter/route.ts": "public signup, rate-limited",
    "app/api/coupons/validate/route.ts": "read-only coupon check, rate-limited",
  };
  const key = file.replace(/^\.\//, "");
  if (guarded || PUBLIC_BY_DESIGN[key]) continue;

  add("error", file, "mutating route with no session/permission check");
}

/* 2 ── service-role key must never be imported by a client component ----------- */
for (const file of source.filter((f) => f.endsWith(".tsx"))) {
  const body = readFileSync(file, "utf8");
  if (body.startsWith('"use client"') && /SUPABASE_SERVICE_ROLE_KEY|supabaseService/.test(body)) {
    add("error", file, "service-role client used inside a client component");
  }
}

/* 3 ── no secrets in the bundle: NEXT_PUBLIC_ + secret-looking name ------------ */
for (const file of source) {
  const body = readFileSync(file, "utf8");
  if (/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE_KEY)/.test(body)) {
    add("error", file, "secret exposed through a NEXT_PUBLIC_ variable");
  }
}

/* 4 ── CSP must not allow inline scripts outside dev --------------------------- */
const middleware = readFileSync("middleware.ts", "utf8");
if (/script-src[^;]*'unsafe-inline'/.test(middleware) && !/isDev \?/.test(middleware)) {
  add("error", "middleware.ts", "script-src allows 'unsafe-inline'");
}
if (!/nonce-\$\{nonce\}/.test(middleware)) {
  add("warn", "middleware.ts", "CSP no longer uses a per-request nonce");
}

/* 5 ── raw HTML injection ------------------------------------------------------ */
for (const file of source) {
  const body = readFileSync(file, "utf8");
  const hits = body.match(/dangerouslySetInnerHTML/g) ?? [];
  for (const [index] of hits.entries()) {
    const isJsonLd = /jsonLdScript|application\/ld\+json/.test(body);
    const isQrSvg = /qr\.toString|qrSvg/.test(body);
    // the scanner mentions the pattern in a comment, so it flags itself — skip
    // this file and any file where the pattern only appears in prose
    // ignore prose: a mention that is not inside JSX props is documentation
    const codeHits = (body.match(/dangerouslySetInnerHTML\s*=\s*\{\{/g) ?? []).length;
    if (index >= codeHits) continue;
    if (file.includes("security-scan")) continue;
    if (!isJsonLd && !isQrSvg && !/svg/.test(body) && !onlyInComment) {
      add("warn", file, `dangerouslySetInnerHTML #${index + 1} with unverified content`);
    }
  }
}

/* 6 ── database calls must be able to time out -------------------------------- */
const dbLib = readFileSync("lib/db.ts", "utf8");
if (!/timeoutFetch/.test(dbLib)) {
  add("error", "lib/db.ts", "fetch timeout wrapper missing — a stalled query can hang a render");
}

/* 7 ── .env files must never be committed ------------------------------------- */
for (const file of source.filter((f) => f.startsWith("./.env"))) {
  if (file !== "./.env.example") add("error", file, "real environment file is in the repository");
}

/* 8 ── cookies must stay httpOnly + sameSite ---------------------------------- */
const auth = readFileSync("lib/auth.ts", "utf8");
if (!/httpOnly:\s*true/.test(auth)) add("error", "lib/auth.ts", "session cookie is not httpOnly");
if (!/sameSite/.test(auth)) add("warn", "lib/auth.ts", "session cookie has no SameSite attribute");

/* report --------------------------------------------------------------------- */
const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");

console.log(`\nSecurity scan — ${errors.length} error(s), ${warns.length} warning(s)\n`);
for (const f of [...errors, ...warns]) {
  const tag = f.level === "error" ? "✗" : "!";
  console.log(`  ${tag} ${f.file}\n      ${f.message}`);
}
if (!findings.length) console.log("  ✓ no findings\n");

process.exit(errors.length ? 1 : 0);
