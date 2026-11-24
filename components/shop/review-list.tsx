import Link from "next/link";
import { StarRating } from "@/components/ui";
import { formatDateBn } from "@/lib/format";
import { getProductReviews, getRatingBreakdown } from "@/lib/reviews";
import type { RatingBreakdown, ReviewSort, ReviewWithProfile } from "@/lib/types";

/* ==========================================================================
   ReviewList — verified-purchase reviews with a rating breakdown bar chart
   --------------------------------------------------------------------------
   Server component. Sorting is a query param (?rsort=newest|highest|lowest) so
   it works without client JS and stays crawlable. The legacy public
   testimonials are shown underneath as a separate block — they are a different
   table (reviews vs order_reviews) and must not be mixed into these numbers.
   ========================================================================== */

const SORTS: { key: ReviewSort; bn: string }[] = [
  { key: "newest", bn: "নতুন আগে" },
  { key: "highest", bn: "সর্বোচ্চ রেটিং" },
  { key: "lowest", bn: "সর্বনিম্ন রেটিং" },
];

function Breakdown({ data }: { data: RatingBreakdown }) {
  const rows: { star: number; count: number }[] = [
    { star: 5, count: data.r5 },
    { star: 4, count: data.r4 },
    { star: 3, count: data.r3 },
    { star: 2, count: data.r2 },
    { star: 1, count: data.r1 },
  ];

  return (
    <div className="card p-4">
      <div className="flex items-end gap-3">
        <p className="text-[34px] font-extrabold leading-none text-sand-50">
          {data.avg_rating.toFixed(1)}
        </p>
        <div className="pb-1">
          <StarRating value={Math.round(data.avg_rating)} size={14} />
          <p className="mt-0.5 text-[11px] text-sand-100/45">{data.total}টি রিভিউ</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => {
          const pct = data.total ? Math.round((row.count / data.total) * 100) : 0;
          return (
            <li key={row.star} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] text-sand-100/50">{row.star}★</span>
              <span
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]"
                role="img"
                aria-label={`${row.star} তারা: ${row.count}টি রিভিউ (${pct}%)`}
              >
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums text-sand-100/40">
                {row.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewWithProfile }) {
  const name = review.reviewer?.full_name?.trim() || "গ্রাহক";
  const photo = review.reviewer?.avatar_url;

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf-600/20 text-[12px] font-bold text-leaf-700">
              {name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-sand-50">{name}</p>
            <p className="text-[10.5px] text-sand-100/40">{formatDateBn(review.created_at)}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <StarRating value={review.rating} size={13} />
          {review.is_verified_purchase ? (
            <span className="badge bg-leaf-600/15 text-[10px] text-leaf-700">
              ✓ ভেরিফাইড ক্রয়
            </span>
          ) : null}
        </div>
      </div>

      {review.title_bn ? (
        <p className="mt-2.5 text-[13px] font-semibold text-sand-50">{review.title_bn}</p>
      ) : null}

      {review.comment ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-6 text-sand-100/70">
          {review.comment}
        </p>
      ) : null}

      {review.tags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <span key={tag} className="badge bg-white/[0.05] text-[10px] text-sand-100/55">
              {TAG_BN[tag] ?? tag}
            </span>
          ))}
        </div>
      ) : null}

      {review.photos?.length ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {review.photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt="ক্রেতার তোলা ছবি"
              width={72}
              height={72}
              loading="lazy"
              className="rounded-lg object-cover"
              style={{ height: 72, width: 72 }}
            />
          ))}
        </div>
      ) : null}

      {review.seller_rating ? (
        <p className="mt-2 text-[10.5px] text-sand-100/40">
          সেলার রেটিং: {review.seller_rating}/৫
          {review.sellers?.name_bn ? ` · ${review.sellers.name_bn}` : ""}
        </p>
      ) : null}

      {review.seller_reply ? (
        <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-leaf-200/80">
            {review.sellers?.name_bn ?? "সেলার"}-এর উত্তর
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-sand-100/60">
            {review.seller_reply}
          </p>
        </div>
      ) : null}

    </article>
  );
}

const TAG_BN: Record<string, string> = {
  fresh: "তাজা",
  packaging: "ভালো প্যাকেজিং",
  right_weight: "সঠিক ওজন",
  on_time: "সময়মতো ডেলিভারি",
  stale: "বাসি",
  under_weight: "কম ওজন",
  bad_packaging: "খারাপ প্যাকেজিং",
  late: "দেরি",
};

export async function ReviewList({
  productId,
  sort = "newest",
  limit = 8,
  href,
}: {
  productId: string;
  sort?: ReviewSort;
  limit?: number;
  /** base path for the sort links, e.g. /products/kacha-tomato */
  href: string;
}) {
  const [reviews, breakdown] = await Promise.all([
    getProductReviews(productId, { sort, limit }),
    getRatingBreakdown(productId),
  ]);

  if (!breakdown && !reviews.length) {
    return (
      <p className="card p-6 text-center text-[13px] text-sand-100/45">
        এই পণ্যে এখনো কোনো ভেরিফাইড রিভিউ নেই — অর্ডার করে প্রথম রিভিউটি আপনিই দিন।
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {breakdown && breakdown.total > 0 ? <Breakdown data={breakdown} /> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-sand-100/40">সাজান:</span>
        {SORTS.map((option) => (
          <Link
            key={option.key}
            href={`${href}?rsort=${option.key}#product-reviews`}
            scroll={false}
            aria-current={sort === option.key ? "true" : undefined}
            className={`badge h-8 px-2.5 text-[11px] transition ${
              sort === option.key
                ? "bg-leaf-600/20 text-leaf-100 ring-1 ring-leaf-400/30"
                : "bg-white/[0.05] text-sand-100/55 hover:bg-white/[0.09]"
            }`}
          >
            {option.bn}
          </Link>
        ))}
      </div>

      {reviews.length ? (
        reviews.map((review) => <ReviewCard key={review.id} review={review} />)
      ) : (
        <p className="card p-5 text-center text-[12.5px] text-sand-100/45">
          এই ক্রমে কোনো রিভিউ নেই।
        </p>
      )}
    </div>
  );
}
