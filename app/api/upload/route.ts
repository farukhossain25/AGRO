import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/* ==========================================================================
   POST /api/upload — customer-facing image upload
   --------------------------------------------------------------------------
   Used by the review screen, the complaint form and — for approved sellers —
   the product photo gallery and the store logo / banner on the seller
   dashboard. Callers may only write to the buckets listed below (the seller
   set is additionally gated on the caller's seller status); the path is
   namespaced by user id so one account can never overwrite another's photo.

   Safety:
     • session required (no anonymous uploads)
     • MIME allow-list + size cap checked here AND by the bucket itself
     • magic-byte sniffing so a renamed .exe cannot pose as a .jpg
     • random filename, fixed extension derived from the sniffed type
   ========================================================================== */

const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Buckets a signed-in customer may write to. */
const BUCKETS = new Set(["review-photos", "complaint-photos"]);

/** Buckets only an APPROVED seller may write to (their own store / products). */
const SELLER_BUCKETS = new Set(["product-images", "logos", "farm-images"]);

/**
 * Buckets whose objects are NOT publicly readable (29_security_hardening.sql §7).
 *
 * These carry personal material — a damaged item, sometimes a receipt, an
 * address on a box. They used to be public buckets, so every upload handed the
 * customer a permanent, unauthenticated URL: forwarding it or having it leak
 * through a referrer was an irreversible disclosure, because nothing about a
 * public object can be revoked short of deleting it.
 *
 * For these buckets the route returns the storage PATH (which is what belongs
 * in the database) plus a short-lived signed URL so the uploader can show a
 * preview. Every later view goes through a fresh signature — see
 * app/api/complaints/route.ts.
 */
const PRIVATE_BUCKETS = new Set(["complaint-photos"]);

/** 5 minutes: long enough to render a thumbnail, too short to pass around. */
const SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * May this user write product/logo/farm images?
 *
 * `sellers.status` is the only gate that exists on this table — there is no
 * separate is_active column (checked against 03_catalog_tables.sql), and the
 * panel's "suspend" action moves status away from 'approved'. Adding a column
 * check here would have been inventing a field. Fails closed on a DB error, so
 * a lookup problem refuses the upload rather than permitting it.
 */
async function isApprovedSeller(userId: string): Promise<boolean> {
  try {
    const { data } = await db()
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/** Sniff the real image type from the first bytes of the file. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // AVIF: .... "ftyp" "avif"
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    bytes[11] === 0x66
  ) {
    return "image/avif";
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "upload"), 20, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const user = await currentUser();
    if (!user) return fail("ছবি আপলোড করতে আগে লগইন করুন", 401);

    const form = await req.formData().catch(() => null);
    if (!form) return fail("ফর্ম ডেটা পাওয়া যায়নি", 400);

    const file = form.get("file");
    const bucket = String(form.get("bucket") ?? "review-photos");

    if (!(file instanceof File)) return fail("ছবি নির্বাচন করুন", 400);
    if (!BUCKETS.has(bucket)) {
      // Seller store / product photos: only for an approved seller account.
      if (!SELLER_BUCKETS.has(bucket)) return fail("এই বাকেটে আপলোড অনুমোদিত নয়", 403);
      if (!(await isApprovedSeller(user.id))) {
        return fail("শুধু অনুমোদিত সেলার পণ্যের ছবি বা স্টোরের লোগো/ব্যানার আপলোড করতে পারেন", 403);
      }
    }

    if (!ALLOWED[file.type]) return fail("শুধু JPG, PNG, WebP বা AVIF ছবি দিন", 415);
    if (file.size > MAX_BYTES) return fail("ছবিটি ৪ MB-এর বেশি — ছোট ছবি দিন", 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const real = sniff(bytes);

    if (!real || real !== file.type) {
      return fail("ফাইলটি বৈধ ছবি নয়", 415);
    }

    const ext = ALLOWED[real];
    const name = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storage = supabaseAdmin().storage.from(bucket);

    const { error } = await storage.upload(name, bytes, {
      contentType: real,
      upsert: false,
      cacheControl: "31536000",
    });

    if (error) {
      return fail(`আপলোড ব্যর্থ: ${error.message}`, 502);
    }

    /* The `path` field is the stable identifier and the only thing callers may
       store. `url` is a convenience for the screen that just did the upload. */
    if (PRIVATE_BUCKETS.has(bucket)) {
      const { data: signed, error: signError } = await storage.createSignedUrl(
        name,
        SIGNED_URL_TTL_SECONDS
      );

      if (signError || !signed?.signedUrl) {
        /* The bytes are already stored, so do not pretend nothing happened —
           return the path and no preview URL. The caller can still save the
           path and every later read will sign on demand. */
        console.warn("[upload] signed URL failed:", signError?.message);
        return ok({ url: null, path: name, signed: false });
      }

      return ok({
        url: signed.signedUrl,
        path: name,
        signed: true,
        expiresIn: SIGNED_URL_TTL_SECONDS,
      });
    }

    const { data } = storage.getPublicUrl(name);
    return ok({ url: data.publicUrl, path: name, signed: false });
  } catch (error) {
    return handleError(error);
  }
}
