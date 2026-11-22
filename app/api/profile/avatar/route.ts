import { NextResponse } from "next/server";
import { clientKey, currentUser, fail, handleError, ok, rateLimit, tooMany } from "@/lib/api";
import { getProfileByLegacyId, updateProfile } from "@/lib/profile";
import { supabaseService } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches the avatars bucket limit
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/profile/avatar
 * ---------------------------------------------------------------------------
 * Accepts multipart form-data `file`, uploads to the public `avatars` bucket
 * under `<auth_uid>/avatar.<ext>`, and writes the public URL to profiles.
 *
 * The upload runs with the service role, so the storage RLS policies remain
 * strict for direct browser access while this route enforces its own checks
 * (session required, mime type, size).
 */
export async function POST(req: Request) {
  try {
    const limited = rateLimit(clientKey(req, "avatar-upload"), 8, 10 * 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);

    const profile = await getProfileByLegacyId(session.id);
    if (!profile) return fail("প্রোফাইল পাওয়া যায়নি", 404);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) return fail("ছবি নির্বাচন করুন", 400);
    if (!ALLOWED.has(file.type)) {
      return fail("শুধু JPG, PNG বা WebP ছবি আপলোড করুন", 415);
    }
    if (file.size > MAX_BYTES) {
      return fail("ছবিটি ২ MB-এর বেশি — ছোট ছবি দিন", 413);
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${profile.id}/avatar.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const storage = supabaseService().storage.from("avatars");

    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

    if (uploadError) return fail(`আপলোড ব্যর্থ: ${uploadError.message}`, 500);

    const { data: pub } = storage.getPublicUrl(path);

    // cache-bust so the header avatar updates immediately
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    const updated = await updateProfile(profile.id, { avatar_url: url });

    return ok({ url, profile: updated });
  } catch (error) {
    return handleError(error);
  }
}

/** DELETE /api/profile/avatar — remove the photo. */
export async function DELETE() {
  try {
    const session = await currentUser();
    if (!session) return fail("আগে লগইন করুন", 401);

    const profile = await getProfileByLegacyId(session.id);
    if (!profile) return fail("প্রোফাইল পাওয়া যায়নি", 404);

    const storage = supabaseService().storage.from("avatars");
    const { data: files } = await storage.list(profile.id);

    if (files?.length) {
      await storage.remove(files.map((f) => `${profile.id}/${f.name}`)).catch(() => null);
    }

    await updateProfile(profile.id, { avatar_url: null });
    return NextResponse.json({ ok: true, data: { removed: true } });
  } catch (error) {
    return handleError(error);
  }
}
