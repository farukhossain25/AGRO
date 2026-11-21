"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, toBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   SellerReplyList — one public reply per review, never an edit or delete
   ========================================================================== */

export type ReplyRow = {
  id: string;
  rating: number;
  sellerRating: number | null;
  comment: string | null;
  photos: string[];
  tags: string[];
  status: "published" | "hidden";
  sellerReply: string | null;
  createdAt: string;
  productNameBn: string;
  productSlug: string | null;
};

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

export function SellerReplyList({ initial }: { initial: ReplyRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unreplied" | "low">("all");
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "unreplied") return rows.filter((r) => !r.sellerReply);
    if (filter === "low") return rows.filter((r) => r.rating <= 2);
    return rows;
  }, [rows, filter]);

  async function reply(id: string) {
    const body = draft.trim();
    if (body.length < 2) {
      toast.error("উত্তর লিখুন");
      return;
    }

    setBusy(id);
    try {
      const res = await fetch(`/api/reviews/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "উত্তর পাঠানো যায়নি");

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, sellerReply: body } : r)));
      setDraftFor(null);
      setDraft("");
      toast.success("উত্তর প্রকাশিত হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length) {
    return (
      <p className="card p-6 text-center text-[13px] text-sand-100/45">
        এখনো কোনো রিভিউ আসেনি। ডেলিভারি সম্পন্ন হলে গ্রাহকরা রিভিউ দিতে পারবেন।
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: "all", label: "সব" },
            { key: "unreplied", label: "উত্তর বাকি" },
            { key: "low", label: "১–২ তারা" },
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
          </button>
        ))}
      </div>

      <ul className="space-y-2.5">
        {filtered.map((row) => (
          <li key={row.id} className="card p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-sand-50">
                  {row.productSlug ? (
                    <a
                      href={`/products/${row.productSlug}#product-reviews`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-leaf-200"
                    >
                      {row.productNameBn}
                    </a>
                  ) : (
                    row.productNameBn
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-sand-100/45">
                  {formatDateBn(row.createdAt)}
                  {row.sellerRating ? ` · সেলার রেটিং ${toBn(row.sellerRating)}/৫` : ""}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-[12.5px] font-bold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {toBn(row.rating)}
              </span>
            </div>

            {row.comment ? (
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-6 text-sand-100/70">
                {row.comment}
              </p>
            ) : null}

            {row.tags.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {row.tags.map((tag) => (
                  <span key={tag} className="badge bg-white/[0.05] text-[10px] text-sand-100/55">
                    {TAG_BN[tag] ?? tag}
                  </span>
                ))}
              </div>
            ) : null}

            {row.photos.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {row.photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt="গ্রাহকের ছবি"
                    loading="lazy"
                    className="rounded-lg object-cover"
                    style={{ height: 56, width: 56 }}
                  />
                ))}
              </div>
            ) : null}

            {row.sellerReply ? (
              <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-leaf-200/80">
                  আপনার উত্তর
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-sand-100/60">
                  {row.sellerReply}
                </p>
                <p className="mt-1 text-[10px] text-sand-100/30">
                  উত্তর একবারই দেওয়া যায় — সম্পাদনা করা সম্ভব নয়।
                </p>
              </div>
            ) : draftFor === row.id ? (
              <div className="mt-2.5 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="গ্রাহককে ধন্যবাদ জানান বা সমস্যার সমাধান লিখুন…"
                  className="input text-[16px] sm:text-[13px]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void reply(row.id)}
                    disabled={busy === row.id}
                    className="btn-primary btn-sm min-h-[44px]"
                  >
                    {busy === row.id ? <Spinner /> : null} উত্তর প্রকাশ করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFor(null);
                      setDraft("");
                    }}
                    className="btn-ghost btn-sm min-h-[44px]"
                  >
                    বাতিল
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftFor(row.id);
                  setDraft("");
                }}
                className="btn-ghost btn-sm mt-2.5 min-h-[44px]"
              >
                উত্তর দিন
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
