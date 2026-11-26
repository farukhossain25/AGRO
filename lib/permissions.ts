import type { UserRole } from "./types";
import type { SessionUser } from "./session";

/* ==========================================================================
   Scoped permissions (section F)
   --------------------------------------------------------------------------
   One source of truth for "may this person do X". The UI hides what a role
   cannot do, but the API is what actually enforces it — every mutating route
   calls `requirePermission()` / `can()`, never a bare `role === "admin"`.

     customer  buy, review, complain
     premium   + livestream
     seller    own products + own orders only (never global money/team)
     staff     content, catalogue, reviews, FAQ, media — no money, no team
     manager   staff + orders, sellers, payouts, reports, coupons
     admin     everything, including team and settings

   Adding a permission = adding a key here and one line in ROLES. Adding a
   route that forgets the check is caught by scripts/audit-permissions.mjs.
   ========================================================================== */

export const PERMISSIONS = [
  /* ---- housekeeping: what each role can see in the admin shell ---- */
  "admin.access", // may open the panel at all
  "dashboard.view",
  "reports.view",

  /* ---- catalogue ---- */
  "products.read",
  "products.write",
  "categories.write",
  "combos.write",
  "inventory.write",

  /* ---- orders & money ---- */
  "orders.read",
  "orders.write",
  "orders.refund",
  "coupons.write",
  "payouts.read",
  "payouts.write",
  /** Managing the payment receiving methods (numbers, names, instructions).
   *  Deliberately admin-only: these are the numbers customers send money to. */
  "payments.manage",

  /* ---- people ---- */
  "customers.read",
  "sellers.read",
  "sellers.approve",
  "team.read",
  "team.invite",
  "team.role", // change someone else's role
  "team.suspend",

  /* ---- content ---- */
  "content.write", // blog, CMS pages, banners, FAQ
  "seo.write",
  "media.write",
  /** homepage section order + hero slides */
  "content.layout",
  /** social links in the header/footer/contact */
  "content.social",

  /* ---- moderation & premium ---- */
  "reviews.moderate",
  "complaints.handle",
  /** Live chat: see every incoming chat, claim one, reply to it. Read is open
   *  to all staff — the claim is what decides who may type (see chat_claim()). */
  "chats.handle",
  "cams.manage",
  "premium.manage",

  /* ---- dangerous ---- */
  "settings.write",
  "audit.read",
  "data.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  "admin.access",
  "dashboard.view",
  "products.read",
  "products.write",
  "categories.write",
  "combos.write",
  "inventory.write",
  "orders.read",
  "content.write",
  "seo.write",
  "media.write",
  "reviews.moderate",
  "complaints.handle",
  "chats.handle",
  "customers.read",
  "sellers.read",
  "cams.manage",
  "content.layout",
  "content.social",
];

const MANAGER: Permission[] = [
  ...STAFF,
  "reports.view",
  "orders.write",
  "orders.refund",
  "coupons.write",
  "payouts.read",
  "payouts.write",
  "sellers.approve",
  "premium.manage",
  "team.read",
  "audit.read",
  "data.export",
  "content.layout",
  "content.social",
];

const ADMIN: Permission[] = [
  ...MANAGER,
  // Managing the payment receiving numbers is the single highest-value action
  // in the panel — only an admin holds it.
  "payments.manage",
  "team.invite",
  "team.role",
  "team.suspend",
  "settings.write",
];

/** What each role may do. Keyed by role so a typo in a role string fails closed. */
const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  admin: new Set(ADMIN),
  manager: new Set(MANAGER),
  staff: new Set(STAFF),
};

export const STAFF_ROLES: UserRole[] = ["staff", "manager", "admin"];

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Does this session hold the permission? Unknown roles get nothing. */
export function can(user: SessionUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const set = ROLE_PERMISSIONS[user.role];
  if (!set) return false;
  return set.has(permission);
}

export function canAny(user: SessionUser | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(user, permission));
}

/** Bangla label for the role — used in the team table and the audit log. */
export function roleLabelBn(role: UserRole): string {
  switch (role) {
    case "admin":
      return "অ্যাডমিন";
    case "manager":
      return "ম্যানেজার";
    case "staff":
      return "স্টাফ";
    case "seller":
      return "সেলার";
    case "premium":
      return "প্রিমিয়াম";
    default:
      return "কাস্টমার";
  }
}

/** Human-readable description shown in the role picker. */
export const ROLE_DESCRIPTIONS: { role: UserRole; label: string; hint: string }[] = [
  { role: "staff", label: "স্টাফ", hint: "কনটেন্ট, পণ্য, রিভিউ — টাকা বা টিম নয়" },
  { role: "manager", label: "ম্যানেজার", hint: "স্টাফ + অর্ডার, পেমেন্ট, সেলার, রিপোর্ট" },
  { role: "admin", label: "অ্যাডমিন", hint: "সব কিছু, টিম ও সেটিংস সহ" },
];
