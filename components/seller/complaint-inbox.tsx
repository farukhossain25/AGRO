"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { formatDateBn } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ==========================================================================
   ComplaintInbox — seller view of complaint tickets
   --------------------------------------------------------------------------
   The seller may reply and may move a ticket to "in review" or "resolved".
   Rejecting and reopening are admin-only, so those buttons are not rendered.
   ========================================================================== */

export type SellerComplaint = {
  id: string;
  ticketNo: string;
  problemType: string;
  description: string;
  photos: string[];
  preferredResolution: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  createdAt: string;
  productNameBn: string;
};

const PROBLEM: Record<string, string> = {
  spoiled: "পচা/নষ্ট",
  short_weight: "কম ওজন",
  wrong_item: "ভুল পণ্য",
  late: "দেরি",
  other: "অন্যান্য",
};

const RESOLUTION: Record<string, string> = {
  refund: "টাকা ফেরত",
  replacement: "পণ্য বদল",
  inform: "শুধু জানানো",
};

const STATUS: Record<string, { bn: string; tone: string }> = {
  open: { bn: "খোলা", tone: "bg-amber-500/15 text-amber-300" },
  in_review: { bn: "পর্যালোচনায়", tone: "bg-sky-500/15 text-sky-300" },
  resolved: { bn: "সমাধান", tone: "bg-leaf-600/20 text-leaf-200" },
  rejected: { bn: "বাতিল", tone: "bg-red-500/15 text-red-300" },
};

export function ComplaintInbox({ initial }: { initial: SellerComplaint[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, status: "in_review" | "resolved") {
    if (status === "resolved" && note.trim().length < 5) {
      toast.error("কারণ লিখুন", "সমাধান জানাতে অন্তত ৫ অক্ষর লিখুন");
      return;
    }

    setBusy(id);
    try {
      const res = await fetch(`/api/admin/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note: note.trim() || undefined,
          resolution: status === "resolved" ? "replacement" : undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "আপডেট ব্যর্থ");

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      setNote("");
      toast.success("অভিযোগ আপডেট হয়েছে");
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
        কোনো অভিযোগ নেই — চমৎকার! দ্রুত ডেলিভারি ও ভালো প্যাকেজিং ধরে রাখুন।
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const meta = STATUS[row.status];
        const expanded = openId === row.id;
        const closed = row.status === "resolved" || row.status === "rejected";

        return (
          <li key={row.id} className="card p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11.5px] font-bold text-leaf-200">#{row.ticketNo}</p>
                <p className="mt-0.5 truncate text-[13.5px] font-semibold text-sand-50">
                  {row.productNameBn}
                </p>
                <p className="mt-0.5 text-[11px] text-sand-100/45">
                  {PROBLEM[row.problemType] ?? row.problemType} · {formatDateBn(row.createdAt)} ·{" "}
                  চাওয়া: {RESOLUTION[row.preferredResolution] ?? row.preferredResolution}
                </p>
              </div>
              <span className={`badge ${meta.tone}`}>{meta.bn}</span>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-sand-100/65">
              {row.description}
            </p>

            {row.photos.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {row.photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt="অভিযোগের ছবি"
                    loading="lazy"
                    className="rounded-lg object-cover"
                    style={{ height: 56, width: 56 }}
                  />
                ))}
              </div>
            ) : null}

            {!closed ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : row.id)}
                  className="btn-ghost btn-sm mt-2.5 min-h-[44px]"
                >
                  {expanded ? "বন্ধ করুন" : "উত্তর দিন"}
                </button>

                {expanded ? (
                  <div className="mt-2.5 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="গ্রাহককে কী জানাবেন? সমাধান করতে চাইলে সংক্ষেপে লিখুন…"
                      className="input text-[16px] sm:text-[13px]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void act(row.id, "in_review")}
                        disabled={busy === row.id || row.status === "in_review"}
                        className="btn-ghost btn-sm min-h-[44px]"
                      >
                        {busy === row.id ? <Spinner /> : null} পর্যালোচনায় নিন
                      </button>
                      <button
                        type="button"
                        onClick={() => void act(row.id, "resolved")}
                        disabled={busy === row.id}
                        className="btn-primary btn-sm min-h-[44px]"
                      >
                        সমাধান হয়েছে
                      </button>
                    </div>
                    <p className="text-[10px] text-sand-100/30">
                      বাতিল বা পুনরায় খোলার ক্ষমতা শুধু অ্যাডমিনের আছে।
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[11px] text-sand-100/35">এই টিকিটটি বন্ধ হয়েছে।</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
