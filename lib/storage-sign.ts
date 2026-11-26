import { supabaseAdmin } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/storage-buckets";

/* ==========================================================================
   Signed URLs for private storage objects
   --------------------------------------------------------------------------
   `complaint-photos` used to be a public bucket, so a complaint photo was a
   permanent link that anyone could open: forwarding it, or leaking it through
   a referrer or a screenshot, could never be undone. Migration 29 makes the
   bucket private; nothing is readable without a signature.

   Two rules the callers in this repo follow:

     1. The DATABASE stores the storage path (e.g. `<user-id>/1724-ab12.jpg`),
        never a URL. A stored URL is permanent by construction — a signed URL
        baked into a row would expire and leave a broken image, and a public
        URL baked in would never stop working.

     2. The signed URL is created at READ time, for the shortest useful window,
        and only after the caller has been authorised to see the row.

   Server-only: this module imports the service client.
   ========================================================================== */

/** Five minutes — enough to load a thumbnail and a full view, too short to share. */
export const COMPLAINT_PHOTO_TTL_SECONDS = 60 * 5;

type StoredPhoto = string;

/**
 * Is this stored value a storage path (as opposed to an absolute URL)?
 *
 * Older complaint rows hold full public URLs written before migration 29.
 * Those must keep rendering — the migration is data-preserving, so it cannot
 * rewrite them into paths it has no way to verify. Anything that is not an
 * absolute URL is treated as a path in the private bucket.
 */
export function isStoragePath(value: StoredPhoto): boolean {
  return Boolean(value) && !/^https?:\/\//i.test(value);
}

/**
 * Turn one stored photo reference into something a browser can render.
 *
 * Returns `null` when a private object cannot be signed — the caller shows a
 * placeholder rather than a broken image or, worse, a public URL that slipped
 * through.
 */
export async function signComplaintPhoto(
  stored: StoredPhoto,
  ttlSeconds: number = COMPLAINT_PHOTO_TTL_SECONDS
): Promise<string | null> {
  if (!stored) return null;

  /* A legacy public URL: it is already public and already in the owner's data,
     so returning it unchanged is the honest thing to do. It is not re-signed
     because it does not belong to the private bucket. */
  if (!isStoragePath(stored)) return stored;

  const { data, error } = await supabaseAdmin()
    .storage.from(STORAGE_BUCKETS.COMPLAINT_PHOTOS)
    .createSignedUrl(stored, ttlSeconds);

  if (error || !data?.signedUrl) {
    console.warn("[storage-sign] could not sign complaint photo:", error?.message);
    return null;
  }

  return data.signedUrl;
}

/** Sign a whole array, preserving order. `null` entries mean "unavailable". */
export async function signComplaintPhotos(
  stored: readonly StoredPhoto[] | null | undefined,
  ttlSeconds: number = COMPLAINT_PHOTO_TTL_SECONDS
): Promise<(string | null)[]> {
  if (!stored?.length) return [];
  return Promise.all(stored.map((item) => signComplaintPhoto(item, ttlSeconds)));
}
