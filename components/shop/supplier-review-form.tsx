"use client";

import { useEffect, useMemo, useState } from "react";
import { StarRating, Spinner } from "@/components/ui";
import type { ReviewTag } from "@/lib/types";

/* ==========================================================================
   SupplierReviewForm — the review screen for ONE sub-order / supplier
   --------------------------------------------------------------------------
   A combo order splits into per-seller sub-orders, so this form is rendered
   once per supplier block. Every product gets its own star row, text, tags and
   up to 3 photos; the supplier gets a separate star rating.

   RULES (mirrored server-side in /api/reviews/order):
     • one review per (order, product) — resubmitting edits it
     • editable only for 7 days
     • max 3 photos per review
   ========================================================================== */

export type ReviewItemSeed = {
  productId: string;
  productNameBn: string;
  productImage: string | null;
  quantity: number;
  existingReview: {
    id: string;
    rating: number;
    seller_rating: number | null;
    comment: string | null;
    photos: string[] | null;
    tags: string[] | null;
  } | null;
  canEdit: boolean;
};

type Draft = {
  rating: number;
  sellerRating: number;
  comment: string;
  tags: string[];
  photos: string[];
  open: boolean;
  existingId: string | null;
};

const FALLBACK_TAGS: ReviewTag[] = [
  { slug: "fresh", label_bn: "তাজা", label_en: "Fresh", sentiment: "positive", sort_order: 1 },
  { slug: "packaging", label_bn: "ভালো প্যাকেজিং", label_en: "Good packaging", sentiment: "positive", sort_order: 2 },
  { slug: "right_weight", label_bn: "সঠিক ওজন", label_en: "Correct weight", sentiment: "positive", sort_order: 3 },
  { slug: "on_time", label_bn: "সময়মতো ডেলিভারি", label_en: "On-time delivery", sentiment: "positive", sort_order: 4 },
  { slug: "stale", label_bn: "বাসি", label_en: "Stale", sentiment: "negative", sort_order: 5 },
  { slug: "under_weight", label_bn: "কম ওজন", label_en: "Under weight", sentiment: "negative", sort_order: 6 },
  { slug: "bad_packaging", label_bn: "খারাপ প্যাকেজিং", label_en: "Bad packaging", sentiment: "negative", sort_order: 7 },
  { slug: "late", label_bn: "দেরি", label_en: "Late", sentiment: "negative", sort_order: 8 },
];

export function SupplierReviewForm({
  orderId,
  sellerNameBn,
  items,
  tags = FALLBACK_TAGS,
  uploadEnabled = true,
}: {
  orderId: string;
  sellerNameBn: string;
  items: ReviewItemSeed[];
  tags?: ReviewTag[];
  uploadEnabled?: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const item of items) {
      init[item.productId] = {
        rating: item.existingReview?.rating ?? 0,
        sellerRating: item.existingReview?.seller_rating ?? 0,
        comment: item.existingReview?.comment ?? "",
        tags: item.existingReview?.tags ?? [],
        photos: item.existingReview?.photos ?? [],
        open: !item.existingReview,
        existingId: item.existingReview?.id ?? null,
      };
    }
    return init;
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const positive = useMemo(() => tags.filter((t) => t.sentiment === "positive"), [tags]);
  const negative = useMemo(() => tags.filter((t) => t.sentiment === "negative"), [tags]);

  function patch(productId: string, next: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [productId]: { ...prev[productId], ...next } }));
  }

  function toggleTag(productId: string, slug: string) {
    const current = drafts[productId]?.tags ?? [];
    const next = current.includes(slug)
      ? current.filter((t) => t !== slug)
      : [...current, slug].slice(0, 6);
    patch(productId, { tags: next });
  }

  async function uploadPhoto(productId: string, file: File) {
    const draft = drafts[productId];
    if (!draft || draft.photos.length >= 3) return;

    if (!file.type.startsWith("image/")) {
      setError("শুধু ছবি আপলোড করা যায়");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("ছবির আকার ৪ মেগাবাইটের কম হতে হবে");
      return;
    }

    setBusy(`photo-${productId}`);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("bucket", "review-photos");
      body.append("folder", "reviews");

      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { ok?: boolean; url?: string; message?: string };

      if (!res.ok || !json.url) throw new Error(json.message ?? "আপলোড ব্যর্থ হয়েছে");
      patch(productId, { photos: [...drafts[productId].photos, json.url].slice(0, 3) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submit(productId: string) {
    const draft = drafts[productId];
    if (!draft) return;

    if (draft.rating < 1) {
      setError("পণ্যের রেটিং দিন (১–৫ তারা)");
      return;
    }

    setBusy(productId);
    setError(null);
    try {
      const res = await fetch("/api/reviews/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          productId,
          rating: draft.rating,
          sellerRating: draft.sellerRating || undefined,
          comment: draft.comment.trim() || undefined,
          tags: draft.tags,
          photos: draft.photos,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; message?: string; review?: { id: string } };

      if (!res.ok) throw new Error(json.message ?? "রিভিউ সংরক্ষণ করা যায়নি");

      setDone((prev) => ({ ...prev, [productId]: true }));
      patch(productId, { open: false, existingId: json.review?.id ?? draft.existingId });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-sand-100/40">সেলার</p>
          <h3 className="text-[15px] font-bold text-sand-50">{sellerNameBn}</h3>
        </div>
        <span className="badge bg-leaf-600/15 text-leaf-200">ভেরিফাইড ক্রয়</span>
      </header>

      <ul className="divide-y divide-white/10">
        {items.map((item) => {
          const draft = drafts[item.productId];
          if (!draft) return null;

          return (
            <li key={item.productId} className="px-4 py-4">
              <div className="flex items-start gap-3">
                {item.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.productImage}
                    alt={item.productNameBn}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-lg">
                    🥬
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-sand-50">
                    {item.productNameBn}{" "}
                    <span className="font-normal text-sand-100/40">×{item.quantity}</span>
                  </p>

                  {done[item.productId] || (item.existingReview && !draft.open) ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StarRating value={draft.rating} size={14} />
                      <span className="text-[11.5px] text-leaf-200">রিভিউ সংরক্ষিত</span>
                      {item.canEdit ? (
                        <button
                          type="button"
                          onClick={() => patch(item.productId, { open: true })}
                          className="text-[11.5px] text-sand-100/50 underline hover:text-leaf-200"
                        >
                          সম্পাদনা
                        </button>
                      ) : (
                        <span className="text-[11px] text-sand-100/35">(সম্পাদনার সময় শেষ)</span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => patch(item.productId, { open: true })}
                      className="btn-ghost btn-sm mt-2"
                    >
                      রিভিউ দিন
                    </button>
                  )}
                </div>
              </div>

              {draft.open ? (
                <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  {/* product stars */}
                  <div>
                    <p className="mb-1 text-[11.5px] text-sand-100/55">পণ্যের মান</p>
                    <StarRating
                      value={draft.rating}
                      size={26}
                      onChange={(v) => patch(item.productId, { rating: v })}
                    />
                  </div>

                  {/* supplier stars */}
                  <div>
                    <p className="mb-1 text-[11.5px] text-sand-100/55">সেলার / ডেলিভারি অভিজ্ঞতা</p>
                    <StarRating
                      value={draft.sellerRating}
                      size={26}
                      onChange={(v) => patch(item.productId, { sellerRating: v })}
                    />
                  </div>

                  {/* tags */}
                  <div>
                    <p className="mb-1.5 text-[11.5px] text-sand-100/55">দ্রুত মতামত</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...positive, ...negative].map((tag) => {
                        const active = draft.tags.includes(tag.slug);
                        const isNeg = tag.sentiment === "negative";
                        return (
                          <button
                            key={tag.slug}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleTag(item.productId, tag.slug)}
                            className={`badge h-8 px-2.5 text-[11.5px] transition ${
                              active
                                ? isNeg
                                  ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/40"
                                  : "bg-leaf-600/25 text-leaf-100 ring-1 ring-leaf-400/40"
                                : "bg-white/[0.05] text-sand-100/55 hover:bg-white/[0.09]"
                            }`}
                          >
                            {tag.label_bn}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* comment */}
                  <textarea
                    value={draft.comment}
                    onChange={(e) => patch(item.productId, { comment: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    placeholder="পণ্যটি কেমন ছিল? (ঐচ্ছিক)"
                    className="input text-[16px] sm:text-[13.5px]"
                  />

                  {/* photos */}
                  {uploadEnabled ? (
                    <div>
                      <p className="mb-1.5 text-[11.5px] text-sand-100/55">
                        ছবি ({draft.photos.length}/৩)
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {draft.photos.map((src) => (
                          <span key={src} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt="রিভিউ ছবি"
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                            <button
                              type="button"
                              aria-label="ছবি সরান"
                              onClick={() =>
                                patch(item.productId, {
                                  photos: draft.photos.filter((p) => p !== src),
                                })
                              }
                              className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-[12px] text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {draft.photos.length < 3 ? (
                          <label className="grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-white/25 text-[18px] text-sand-100/50 hover:border-leaf-400/60 hover:text-leaf-200">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadPhoto(item.productId, file);
                                e.target.value = "";
                              }}
                            />
                            {busy === `photo-${item.productId}` ? <Spinner /> : "+"}
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void submit(item.productId)}
                      disabled={busy === item.productId}
                      className="btn-primary btn-sm min-h-[44px]"
                    >
                      {busy === item.productId ? <Spinner /> : null}
                      {draft.existingId ? "আপডেট করুন" : "রিভিউ জমা দিন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(item.productId, { open: false })}
                      className="btn-ghost btn-sm min-h-[44px]"
                    >
                      বাতিল
                    </button>
                  </div>

                  <p className="text-[10.5px] text-sand-100/35">
                    ৭ দিনের মধ্যে সম্পাদনা করা যাবে · এক অর্ডারে প্রতি পণ্যে একটি রিভিউ
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="border-t border-red-400/20 bg-red-500/10 px-4 py-2.5 text-[12px] text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** Small helper so the order card can auto-scroll to the form. */
export function useReviewHash() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#reviews") {
      document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
}
