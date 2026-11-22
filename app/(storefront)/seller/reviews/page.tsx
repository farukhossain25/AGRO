import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { db, isDbConfigured } from "@/lib/db";
import { getSellerByUser } from "@/lib/sellers";
import { getSupplierQuality } from "@/lib/reviews";
import { toBn } from "@/lib/format";
import { SellerReplyList, type ReplyRow } from "@/components/seller/reply-list";
import { ComplaintInbox, type SellerComplaint } from "@/components/seller/complaint-inbox";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সেলার — রিভিউ ও অভিযোগ",
  robots: { index: false, follow: false },
};

/* ==========================================================================
   /seller/reviews — reviews and complaints addressed to THIS seller
   --------------------------------------------------------------------------
   Sellers can read every review of their products and post one public reply.
   They may not edit or delete a review. Complaints can be replied to and moved
   to "in review" or "resolved" — only an admin may reject or reopen.
   ========================================================================== */

export default async function SellerReviewPage() {
  const user = await currentUser().catch(() => null);
  if (!user) redirect("/login?next=/seller/reviews");

  const seller = await getSellerByUser(user.id).catch(() => null);
  if (!seller) redirect("/seller/apply");

  const rows: ReplyRow[] = [];
  const complaints: SellerComplaint[] = [];
  const quality = await getSupplierQuality(seller.id).catch(() => null);

  if (isDbConfigured()) {
    const client = db();

    const [{ data: reviews }, { data: tickets }] = await Promise.all([
      client
        .from("order_reviews")
        .select(
          "id, rating, seller_rating, comment, photos, tags, status, seller_reply, created_at, products(name_bn, slug)"
        )
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(60),
      client
        .from("complaints")
        .select(
          "id, ticket_no, problem_type, description, photos, preferred_resolution, status, created_at, products(name_bn)"
        )
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    for (const row of reviews ?? []) {
      rows.push({
        id: row.id as string,
        rating: Number(row.rating),
        sellerRating: row.seller_rating ? Number(row.seller_rating) : null,
        comment: (row.comment as string | null) ?? null,
        photos: (row.photos as string[] | null) ?? [],
        tags: (row.tags as string[] | null) ?? [],
        status: row.status as "published" | "hidden",
        sellerReply: (row.seller_reply as string | null) ?? null,
        createdAt: row.created_at as string,
        productNameBn:
          (row.products as unknown as { name_bn: string } | null)?.name_bn ?? "পণ্য",
        productSlug:
          (row.products as unknown as { slug: string } | null)?.slug ?? null,
      });
    }

    for (const row of tickets ?? []) {
      complaints.push({
        id: row.id as string,
        ticketNo: row.ticket_no as string,
        problemType: row.problem_type as string,
        description: row.description as string,
        photos: (row.photos as string[] | null) ?? [],
        preferredResolution: row.preferred_resolution as string,
        status: row.status as SellerComplaint["status"],
        createdAt: row.created_at as string,
        productNameBn:
          (row.products as unknown as { name_bn: string } | null)?.name_bn ?? "পণ্য",
      });
    }
  }

  const unreplied = rows.filter((r) => !r.sellerReply && r.status === "published").length;
  const openTickets = complaints.filter(
    (c) => c.status === "open" || c.status === "in_review"
  ).length;

  return (
    <div className="container-x space-y-6 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-sand-100/40">সেলার প্যানেল</p>
          <h1 className="mt-0.5 text-[22px] font-bold sm:text-[26px]">
            রিভিউ ও অভিযোগ — {seller.name_bn}
          </h1>
          <p className="mt-1 text-[12px] text-sand-100/50">
            {toBn(unreplied)}টি রিভিউতে উত্তর দেওয়া বাকি · {toBn(openTickets)}টি অভিযোগ খোলা
          </p>
        </div>
        <Link href="/seller" className="btn-ghost btn-sm min-h-[44px]">
          ড্যাশবোর্ডে ফিরুন
        </Link>
      </header>

      {quality && quality.review_count > 0 ? (
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13.5px] font-bold text-sand-50">আপনার কোয়ালিটি স্কোর</h2>
            <p className="text-[20px] font-extrabold text-leaf-200">
              {toBn(Math.round(Number(quality.quality_score)))}
              <span className="text-[10px] font-normal text-sand-100/35">/১০০</span>
            </p>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/[0.03] py-1.5">
              <dt className="text-[9.5px] text-sand-100/35">গড় রেটিং</dt>
              <dd className="text-[12.5px] font-semibold">
                {toBn(Number(quality.avg_rating).toFixed(1))}/৫
              </dd>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-1.5">
              <dt className="text-[9.5px] text-sand-100/35">অভিযোগের হার</dt>
              <dd className="text-[12.5px] font-semibold">
                {toBn(Math.round(Number(quality.complaint_rate)))}%
              </dd>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-1.5">
              <dt className="text-[9.5px] text-sand-100/35">সময়মতো ডেলিভারি</dt>
              <dd className="text-[12.5px] font-semibold text-leaf-200">
                {toBn(Math.round(Number(quality.on_time_rate)))}%
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10.5px] text-sand-100/35">
            স্কোর কমলে অ্যাডমিন সতর্কবার্তা বা স্থগিতাদেশ দিতে পারেন। দ্রুত উত্তর ও সময়মতো
            ডেলিভারি স্কোর বাড়ায়।
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2.5 text-[16px] font-bold text-sand-50">গ্রাহক রিভিউ</h2>
        <SellerReplyList initial={rows} />
      </section>

      <section>
        <h2 className="mb-2.5 text-[16px] font-bold text-sand-50">অভিযোগ</h2>
        <ComplaintInbox initial={complaints} />
      </section>

      <p className="text-[11px] leading-5 text-sand-100/35">
        রিভিউ মুছে ফেলা যায় না — শুধুমাত্র একটি পাবলিক উত্তর দেওয়া যায়। সমাধান না হলে অ্যাডমিনের
        সাথে যোগাযোগ করুন।
      </p>
    </div>
  );
}
