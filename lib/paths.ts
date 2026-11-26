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

/** True when a pathname is the admin login screen. */
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE}/login`;

/**
 * The path the panel used to live at. Requests here must 404 — never redirect,
 * or the 404 page itself would advertise where the panel moved to.
 */
export const LEGACY_ADMIN_BASE = "/admin";
