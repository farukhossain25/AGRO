"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Star, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, toBn } from "@/lib/format";

/* ==========================================================================
   ReviewManager — every customer review in one list
   --------------------------------------------------------------------------
   Reviews publish themselves the moment a customer submits one (product
   reviews from a delivered order, and the site-wide testimonial form share
   the `reviews` table). There is no approval step and no pending queue.

   The panel's tools are therefore only:
     • লুকান / পুনরুদ্ধার — status hidden ⇄ published (reversible)
     • মুছুন — hard delete (spam, abuse, a customer's request); audited
   ========================================================================== */

export type AdminReviewRow = {
  id: string;
  rating: number;
  seller_rating: number | null;
  title_bn: string | null;
  comment: string | null;
  photos: string[] | null;
  tags: string[] | null;
  status: "published" | "hidden";
  seller_reply: string | null;
  created_at: string;
  author_name: string | null;
  is_verified_purchase: boolean;
  products: { name_bn: string; slug: string } | null;
  sellers: { name_bn: string; slug: string } | null;
  reviewer: { full_name: string | null } | null;
};

export function ReviewManager({
  initial,
  tagLabels = {},
}: {
  initial: AdminReviewRow[];
  /** review_tags slug → Bengali label, so "fresh" reads as "তাজা" */
  tagLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"all" | "published" | "hidden" | "low">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "low") return rows.filter((r) => r.rating <= 2);
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const lowCount = rows.filter((r) => r.rating <= 2).length;
  const hiddenCount = rows.filter((r) => r.status === "hidden").length;

  function reviewerName(row: AdminReviewRow) {
    return row.reviewer?.full_name || row.author_name || "গ্রাহক";
  }

  async function moderate(id: string, action: "hide" | "restore") {
    setBusy(id);
    try {
      const res = await fetch("/api/foisal/reviews/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error("আপডেট ব্যর্থ");

      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: action === "hide" ? "hidden" : "published" } : r))
      );
      toast.success(action === "hide" ? "রিভিউ লুকানো হয়েছে" : "রিভিউ আবার প্রকাশিত হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: AdminReviewRow) {
    const name = reviewerName(row);
    if (!confirm(`"${name}"-এর এই রিভিউটি স্থায়ীভাবে মুছে ফেলবেন? এটি আর ফেরানো যাবে না।`)) return;
    setBusy(row.id);
    try {
      const res = await fetch(`/api/foisal/reviews?id=${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "মুছে ফেলা যায়নি");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("রিভিউ মুছে ফেলা হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-bold text-sand-50">রিভিউ ও রেটিং</h1>
          <p className="mt-0.5 text-[12px] text-sand-100/50">
            গ্রাহকের রিভিউ সাথে সাথে প্রকাশিত হয় — অনুমোদনের দরকার নেই। মোট {toBn(rows.length)}টি · লুকানো{" "}
            {toBn(hiddenCount)}টি · ১–২ তারা {toBn(lowCount)}টি
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "all", label: "সব", count: rows.length },
              { key: "published", label: "প্রকাশিত", count: rows.length - hiddenCount },
              { key: "hidden", label: "লুকানো", count: hiddenCount },
              { key: "low", label: "১–২ তারা", count: lowCount },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={`badge h-9 px-3 text-[11.5px] transition ${
                filter === option.key
                  ? "bg-leaf-600/20 text-leaf-100 ring-1 ring-leaf-400/30"
                  : "bg-white/[0.05] text-sand-100/55 hover:bg-white/[0.09]"
              }`}
            >
              {option.label}
              <span className="ml-1 text-[10px] opacity-70">{toBn(option.count)}</span>
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="card p-6 text-center text-[13px] text-sand-100/45">এই ফিল্টারে কোনো রিভিউ নেই।</p>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((row) => (
            <li key={row.id} className={`card p-3.5 ${row.status === "hidden" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-sand-50">
                    {row.products?.name_bn ?? "সাইটের মতামত"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-sand-100/45">
                    {reviewerName(row)}
                    {row.is_verified_purchase ? (
                      <span className="ml-1.5 rounded-full bg-leaf-600/15 px-1.5 py-px text-[9.5px] font-semibold text-leaf-700">
                        কেনা পণ্যের রিভিউ
                      </span>
                    ) : null}
                    {row.sellers?.name_bn ? ` · ${row.sellers.name_bn}` : ""}
                    {" · "}
                    {formatDateBn(row.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {toBn(row.rating)}
                  </span>
                  {row.seller_rating ? (
                    <span className="text-[10.5px] text-sand-100/45" title="বিক্রেতার রেটিং">
                      দোকান {toBn(row.seller_rating)}★
                    </span>
                  ) : null}
                  {row.status === "hidden" ? (
                    <span className="badge bg-red-500/15 text-[10px] text-red-300">লুকানো</span>
                  ) : (
                    <span className="badge bg-leaf-600/15 text-[10px] text-leaf-700">প্রকাশিত</span>
                  )}
                </div>
              </div>

              {row.title_bn ? <p className="mt-2 text-[12.5px] font-semibold text-sand-100/85">{row.title_bn}</p> : null}

              {row.comment ? (
                <p className="mt-1.5 whitespace-pre-line text-[12px] leading-5 text-sand-100/60">{row.comment}</p>
              ) : null}

              {row.photos?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.photos.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" className="relative h-12 w-12 overflow-hidden rounded-lg ring-1 ring-white/10">
                      <Image src={src} alt="" fill sizes="48px" className="object-cover" unoptimized />
                    </a>
                  ))}
                </div>
              ) : null}

              {row.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-sand-100/55">
                      {tagLabels[tag] ?? tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {row.seller_reply ? (
                <p className="mt-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-sand-100/55">
                  <span className="font-semibold text-leaf-200/80">সেলারের উত্তর:</span>{" "}
                  {row.seller_reply}
                </p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {row.status === "published" ? (
                  <button
                    type="button"
                    onClick={() => void moderate(row.id, "hide")}
                    disabled={busy === row.id}
                    className="btn-ghost btn-sm min-h-[40px]"
                  >
                    <EyeOff className="h-3.5 w-3.5" /> লুকান
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void moderate(row.id, "restore")}
                    disabled={busy === row.id}
                    className="btn-primary btn-sm min-h-[40px]"
                  >
                    <Eye className="h-3.5 w-3.5" /> পুনরুদ্ধার
                  </button>
                )}

                {row.products?.slug ? (
                  <a
                    href={`/products/${row.products.slug}#product-reviews`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm min-h-[40px]"
                  >
                    পণ্য দেখুন
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={() => void remove(row)}
                  disabled={busy === row.id}
                  className="btn-ghost btn-sm min-h-[40px] !text-red-300 hover:!bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> মুছুন
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
