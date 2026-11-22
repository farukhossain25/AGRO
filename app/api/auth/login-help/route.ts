import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, handleError, ok } from "@/lib/api";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/* ==========================================================================
   /api/auth/login-help — "কেন লগইন হচ্ছে না?"
   --------------------------------------------------------------------------
   Called by the login form *only after* Supabase rejected the password. It
   answers the one question the generic "Invalid login credentials" cannot:

     • is there an account on this address at all?
     • was it created with Google (so it has no password to type)?
     • is the e-mail still unconfirmed?

   Supabase deliberately hides all of that from the browser, so the lookup runs
   here with the service key and a tiny in-memory throttle. The response never
   contains the password hash, the user id or anything else.
   ========================================================================== */

const bodySchema = z.object({ email: z.string().trim().email().max(200) });

/** 12 look-ups per IP per 5 minutes — enough for a person, useless for a scraper. */
const WINDOW_MS = 5 * 60_000;
const LIMIT = 12;
const hits = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 500) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(req: Request) {
  try {
    const { email } = bodySchema.parse(await req.json());

    if (throttled(clientIp(req) ?? "unknown")) {
      // Silent: the UI already shows its own message.
      return ok({ exists: null, hasPassword: null, providers: [], unconfirmed: null });
    }

    if (!isSupabaseAdminConfigured) {
      return ok({ exists: null, hasPassword: null, providers: [], unconfirmed: null });
    }

    const { data, error } = await db().rpc("login_help", { p_email: email });
    if (error) throw error;

    const row = (data ?? null) as
      | { exists?: boolean; has_password?: boolean; providers?: string[]; unconfirmed?: boolean }
      | null;

    return ok({
      exists: row?.exists === true,
      hasPassword: row?.has_password === true,
      providers: Array.isArray(row?.providers) ? row!.providers : [],
      unconfirmed: row?.unconfirmed === true,
    });
  } catch (error) {
    return handleError(error);
  }
}
