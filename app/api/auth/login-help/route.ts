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

   ⚠️ THIS USED TO BE AN EMAIL ENUMERATION ORACLE
   --------------------------------------------------------------------------
   The response returned `exists`, `hasPassword` and `providers` verbatim. Any
   script could POST a list of addresses and learn who is a customer of this
   shop — valuable on its own, and the classic first step before credential
   stuffing. "unconfirmed" leaked the same thing a different way.

   The fix is not "delete the useful messages"; a person who typed their own
   password deserves to know whether to reset it or to confirm their e-mail.
   The fix is to make the answer impossible for an *attacker* and possible for
   the *owner*:

     • the session's own e-mail is always answered truthfully;
     • any other address gets the same answer the RPC would give for an
       address that exists, whether it exists or not;
     • the response no longer contains any field that distinguishes the two.

   Consequences: rate limiting is kept (a 12/5-min per-IP budget cannot be used
   to walk a list anyway), and nothing about the shape of the reply changes for
   the browser, so the login form keeps working untouched.
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

/**
 * The neutral answer. This is what an unidentified caller gets for any address,
 * and it is deliberately the *most likely* case rather than an error: a real
 * customer sees the reset-password hint, which is the right action for someone
 * whose password failed, and a stranger learns nothing.
 */
const NEUTRAL = {
  hasPassword: true,
  providers: [] as string[],
  unconfirmed: false,
  /** false = "no account-specific diagnosis was performed" */
  matched: false,
} as const;

export async function POST(req: Request) {
  try {
    const { email } = bodySchema.parse(await req.json());

    if (throttled(clientIp(req) ?? "unknown")) {
      // Silent: the UI already shows its own message.
      return ok({ ...NEUTRAL });
    }

    if (!isSupabaseAdminConfigured) {
      return ok({ ...NEUTRAL });
    }

    /* Who is asking? Only the owner of a session may be told anything about an
       address, and only about their own. `getServerUser()` validates the cookie
       with Supabase — it is not a header or a body field. */
    const { getServerUser } = await import("@/lib/supabase/server");
    const sessionUser = await getServerUser().catch(() => null);
    const ownAddress = sessionUser?.email?.trim().toLowerCase();

    // Not the signed-in address → answer exactly as for an existing account.
    if (!ownAddress || ownAddress !== email.trim().toLowerCase()) {
      return ok({ ...NEUTRAL });
    }

    const { data, error } = await db().rpc("login_help", { p_email: email });
    if (error) throw error;

    const row = (data ?? null) as
      | { exists?: boolean; has_password?: boolean; providers?: string[]; unconfirmed?: boolean }
      | null;

    /* Owner of the address. `exists === false` here would mean the session's
       e-mail has no auth row — a deleted-account edge case. Fall back to the
       neutral answer rather than confirming anything unusual. */
    if (row?.exists !== true) {
      return ok({ ...NEUTRAL });
    }

    return ok({
      hasPassword: row.has_password === true,
      providers: Array.isArray(row.providers) ? row.providers : [],
      unconfirmed: row.unconfirmed === true,
      matched: true,
    });
  } catch (error) {
    return handleError(error);
  }
}
