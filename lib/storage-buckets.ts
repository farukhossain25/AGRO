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
  PAYMENT_PROOFS: "payment-proofs",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

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
  STORAGE_BUCKETS.COMPLAINT_PHOTOS,
  STORAGE_BUCKETS.BLOG_IMAGES,
];

export const ALL_BUCKETS: readonly StorageBucket[] = [
  ...PUBLIC_BUCKETS,
  STORAGE_BUCKETS.PAYMENT_PROOFS,
];
