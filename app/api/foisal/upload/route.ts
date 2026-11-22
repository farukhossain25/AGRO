import { db } from "@/lib/db";
import { fail, handleError, ok, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const BUCKET = "product-images";

/**
 * Uploads an image to Supabase Storage and returns its public URL.
 * Create the bucket once (public) in Supabase → Storage, or run:
 *   insert into storage.buckets (id, name, public) values ('product-images','product-images',true);
 */
export async function POST(req: Request) {
  try {
    await requirePermission("media.write");

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) return fail("ফাইল পাওয়া যায়নি", 422);
    if (!ALLOWED.includes(file.type)) return fail("শুধু PNG/JPEG/WEBP ছবি আপলোড করুন", 415);
    if (file.size > MAX_BYTES) return fail("ছবির আকার ৪MB এর কম হতে হবে", 413);

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const client = db();

    const { error } = await client.storage.from(BUCKET).upload(name, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return fail(
        `Storage আপলোড ব্যর্থ: ${error.message}. Supabase-এ "${BUCKET}" নামের পাবলিক বাকেট তৈরি করুন।`,
        502
      );
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(name);
    return ok({ url: data.publicUrl, name });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return fail("অনুমতি নেই", 401);
    if (status === 403) return fail("এই কাজের অনুমতি আপনার নেই", 403);
    return handleError(error);
  }
}
