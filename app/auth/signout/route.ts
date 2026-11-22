import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   POST /auth/signout
   --------------------------------------------------------------------------
   Ends the Supabase session server-side (revokes the refresh token) and then
   deletes the auth cookies on the response, so a stale cookie can never keep
   the user "logged in" in another tab.

   POST only — a GET would let any link on the internet sign the user out
   (CSRF). Every caller in the app posts a form or uses fetch().
   ========================================================================== */

function clearAuthCookies(res: NextResponse, cookieNames: string[]) {
  for (const name of cookieNames) {
    if (!name.startsWith("sb-")) continue;
    res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
}

export async function POST(req: Request) {
  const cookieNames = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter(Boolean) ?? [];

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[auth/signout] signOut failed:", (error as Error)?.message);
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  clearAuthCookies(res, cookieNames);
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}

/** A browser that lands here by accident gets a clean 405, not a session change. */
export function GET() {
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}
