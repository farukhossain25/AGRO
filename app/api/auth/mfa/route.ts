import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { z } from "zod";
import { db, isDbConfigured } from "@/lib/db";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { getProfileByLegacyId } from "@/lib/profile";
import { generateRecoveryCodes, generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ==========================================================================
   TOTP 2FA for the admin (and any role, if you enable it later)
   --------------------------------------------------------------------------
   GET    /api/auth/mfa            → status + enrolled factor
   POST   /api/auth/mfa  {action:"enroll"}          → { secret, uri, qrSvg }
   POST   /api/auth/mfa  {action:"verify", code}    → activates + recovery codes
   POST   /api/auth/mfa  {action:"disable", code}   → removes (needs a valid code)
   POST   /api/auth/mfa  {action:"recovery", code}  → consume a recovery code

   Secrets live in `admin_mfa` (service-role only table) so neither the client
   nor the anon key can ever read them. The QR is rendered server-side with the
   `qrcode` package already in package.json.
   ========================================================================== */

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }),
  z.object({ action: z.literal("verify"), code: z.string().min(6).max(8) }),
  z.object({ action: z.literal("disable"), code: z.string().min(6).max(8) }),
  z.object({ action: z.literal("recovery"), code: z.string().min(8).max(16) }),
]);

async function guard() {
  const session = await currentUser();
  if (!session) return { error: fail("আগে লগইন করুন", 401) };
  if (session.role !== "admin") {
    return { error: fail("শুধুমাত্র অ্যাডমিন ২FA ব্যবহার করতে পারেন", 403) };
  }

  const profile = await getProfileByLegacyId(session.id);
  if (!profile) return { error: fail("প্রোফাইল পাওয়া যায়নি", 404) };

  return { session, profile };
}

async function row(legacyUserId: string) {
  if (!isDbConfigured()) return null;
  const { data } = await db()
    .from("admin_mfa")
    .select("id, secret, enabled, recovery_hashes, created_at, enabled_at")
    .eq("user_id", legacyUserId)
    .maybeSingle();
  return data as
    | {
        id: string;
        secret: string;
        enabled: boolean;
        recovery_hashes: string[] | null;
        created_at: string;
        enabled_at: string | null;
      }
    | null;
}

async function enforced(): Promise<boolean> {
  try {
    const { data } = await db().from("settings").select("value").eq("key", "auth").maybeSingle();
    return Boolean((data?.value as { require_admin_mfa?: boolean } | null)?.require_admin_mfa);
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const g = await guard();
    if ("error" in g) return g.error;

    const record = await row(g.session.id);

    return ok({
      enrolled: Boolean(record?.enabled),
      pending: Boolean(record && !record.enabled),
      enabledAt: record?.enabled_at ?? null,
      recoveryCodesLeft: record?.recovery_hashes?.length ?? 0,
      enforced: await enforced(),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "mfa"), 15, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const g = await guard();
    if ("error" in g) return g.error;

    const body = schema.parse(await req.json());
    const existing = await row(g.session.id);

    /* ------------------------------------------------------------- enroll */
    if (body.action === "enroll") {
      if (existing?.enabled) {
        return fail("২FA আগেই সক্রিয় — বন্ধ করতে চাইলে কোড দিয়ে disable করুন", 409);
      }

      const secret = generateTotpSecret();
      const account = g.profile.full_name ?? g.session.email ?? "admin";
      const uri = totpUri({ secret, accountName: account, issuer: "Biswas Agro" });

      // Render the QR server-side (no extra client dependency).
      const qrSvg = await QRCode.toString(uri, {
        type: "svg",
        margin: 1,
        width: 220,
        color: { dark: "#0b0d0c", light: "#ffffff" },
      });

      // Store as pending (enabled=false) until the first code verifies.
      await db().from("admin_mfa").upsert(
        { user_id: g.session.id, secret, enabled: false },
        { onConflict: "user_id" }
      );

      return ok({ secret, uri, qrSvg, account });
    }

    /* ------------------------------------------------------------- verify */
    if (body.action === "verify") {
      if (!existing) return fail("প্রথমে ২FA সেটআপ শুরু করুন", 409);
      if (!verifyTotp(existing.secret, body.code)) {
        return fail("কোডটি সঠিক নয় — অ্যাপে দেখানো নতুন কোড দিন", 400, { code: "ভুল কোড" });
      }

      const codes = generateRecoveryCodes(8);
      const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));

      await db()
        .from("admin_mfa")
        .update({ enabled: true, enabled_at: new Date().toISOString(), recovery_hashes: hashes })
        .eq("user_id", g.session.id);

      await db()
        .from("profiles")
        .update({ mfa_enrolled: true })
        .eq("id", g.profile.id)
        .then(
          () => undefined,
          () => undefined
        );

      await db()
        .from("audit_logs")
        .insert({
          actor_id: g.session.id,
          action: "admin.mfa_enrolled",
          entity: "admin_mfa",
          entity_id: g.session.id,
          meta: {},
        })
        .then(
          () => undefined,
          () => undefined
        );

      // Shown ONCE — we only keep bcrypt hashes.
      return ok({ enrolled: true, recoveryCodes: codes });
    }

    /* ------------------------------------------------------------ disable */
    if (body.action === "disable") {
      if (!existing) return fail("২FA সেটআপ করা নেই", 409);

      if (await enforced()) {
        return fail("নীতিমালা অনুযায়ী ২FA বাধ্যতামূলক — বন্ধ করা যাবে না", 409);
      }

      if (!verifyTotp(existing.secret, body.code)) {
        return fail("কোডটি সঠিক নয়", 400, { code: "ভুল কোড" });
      }

      await db().from("admin_mfa").delete().eq("user_id", g.session.id);
      await db()
        .from("profiles")
        .update({ mfa_enrolled: false })
        .eq("id", g.profile.id)
        .then(
          () => undefined,
          () => undefined
        );

      return ok({ enrolled: false });
    }

    /* ----------------------------------------------------------- recovery */
    if (!existing?.enabled) return fail("২FA সক্রিয় নেই", 409);

    const hashes = existing.recovery_hashes ?? [];
    let matchedIndex = -1;
    for (let i = 0; i < hashes.length; i += 1) {
      if (await bcrypt.compare(body.code.toUpperCase(), hashes[i])) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) return fail("রিকভারি কোডটি সঠিক নয়", 400);

    // single-use: remove the consumed code
    const remaining = hashes.filter((_, i) => i !== matchedIndex);
    await db().from("admin_mfa").update({ recovery_hashes: remaining }).eq("user_id", g.session.id);

    return ok({ consumed: true, remaining: remaining.length });
  } catch (error) {
    return handleError(error);
  }
}
