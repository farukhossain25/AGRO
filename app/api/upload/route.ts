import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { supabaseService } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/* ==========================================================================
   POST /api/upload — customer-facing image upload
   --------------------------------------------------------------------------
   Used by the review screen and the complaint form. Callers may only write to
   the two buckets listed below; the path is namespaced by user id so one
   customer can never overwrite another's photo.

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
};

/** Buckets a normal customer may write to, with their per-user folder prefix. */
const BUCKETS = new Set(["review-photos", "complaint-photos"]);

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
    if (!BUCKETS.has(bucket)) return fail("এই বাকেটে আপলোড অনুমোদিত নয়", 403);

    if (!ALLOWED[file.type]) return fail("শুধু JPG, PNG বা WebP ছবি দিন", 415);
    if (file.size > MAX_BYTES) return fail("ছবিটি ৪ MB-এর বেশি — ছোট ছবি দিন", 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const real = sniff(bytes);

    if (!real || real !== file.type) {
      return fail("ফাইলটি বৈধ ছবি নয়", 415);
    }

    const ext = ALLOWED[real];
    const name = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storage = supabaseService().storage.from(bucket);

    const { error } = await storage.upload(name, bytes, {
      contentType: real,
      upsert: false,
      cacheControl: "31536000",
    });

    if (error) {
      return fail(
        `আপলোড ব্যর্থ: ${error.message}. Supabase-এ "${bucket}" নামের পাবলিক বাকেট তৈরি করুন।`,
        502
      );
    }

    const { data } = storage.getPublicUrl(name);
    return ok({ url: data.publicUrl, path: name });
  } catch (error) {
    return handleError(error);
  }
}
