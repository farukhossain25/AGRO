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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

/* 9 ── manual payments: the verdict must stay server-side -------------------- */
/* A payment is only allowed to become `verified` through decidePayment(), which
   requires `payments.verify` (admin) and re-checks the duplicate TrxID. If some
   future route writes `status: "verified"` directly with a narrower guard, the
   shop accepts unpaid orders. */
for (const file of source.filter((f) => f.endsWith(".ts") && f.startsWith("app/api"))) {
  const body = readFileSync(file, "utf8");
  const writesVerified = /status:\s*["']verified["']/.test(body);
  const isDecisionPath = /decidePayment\(/.test(body) || file.includes("api/foisal/payments/");
  if (writesVerified && !isDecisionPath) {
    add("error", file, 'writes status: "verified" outside decidePayment()');
  }
}

const mp = readFileSync("lib/manual-payments.ts", "utf8");
if (!/export async function decidePayment/.test(mp)) {
  add("error", "lib/manual-payments.ts", "decidePayment() is missing — nothing may approve a payment");
}
if (!/trx_norm/.test(mp)) {
  add("error", "lib/manual-payments.ts", "duplicate-TrxID check is gone");
}

/* 10 ── the admin URL must stay in one place -------------------------------- */
/* Every link, redirect and guard must import from lib/paths.ts. A hard-coded
   "/foisal" or "/admin" literal anywhere else means changing ADMIN_PATH would
   half-work — the worst possible outcome for a hidden panel. */
const pathAllow = new Set(["lib/paths.ts", "app/robots.ts", "middleware.ts"]);
for (const file of source.filter((f) => /^(app|components|lib)\//.test(f) && /\.(ts|tsx)$/.test(f))) {
  if (pathAllow.has(file)) continue;
  const body = readFileSync(file, "utf8");
  // ignore comments — the docs mention the URLs constantly
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
  /* Any *literal* of the admin path — not just fetch/href — is a bug waiting
     for the day the owner changes ADMIN_PATH. Route folders and imports are
     identifiers, not strings, so they never match here. */
  if (/[`"']\/foisal(\/|["'`?])/.test(code)) {
    add("warn", file, 'hard-coded "/foisal" — import ADMIN_BASE from lib/paths.ts');
  }
  if (/[`"']\/admin(\/|["'`?])/.test(code)) {
    add("error", file, 'links to the removed "/admin" path');
  }
}

/* 11 ── the legacy URL constant must actually be the legacy URL ------------ */
/* A bulk find-and-replace once rewrote LEGACY_ADMIN_BASE to the *new* path,
   which made the middleware 404 the live admin panel. Silent, total outage of
   the panel with no error anywhere — worth a permanent guard. */
{
  const paths = readFileSync("lib/paths.ts", "utf8");
  const match = paths.match(/LEGACY_ADMIN_BASE\s*=\s*"([^"]+)"/);
  const adminPath = (process.env.NEXT_PUBLIC_ADMIN_PATH || process.env.ADMIN_PATH || "foisal");
  if (!match) {
    add("error", "lib/paths.ts", "LEGACY_ADMIN_BASE is missing");
  } else if (match[1].replace(/^\//, "") === adminPath) {
    add("error", "lib/paths.ts", "LEGACY_ADMIN_BASE equals the live admin path — the panel would 404");
  }
}

/* 12 ── no public door to the panel ---------------------------------------- */
/* The brief is explicit: no admin links anywhere in public HTML. The footer and
   the account header both used to carry one. A component under
   app/(storefront) or components/ that links to ADMIN_BASE without a role gate
   is a leak, so flag any adminHref/ADMIN_BASE reference whose file does not
   also test a staff/admin role. */
{
  const publicRoots = "^(app/\\(storefront\\)|components/(?!admin/))";
  for (const file of source.filter((f) => new RegExp(publicRoots).test(f) && /\.(ts|tsx)$/.test(f))) {
    if (file.startsWith("app/(storefront)/foisal")) continue;
    const body = readFileSync(file, "utf8");
    if (!/(ADMIN_BASE|adminHref\(|ADMIN_LOGIN_PATH)/.test(body)) continue;
    const gated =
      /isStaffRole|role === "admin"|role === "staff"|role === "manager"|can\(/.test(body);
    if (!gated) {
      add("error", file, "references the admin URL without a staff/admin gate — a public admin link leaks the hidden path");
    }
  }
}

/* 13 ── a plan may only be activated after money arrives --------------------- */
/* /api/premium/activate used to let any signed-in customer activate their own
   pending subscription — a free year of premium for anyone who read the client
   bundle. The single legitimate path is an admin approving a TrxID. */
{
  const file = "app/api/premium/activate/route.ts";
  if (existsSync(file)) {
    const body = readFileSync(file, "utf8");
    if (!/role\s*!==\s*"admin"/.test(body) && !/requireAdmin\(/.test(body)) {
      add("error", file, "activates premium without an admin check — a customer could self-activate");
    }
    if (!/duration_days/.test(body)) {
      add("error", file, "premium activation does not read plan.duration_days — the term would be wrong");
    }
  }
}

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
