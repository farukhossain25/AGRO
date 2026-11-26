/**
 * Single source of truth for all Supabase Storage bucket names.
 * Must match `supabase/sql/14_storage_fix.sql` (and `09_storage_buckets_and_policies.sql`).
 */
export const STORAGE_BUCKETS = {
  AVATARS: "avatars",
  PRODUCT_IMAGES: "product-images",
  CATEGORY_IMAGES: "category-images",
  FARM_IMAGES: "farm-images",
  LOGOS: "logos",
  PAYMENT_LOGOS: "payment-logos",
  SLIDES: "slides",
  TEAM: "team",
  REVIEW_PHOTOS: "review-photos",
  COMPLAINT_PHOTOS: "complaint-photos",
  BLOG_IMAGES: "blog-images",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Buckets whose objects are readable by anyone with the URL.
 *
 * `complaint-photos` is deliberately NOT here: migration 29 makes it private
 * and grants read to the complaint's owner or a staff member only. Reading one
 * goes through a short-lived signed URL (lib/storage-sign.ts), and the database
 * stores the storage PATH, never a URL.
 */
export const PUBLIC_BUCKETS: readonly StorageBucket[] = [
  STORAGE_BUCKETS.AVATARS,
  STORAGE_BUCKETS.PRODUCT_IMAGES,
  STORAGE_BUCKETS.CATEGORY_IMAGES,
  STORAGE_BUCKETS.FARM_IMAGES,
  STORAGE_BUCKETS.LOGOS,
  STORAGE_BUCKETS.PAYMENT_LOGOS,
  STORAGE_BUCKETS.SLIDES,
  STORAGE_BUCKETS.TEAM,
  STORAGE_BUCKETS.REVIEW_PHOTOS,
  STORAGE_BUCKETS.BLOG_IMAGES,
];

/** Buckets that need a signed URL to read. */
export const PRIVATE_BUCKETS: readonly StorageBucket[] = [STORAGE_BUCKETS.COMPLAINT_PHOTOS];

export const ALL_BUCKETS: readonly StorageBucket[] = [...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS];
