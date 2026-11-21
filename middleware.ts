import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge guard for /admin/**.
 *
 * This is a fast first line of defence — it only checks that a valid admin JWT
 * cookie exists. The (protected) layout and every /api/admin route re-verify
 * the session server-side against profiles.role, which remains authoritative.
 *
 * Three outcomes for a signed-in non-admin:
 *   • no cookie at all      → /admin/login (they may be an admin, just stale)
 *   • valid customer cookie → /forbidden  (Access denied, per the brief)
 * That distinction is what stops a customer silently bouncing through the
 * login screen forever.
 */
const ADMIN_COOKIE = "ba_admin";
const SESSION_COOKIE = "ba_session";

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me-please-32"
  );
}

type Verdict = "admin" | "other" | "none";

async function check(token: string | undefined): Promise<Verdict> {
  if (!token) return "none";
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin" ? "admin" : "other";
  } catch {
    return "none"; // expired or tampered → treat as signed out
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const store = req.cookies;
  const adminToken = store.get(ADMIN_COOKIE)?.value;
  const sessionToken = store.get(SESSION_COOKIE)?.value;

  const adminVerdict = await check(adminToken);
  const sessionVerdict = adminVerdict === "admin" ? "admin" : await check(sessionToken);

  // Already signed in as admin? Skip the login screen.
  if (pathname === "/admin/login") {
    if (sessionVerdict === "admin") return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (sessionVerdict === "admin") return NextResponse.next();

  // Signed in, but not an admin → hard "Access denied".
  if (sessionVerdict === "other") {
    const url = new URL("/forbidden", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Not signed in at all → login page, preserving the destination.
  const url = new URL("/admin/login", req.url);
  if (pathname !== "/admin") url.searchParams.set("next", pathname);
  const res = NextResponse.redirect(url);
  if (adminToken) res.cookies.delete(ADMIN_COOKIE);
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
