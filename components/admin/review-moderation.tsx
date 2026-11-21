"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { formatDateBn, toBn } from "@/lib/format";

type Row = Record<string, unknown>;

export function ReviewModeration({ initial, dbReady }: { initial: Row[]; dbReady: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => Boolean(r.is_approved) === (filter === "approved"));
  }, [rows, filter]);

  const pendingCount = rows.filter((r) => !r.is_approved).length;

  async function moderate(id: string, approved: boolean) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_approved: approved }),
      });
      if (!res.ok) throw new Error("আপডেট ব্যর্থ");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_approved: approved } : r)));
      toast.success(approved ? "রিভিউ অনুমোদিত হয়েছে" : "রিভিউ প্রত্যাখ্যাত");
      router.refresh();
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("মুছে ফেলা যায়নি");
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("রিভিউ মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error("ব্যর্থ", (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">রিভিউ মডারেশন</h1>
        <p className="text-[12px] text-sand-100/45">
          {toBn(pendingCount)}টি রিভিউ অনুমোদনের অপেক্ষায়
        </p>
      </div>

      {!dbReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200/90">
          ডেটাবেস সংযুক্ত নেই — মডারেশন করা যাবে না।
        </p>
      ) : null}

      <div className="flex gap-1.5">
        {([
          ["pending", `অপেক্ষমাণ (${toBn(pendingCount)})`],
          ["approved", "অনুমোদিত"],
          ["all", "সব"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`chip ${filter === key ? "chip-active" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((r) => {
          const product = r.products as { name_bn?: string } | null;
          return (
            <article key={String(r.id)} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{String(r.name_bn)}</p>
                  <p className="text-[10px] text-sand-100/35">
                    {String(r.location_bn ?? "")} · {formatDateBn(String(r.created_at ?? ""))}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5">
                  {Array.from({ length: Number(r.rating ?? 0) }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </span>
              </div>

              {product?.name_bn ? (
                <p className="mt-1.5 inline-block rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] text-sand-100/50">
                  {product.name_bn}
                </p>
              ) : null}

              <p className="mt-2 text-[12px] leading-relaxed text-sand-100/70">{String(r.comment)}</p>

              <div className="mt-3 flex gap-2">
                {!r.is_approved ? (
                  <button onClick={() => moderate(String(r.id), true)} disabled={busy === r.id} className="btn-primary btn-sm flex-1">
                    <Check className="h-3.5 w-3.5" /> অনুমোদন
                  </button>
                ) : (
                  <button onClick={() => moderate(String(r.id), false)} disabled={busy === r.id} className="btn-ghost btn-sm flex-1">
                    <X className="h-3.5 w-3.5" /> লুকান
                  </button>
                )}
                <button onClick={() => remove(String(r.id))} disabled={busy === r.id} className="btn-ghost btn-sm !text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length ? (
        <p className="card py-12 text-center text-[12px] text-sand-100/40">এই তালিকায় কোনো রিভিউ নেই</p>
      ) : null}
    </div>
  );
}
