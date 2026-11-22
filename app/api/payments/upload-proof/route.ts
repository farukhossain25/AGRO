import { db } from "@/lib/db";
import { fail, handleError, limitGuard, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/* ==========================================================================
   POST /api/payments/upload-proof
   --------------------------------------------------------------------------
   Stores a payment screenshot in the PRIVATE `payment-proofs` bucket and
   returns the storage PATH — never a public URL, because the object is not
   publicly readable.

   Three defences, in order of importance:
     1. the path is namespaced by the caller's own uuid, and a storage policy
        repeats that check (`(storage.foldername(name))[1] = auth.uid()`), so
        even a leaked path cannot be written by someone else;
     2. the bytes are sniffed — a renamed .exe is rejected;
     3. size and MIME are capped before a single byte reaches storage.

   The admin screen mints a short-lived signed URL to display the image.
   ========================================================================== */

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "payment-proofs";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  if (riff && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const limited = limitGuard(req, "payment-proof", 10, 60_000);
    if (limited) return limited;

    const user = await requireUser();

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) return fail("স্ক্রিনশট পাওয়া যায়নি", 400);
    if (!EXT[file.type]) return fail("শুধু JPG, PNG বা WebP ছবি চলবে", 415);
    if (file.size > MAX_BYTES) return fail("ছবিটি ৫ MB-এর বেশি — ছোট করে নিন", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniff(new Uint8Array(buffer));
    if (!sniffed) return fail("ফাইলটি আসলে ছবি নয়", 415);

    const ext = EXT[sniffed];
    const name = `${user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const client = supabaseAdmin();
    const { error } = await client.storage.from(BUCKET).upload(name, buffer, {
      contentType: sniffed,
      upsert: false,
    });

    if (error) {
      return fail(`স্ক্রিনশট সংরক্ষণ ব্যর্থ: ${error.message}`, 502);
    }

    return ok({ path: name, bucket: BUCKET });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return fail("স্ক্রিনশট আপলোড করতে লগইন করুন", 401);
    return handleError(error);
  }
}

/* ==========================================================================
   GET /api/payments/upload-proof?path=<storage path>
   --------------------------------------------------------------------------
   Returns a 60-second signed URL for one screenshot. The caller must own it
   (the path starts with their uuid) or be staff. This is what keeps the
   screenshots out of any public URL, cache or CDN.
   ========================================================================== */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const path = new URL(req.url).searchParams.get("path")?.trim();

    if (!path) return fail("পথ দিন", 400);

    // A path like `../../other/secret.jpg` must never reach storage.
    if (path.includes("..") || path.startsWith("/")) return fail("অবৈধ পথ", 400);

    const ownerPrefix = path.split("/")[0];
    const isOwner = ownerPrefix === user.id;
    const isStaff = ["staff", "manager", "admin"].includes(user.role);

    if (!isOwner && !isStaff) return fail("এই ফাইলের অনুমতি নেই", 403);

    // Cross-check the database too: staff may only see paths that a payment
    // actually references, so a guessed path is not enough.
    const { data: referenced } = await db()
      .from("payments")
      .select("id")
      .eq("screenshot_url", path)
      .limit(1);

    if (!isOwner && !referenced?.length) {
      return fail("এই ফাইল কোনো পেমেন্টের সাথে যুক্ত নয়", 403);
    }

    const { data, error } = await supabaseAdmin()
      .storage.from(BUCKET)
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      return fail("ছবির লিংক তৈরি করা যায়নি", 502);
    }

    return ok({ url: data.signedUrl, expiresIn: 60 });
  } catch (error) {
    return handleError(error);
  }
}
