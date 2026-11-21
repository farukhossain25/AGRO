import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge guard for /admin/**.
 *
 * This is a fast first line of defence — it only checks that a valid admin JWT
 * cookie exists. The (protected) layout and every /api/admin route re-verify
 * the session server-side, which remains the authoritative check.
 */
const ADMIN_COOKIE = "ba_admin";
const SESSION_COOKIE = "ba_session";

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me-please-32"
  );
}

async function isAdmin(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const store = req.cookies;
  const token = store.get(ADMIN_COOKIE)?.value ?? store.get(SESSION_COOKIE)?.value;
  const admin = await isAdmin(token);

  // Already signed in? Skip the login screen.
  if (pathname === "/admin/login") {
    if (admin) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (!admin) {
    const url = new URL("/admin/login", req.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    // Clear a stale/invalid cookie so the login page is clean.
    if (token) res.cookies.delete(ADMIN_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
