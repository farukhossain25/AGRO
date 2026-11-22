"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Star } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, toBn } from "@/lib/format";

/* ==========================================================================
   VerifiedReviewModeration — order_reviews (migration 0005)
   --------------------------------------------------------------------------
   Admins can HIDE and RESTORE verified-purchase reviews. There is no delete:
   the quality score depends on the full history. Seller replies are read-only
   here (the seller writes them once from their own dashboard).
   ========================================================================== */

export type ModReviewRow = {
  id: string;
  rating: number;
  seller_rating: number | null;
  comment: string | null;
  photos: string[] | null;
  tags: string[] | null;
  status: "published" | "hidden";
  seller_reply: string | null;
  created_at: string;
  products: { name_bn: string; slug: string } | null;
  sellers: { name_bn: string; slug: string } | null;
  reviewer: { full_name: string | null } | null;
};

export function VerifiedReviewModeration({ initial }: { initial: ModReviewRow[] }) {
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
        prev.map((r) =>
          r.id === id ? { ...r, status: action === "hide" ? "hidden" : "published" } : r
        )
      );
      toast.success(action === "hide" ? "রিভিউ লুকানো হয়েছে" : "রিভিউ পুনরুদ্ধার হয়েছে");
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
          <h1 className="text-[20px] font-bold text-sand-50">ভেরিফাইড রিভিউ</h1>
          <p className="mt-0.5 text-[12px] text-sand-100/50">
            মোট {toBn(rows.length)}টি · নিচু রেটিং {toBn(lowCount)}টি · মুছে ফেলা যায় না, শুধু লুকানো যায়
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "all", label: "সব" },
              { key: "published", label: "প্রকাশিত" },
              { key: "hidden", label: "লুকানো" },
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
      </header>

      {filtered.length === 0 ? (
        <p className="card p-6 text-center text-[13px] text-sand-100/45">
          এই ফিল্টারে কোনো রিভিউ নেই।
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((row) => (
            <li key={row.id} className="card p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-sand-50">
                    {row.products?.name_bn ?? "পণ্য"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-sand-100/45">
                    {row.reviewer?.full_name ?? "গ্রাহক"}
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
                  {row.status === "hidden" ? (
                    <span className="badge bg-red-500/15 text-[10px] text-red-300">লুকানো</span>
                  ) : (
                    <span className="badge bg-leaf-600/15 text-[10px] text-leaf-200">প্রকাশিত</span>
                  )}
                </div>
              </div>

              {row.comment ? (
                <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-sand-100/60">
                  {row.comment}
                </p>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
