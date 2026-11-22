import { cookies } from "next/headers";
import { ok } from "@/lib/api";
import { sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  store.delete(sessionCookie.name);
  store.delete(sessionCookie.adminName);
  return ok({ loggedOut: true });
}
