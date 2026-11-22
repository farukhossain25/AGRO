import { db } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";
import { clientIp } from "@/lib/auth-attempts";
import { recordAudit } from "@/lib/audit";
import { supabaseService } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/* ==========================================================================
   POST /api/admin/media — upload an image into the media library (section E)
   --------------------------------------------------------------------------
   Same defences as the customer upload route (MIME allow-list, size cap,
   magic-byte sniffing, random filename), plus:

     • requires media.write — staff and above
     • bucket allow-list is the ADMIN set (product-images, farm-media, …), so a
       staff account cannot drop files into review-photos
     • writes a media_assets row and an audit entry, so the library stays honest
   ========================================================================== */

const MAX_BYTES = 6 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const ADMIN_BUCKETS = new Set([
  "product-images",
  "farm-media",
  "farm-images",
  "avatars",
  "cms-media",
]);

/** Magic-byte sniff — a renamed executable cannot pass as a JPEG. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const RIFF = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  if (RIFF && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  // AVIF: ....ftypavif
  const ftyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  if (ftyp && bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66) {
    return "image/avif";
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission("media.write");

    const form = await req.formData();
    const file = form.get("file");
    const bucket = String(form.get("bucket") ?? "product-images");
    const alt = String(form.get("alt") ?? "").slice(0, 200);

    if (!(file instanceof File)) return fail("ছবি পাওয়া যায়নি", 400);
    if (!ADMIN_BUCKETS.has(bucket)) return fail("এই বাকেটে আপলোড অনুমোদিত নয়", 400);
    if (file.size > MAX_BYTES) return fail("ছবিটি ৬ MB-এর বেশি — ছোট করে নিন", 413);

    const declared = EXT[file.type];
    if (!declared) return fail("শুধু JPG, PNG, WebP বা AVIF ছবি চলবে", 415);

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniff(buffer);
    if (!sniffed || !EXT[sniffed]) return fail("ফাইলটি আসলে ছবি নয়", 415);

    const ext = EXT[sniffed];
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `library/${new Date().toISOString().slice(0, 7)}/${name}`;

    const storage = supabaseService().storage.from(bucket);
    const { error: uploadError } = await storage.upload(path, buffer, {
      contentType: sniffed,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) return fail(`আপলোড ব্যর্থ: ${uploadError.message}`, 502);

    const { data: pub } = storage.getPublicUrl(path);
    const url = pub.publicUrl;

    await db()
      .from("media_assets")
      .upsert(
        {
          bucket,
          path,
          url,
          mime: sniffed,
          bytes: buffer.byteLength,
          alt_bn: alt || null,
          uploaded_by: user.id,
        },
        { onConflict: "bucket,path" }
      );

    await recordAudit({
      actor: user,
      action: "create",
      entity: "media_assets",
      entityId: path,
      diff: { bucket, path, alt },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return ok({ url, path, bucket });
  } catch (error) {
    return handleError(error);
  }
}
