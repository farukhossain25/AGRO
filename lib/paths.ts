/* ==========================================================================
   lib/paths.ts — the one place the admin URL is spelled
   --------------------------------------------------------------------------
   The panel lives at `/{ADMIN_PATH}` (default `foisal`). Every link, redirect
   and guard imports from here, so changing the URL is one env var and one
   redeploy — never a code edit.

   Env resolution order:
     NEXT_PUBLIC_ADMIN_PATH  ← preferred: inlined into the client bundle too,
                               so sidebar links and redirects cannot disagree
     ADMIN_PATH              ← server-only override (middleware, routes)
     "foisal"                ← default

   In a Client Component `process.env.ADMIN_PATH` is `undefined` at runtime
   (only NEXT_PUBLIC_* is inlined), so the fallback keeps the value honest.
   README §24 tells the owner which variable to set.

   Note: hiding the URL is NOT security. The real boundary is the session
   cookie + `is_staff()` in the database. See SECURITY_REPORT.md.
   ========================================================================== */

import type { Permission } from "@/lib/permissions";

/** Raw, unvalidated value straight from the environment. */
export const ADMIN_PATH_RAW =
  process.env.NEXT_PUBLIC_ADMIN_PATH || process.env.ADMIN_PATH || "foisal";

/**
 * Sanitised path segment: lowercase, no slashes, no dots.
 * A hostile env value like `../../etc` collapses to `etc`.
 */
export const ADMIN_PATH = ADMIN_PATH_RAW.trim()
  .toLowerCase()
  .replace(/^\/+|\/+$/g, "")
  .replace(/[^a-z0-9-]/g, "")
  .slice(0, 40) || "foisal";

/** Absolute base without a trailing slash: `/foisal`. */
export const ADMIN_BASE = `/${ADMIN_PATH}`;

/** Build an admin URL: `adminHref("team")` → `/foisal/team`. */
export function adminHref(sub = ""): string {
  const tail = sub.replace(/^\/+/, "");
  return tail ? `${ADMIN_BASE}/${tail}` : ADMIN_BASE;
}

/** True when a pathname belongs to the admin panel. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`);
}

/**
 * Panel pages a staff/manager account may open even though the rest of the
 * panel stays admin-only.
 *
 * This exists because live chat is useless otherwise: the owner's rule is
 * "every staff member sees an incoming chat and one of them claims it", but
 * before this list a staff account could not open /foisal at all. Keep this
 * list SMALL — a page belongs here only when the role model already grants it
 * (see lib/permissions.ts) and the page's own API re-checks the permission.
 */
export const STAFF_PANEL_SUBPATHS = ["chats"] as const;

/** True when `pathname` is exactly one of the staff-accessible panel pages. */
export function isStaffPanelPath(pathname: string): boolean {
  return STAFF_PANEL_SUBPATHS.some((sub) => pathname === `${ADMIN_BASE}/${sub}`);
}

/* ==========================================================================
   Which panel page may a non-admin open — by permission, not by role
   --------------------------------------------------------------------------
   Before this table a non-admin could open exactly one page (live chat) and
   every other URL 404'd, so a staff or manager account saw an empty sidebar
   and could not do the work its role was created for. The role model in
   lib/permissions.ts already said staff may edit products, media, reviews and
   content — the panel just never let them in.

   Each entry is the SAME permission the page's own API enforces
   (app/api/foisal/<page>/route.ts), so opening can never be broader than
   what its data layer allows. A page missing from this table stays
   admin-only — that is the safe default, and it is what keeps settings,
   payments, team and system-check closed.

   Kept in lib/paths.ts rather than lib/permissions.ts because both middleware
   (Edge) and the layout need it, and this is the URL<->rule file.
   ========================================================================== */
export const PANEL_PAGE_PERMISSIONS: Record<string, Permission> = {
  /* catalogue */
  products: "products.read",
  categories: "products.read",
  combos: "products.read",
  /* content */
  banners: "content.write",
  blog: "content.write",
  cms: "content.write",
  faq: "content.write",
  slides: "content.layout",
  homepage: "content.layout",
  social: "content.social",
  media: "media.write",
  seo: "seo.write",
  /* customer work */
  reviews: "reviews.moderate",
  complaints: "complaints.handle",
  chats: "chats.handle",
  customers: "customers.read",
  /* marketplace */
  sellers: "sellers.read",
  "camera-requests": "cams.manage",
  cameras: "cams.manage",
  farms: "cams.manage",
  /* money + higher — manager and up */
  orders: "orders.read",
  "food-plans": "orders.read",
  subscriptions: "orders.read",
  reports: "reports.view",
  coupons: "coupons.write",
  "seller-sales": "payouts.read",
  audit: "audit.read",
  /* who may reach which panel page — reading it is manager-and-up, changing it
     is admin-only (team.role). It sits under the same permission as the team
     screen because that is what it configures. */
  access: "team.read",
  team: "team.read",
  /* admin only, deliberately absent: payment-methods, delivery, settings,
     wallet-settings, premium, plans, codes, premium plans, system-check */
};

/**
 * The panel sub-path a URL points at ("" for the dashboard), or null when the
 * URL is not inside the panel at all.
 */
export function panelSubPath(pathname: string): string | null {
  if (pathname === ADMIN_BASE) return "";
  if (!pathname.startsWith(`${ADMIN_BASE}/`)) return null;
  return pathname.slice(ADMIN_BASE.length + 1).split("/")[0];
}

/**
 * May `role` open this panel URL?
 *
 *   • admin     — every page (money, team and settings included)
 *   • anyone else — only a page in PANEL_PAGE_PERMISSIONS whose permission the
 *     role actually holds; everything else is refused
 *
 * Takes a permission predicate rather than importing lib/permissions.ts so the
 * Edge middleware bundle does not grow; both callers already have `can()`.
 */
export function canOpenPanelPath(
  pathname: string,
  hold: (permission: Permission) => boolean
): boolean {
  const sub = panelSubPath(pathname);
  if (sub === null) return false;
  /* The dashboard is a MONEY summary (today's sales, week, totals, customers).
     `orders.read` alone is not the right bar for it: staff holds orders.read to
     pack an order, and the STAFF role is explicitly "no money". `reports.view`
     is manager-and-up and describes this page exactly. */
  if (sub === "") return hold("reports.view");
  const needed = PANEL_PAGE_PERMISSIONS[sub];
  return !!needed && hold(needed);
}

/**
 * Where a non-admin belongs when it types /foisal with no page in mind.
 *
 * Landing them on the dashboard would be wrong for a staff account (it is a
 * money summary and stays closed), so the sidebar's own order decides: the
 * first page in this table the role may open. Falls back to live chat, then to
 * the dashboard for a role that somehow holds nothing.
 */
export function firstReachablePanelPath(hold: (permission: Permission) => boolean): string {
  /* Never returns the dashboard for a role that may not open it — the layout
     uses this as a redirect target for /foisal, so returning /foisal here would
     loop forever. */
  if (hold("reports.view")) return ADMIN_BASE;
  /* Live chat first: the owner's rule is that every staff member must SEE an
     incoming chat, so that is the most useful front door for a staff account. */
  if (hold("chats.handle")) return adminHref("chats");
  for (const [sub, permission] of Object.entries(PANEL_PAGE_PERMISSIONS)) {
    if (hold(permission)) return adminHref(sub);
  }
  return "/forbidden";
}

/** True when a pathname is the admin login screen. */
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE}/login`;

/**
 * The path the panel used to live at. Requests here must 404 — never redirect,
 * or the 404 page itself would advertise where the panel moved to.
 */
export const LEGACY_ADMIN_BASE = "/admin";
